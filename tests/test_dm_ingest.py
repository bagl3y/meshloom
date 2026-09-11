"""Direct tests for the DM ingest seam."""

import asyncio

import pytest

from app.decoder import DecryptedDirectMessage
from app.models import ContactUpsert
from app.repository import ContactRepository, MessageRepository, RawPacketRepository
from app.services.dm_ingest import (
    ingest_decrypted_direct_message,
    resolve_fallback_direct_message_context,
)


def _dm(
    *, timestamp: int = 1_700_000_000, flags: int = 0, message: str = "hello"
) -> DecryptedDirectMessage:
    return DecryptedDirectMessage(
        timestamp=timestamp,
        flags=flags,
        message=message,
        dest_hash="aa",
        src_hash="bb",
    )


@pytest.mark.asyncio
async def test_skips_cli_txt_type(test_db):
    key = "aa" * 32
    await ContactRepository.upsert(ContactUpsert(public_key=key, name="Alice", type=1))
    packet_id, _ = await RawPacketRepository.create(b"cli-dm", 1)

    result = await ingest_decrypted_direct_message(
        packet_id=packet_id,
        decrypted=_dm(flags=4, message="ok"),
        their_public_key=key,
        received_at=1,
        broadcast_fn=lambda *_args, **_kwargs: None,
    )

    assert result is None
    assert await MessageRepository.get_all(msg_type="PRIV", conversation_key=key, limit=10) == []


@pytest.mark.asyncio
async def test_skips_repeater_cli_storage(test_db):
    key = "bb" * 32
    await ContactRepository.upsert(ContactUpsert(public_key=key, name="Hill", type=2))
    packet_id, _ = await RawPacketRepository.create(b"rpt-dm", 1)

    result = await ingest_decrypted_direct_message(
        packet_id=packet_id,
        decrypted=_dm(),
        their_public_key=key,
        received_at=1,
        broadcast_fn=lambda *_args, **_kwargs: None,
    )

    assert result is None
    assert await MessageRepository.get_all(msg_type="PRIV", conversation_key=key, limit=10) == []


@pytest.mark.asyncio
async def test_ambiguous_prefix_keeps_prefix_conversation(test_db):
    prefix = "abcd1234eeee"
    await ContactRepository.upsert(ContactUpsert(public_key=prefix + "a" * 20, name="One", type=1))
    await ContactRepository.upsert(ContactUpsert(public_key=prefix + "b" * 20, name="Two", type=1))

    ctx = await resolve_fallback_direct_message_context(
        sender_public_key=prefix,
        received_at=1,
        broadcast_fn=lambda *_args, **_kwargs: None,
    )

    assert ctx.conversation_key == prefix
    assert ctx.skip_storage is False
    assert ctx.contact is not None
    assert ctx.contact.public_key == prefix
    assert ctx.sender_key == prefix


@pytest.mark.asyncio
async def test_linked_packet_dedup_and_lock(test_db):
    key = "cc" * 32
    await ContactRepository.upsert(ContactUpsert(public_key=key, name="Carol", type=1))
    packet_id, _ = await RawPacketRepository.create(b"lock-dm", 1)
    decrypted = _dm(message="same packet")

    first, second = await asyncio.gather(
        ingest_decrypted_direct_message(
            packet_id=packet_id,
            decrypted=decrypted,
            their_public_key=key,
            received_at=10,
            broadcast_fn=lambda *_args, **_kwargs: None,
        ),
        ingest_decrypted_direct_message(
            packet_id=packet_id,
            decrypted=decrypted,
            their_public_key=key,
            received_at=11,
            broadcast_fn=lambda *_args, **_kwargs: None,
        ),
    )

    stored = [msg for msg in (first, second) if msg is not None]
    assert len(stored) == 1
    rows = await MessageRepository.get_all(msg_type="PRIV", conversation_key=key, limit=10)
    assert len(rows) == 1
    assert rows[0].text == "same packet"
    assert await RawPacketRepository.get_linked_message_id(packet_id) == rows[0].id
