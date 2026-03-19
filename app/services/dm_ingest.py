import asyncio
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from app.models import CONTACT_TYPE_REPEATER, Contact, ContactUpsert, Message
from app.repository import (
    AmbiguousPublicKeyPrefixError,
    ContactRepository,
    MessageRepository,
    RawPacketRepository,
)
from app.services.contact_reconciliation import claim_prefix_messages_for_contact
from app.services.messages import (
    broadcast_message,
    build_message_model,
    build_message_paths,
    format_contact_log_target,
    handle_duplicate_message,
    reconcile_duplicate_message,
    truncate_for_log,
)

if TYPE_CHECKING:
    from app.decoder import DecryptedDirectMessage

logger = logging.getLogger(__name__)

BroadcastFn = Callable[..., Any]
_decrypted_dm_store_lock = asyncio.Lock()


@dataclass(frozen=True)
class FallbackDirectMessageContext:
    conversation_key: str
    contact: Contact | None
    sender_name: str | None
    sender_key: str | None
    skip_storage: bool = False


async def _prepare_resolved_contact(
    contact: Contact,
    *,
    log: logging.Logger | None = None,
) -> tuple[str, bool]:
    conversation_key = contact.public_key.lower()
    await claim_prefix_messages_for_contact(public_key=conversation_key, log=log or logger)

    if contact.type == CONTACT_TYPE_REPEATER:
        return conversation_key, True

    return conversation_key, False


async def resolve_fallback_direct_message_context(
    *,
    sender_public_key: str,
    received_at: int,
    broadcast_fn: BroadcastFn,
    contact_repository=ContactRepository,
    log: logging.Logger | None = None,
) -> FallbackDirectMessageContext:
    normalized_sender = sender_public_key.lower()

    try:
        contact = await contact_repository.get_by_key_or_prefix(normalized_sender)
    except AmbiguousPublicKeyPrefixError:
        (log or logger).warning(
            "DM sender prefix '%s' is ambiguous; storing under prefix until full key is known",
            sender_public_key,
        )
        contact = None

    if contact is not None:
        conversation_key, skip_storage = await _prepare_resolved_contact(contact, log=log)
        return FallbackDirectMessageContext(
            conversation_key=conversation_key,
            contact=contact,
            sender_name=contact.name,
            sender_key=conversation_key,
            skip_storage=skip_storage,
        )

    if normalized_sender:
        placeholder_upsert = ContactUpsert(
            public_key=normalized_sender,
            type=0,
            last_seen=received_at,
            last_contacted=received_at,
            first_seen=received_at,
            on_radio=False,
            out_path_hash_mode=-1,
        )
        await contact_repository.upsert(placeholder_upsert)
        contact = await contact_repository.get_by_key(normalized_sender)
        if contact is not None:
            broadcast_fn("contact", contact.model_dump())

    return FallbackDirectMessageContext(
        conversation_key=normalized_sender,
        contact=contact,
        sender_name=contact.name if contact else None,
        sender_key=normalized_sender or None,
    )


async def _store_direct_message(
    *,
    packet_id: int | None,
    conversation_key: str,
    text: str,
    sender_timestamp: int,
    received_at: int,
    path: str | None,
    path_len: int | None,
    outgoing: bool,
    txt_type: int,
    signature: str | None,
    sender_name: str | None,
    sender_key: str | None,
    realtime: bool,
    broadcast_fn: BroadcastFn,
    update_last_contacted_key: str | None,
    best_effort_content_dedup: bool,
    linked_packet_dedup: bool,
    message_repository=MessageRepository,
    contact_repository=ContactRepository,
    raw_packet_repository=RawPacketRepository,
) -> Message | None:
    async def store() -> Message | None:
        if linked_packet_dedup and packet_id is not None:
            linked_message_id = await raw_packet_repository.get_linked_message_id(packet_id)
            if linked_message_id is not None:
                existing_msg = await message_repository.get_by_id(linked_message_id)
                if existing_msg is not None:
                    await reconcile_duplicate_message(
                        existing_msg=existing_msg,
                        packet_id=packet_id,
                        path=path,
                        received_at=received_at,
                        path_len=path_len,
                        broadcast_fn=broadcast_fn,
                    )
                    return None

        if best_effort_content_dedup:
            existing_msg = await message_repository.get_by_content(
                msg_type="PRIV",
                conversation_key=conversation_key,
                text=text,
                sender_timestamp=sender_timestamp,
                outgoing=outgoing,
            )
            if existing_msg is not None:
                await reconcile_duplicate_message(
                    existing_msg=existing_msg,
                    packet_id=packet_id,
                    path=path,
                    received_at=received_at,
                    path_len=path_len,
                    broadcast_fn=broadcast_fn,
                )
                return None

        msg_id = await message_repository.create(
            msg_type="PRIV",
            text=text,
            conversation_key=conversation_key,
            sender_timestamp=sender_timestamp,
            received_at=received_at,
            path=path,
            path_len=path_len,
            txt_type=txt_type,
            signature=signature,
            outgoing=outgoing,
            sender_key=sender_key,
            sender_name=sender_name,
        )
        if msg_id is None:
            await handle_duplicate_message(
                packet_id=packet_id,
                msg_type="PRIV",
                conversation_key=conversation_key,
                text=text,
                sender_timestamp=sender_timestamp,
                outgoing=outgoing,
                path=path,
                received_at=received_at,
                path_len=path_len,
                broadcast_fn=broadcast_fn,
            )
            return None

        if packet_id is not None:
            await raw_packet_repository.mark_decrypted(packet_id, msg_id)

        message = build_message_model(
            message_id=msg_id,
            msg_type="PRIV",
            conversation_key=conversation_key,
            text=text,
            sender_timestamp=sender_timestamp,
            received_at=received_at,
            paths=build_message_paths(path, received_at, path_len),
            txt_type=txt_type,
            signature=signature,
            sender_key=sender_key,
            outgoing=outgoing,
            sender_name=sender_name,
        )
        broadcast_message(message=message, broadcast_fn=broadcast_fn, realtime=realtime)

        if update_last_contacted_key:
            await contact_repository.update_last_contacted(update_last_contacted_key, received_at)

        return message

    if linked_packet_dedup:
        async with _decrypted_dm_store_lock:
            return await store()
    return await store()


async def ingest_decrypted_direct_message(
    *,
    packet_id: int,
    decrypted: "DecryptedDirectMessage",
    their_public_key: str,
    received_at: int | None = None,
    path: str | None = None,
    path_len: int | None = None,
    outgoing: bool = False,
    realtime: bool = True,
    broadcast_fn: BroadcastFn,
    contact_repository=ContactRepository,
) -> Message | None:
    conversation_key = their_public_key.lower()
    contact = await contact_repository.get_by_key(conversation_key)
    sender_name: str | None = None
    if contact is not None:
        conversation_key, skip_storage = await _prepare_resolved_contact(contact, log=logger)
        if skip_storage:
            logger.debug(
                "Skipping message from repeater %s (CLI responses not stored): %s",
                conversation_key[:12],
                (decrypted.message or "")[:50],
            )
            return None
        if not outgoing:
            sender_name = contact.name

    received = received_at or int(time.time())
    message = await _store_direct_message(
        packet_id=packet_id,
        conversation_key=conversation_key,
        text=decrypted.message,
        sender_timestamp=decrypted.timestamp,
        received_at=received,
        path=path,
        path_len=path_len,
        outgoing=outgoing,
        txt_type=0,
        signature=None,
        sender_name=sender_name,
        sender_key=conversation_key if not outgoing else None,
        realtime=realtime,
        broadcast_fn=broadcast_fn,
        update_last_contacted_key=conversation_key,
        best_effort_content_dedup=outgoing,
        linked_packet_dedup=True,
    )
    if message is None:
        return None

    logger.info(
        'Stored direct message "%s" for %r (msg ID %d in contact ID %s, outgoing=%s)',
        truncate_for_log(decrypted.message),
        format_contact_log_target(contact.name if contact else None, conversation_key),
        message.id,
        conversation_key,
        outgoing,
    )
    return message


async def ingest_fallback_direct_message(
    *,
    conversation_key: str,
    text: str,
    sender_timestamp: int,
    received_at: int,
    path: str | None,
    path_len: int | None,
    txt_type: int,
    signature: str | None,
    sender_name: str | None,
    sender_key: str | None,
    broadcast_fn: BroadcastFn,
    update_last_contacted_key: str | None = None,
) -> Message | None:
    return await _store_direct_message(
        packet_id=None,
        conversation_key=conversation_key,
        text=text,
        sender_timestamp=sender_timestamp,
        received_at=received_at,
        path=path,
        path_len=path_len,
        outgoing=False,
        txt_type=txt_type,
        signature=signature,
        sender_name=sender_name,
        sender_key=sender_key,
        realtime=True,
        broadcast_fn=broadcast_fn,
        update_last_contacted_key=update_last_contacted_key,
        best_effort_content_dedup=True,
        linked_packet_dedup=False,
    )
