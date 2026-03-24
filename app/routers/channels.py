import logging
from hashlib import sha256

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.channel_constants import (
    PUBLIC_CHANNEL_KEY,
    PUBLIC_CHANNEL_NAME,
    is_public_channel_key,
    is_public_channel_name,
)
from app.models import Channel, ChannelDetail, ChannelMessageCounts, ChannelTopSender
from app.region_scope import normalize_region_scope
from app.repository import ChannelRepository, MessageRepository
from app.websocket import broadcast_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/channels", tags=["channels"])


def _broadcast_channel_update(channel: Channel) -> None:
    broadcast_event("channel", channel.model_dump())


class CreateChannelRequest(BaseModel):
    name: str = Field(min_length=1, max_length=32)
    key: str | None = Field(
        default=None,
        description="Channel key as hex string (32 chars = 16 bytes). If omitted or name starts with #, key is derived from name hash.",
    )


class ChannelFloodScopeOverrideRequest(BaseModel):
    flood_scope_override: str = Field(
        description="Blank clears the override; non-empty values temporarily override flood scope"
    )


@router.get("", response_model=list[Channel])
async def list_channels() -> list[Channel]:
    """List all channels from the database."""
    return await ChannelRepository.get_all()


@router.get("/{key}/detail", response_model=ChannelDetail)
async def get_channel_detail(key: str) -> ChannelDetail:
    """Get comprehensive channel profile data with message statistics."""
    channel = await ChannelRepository.get_by_key(key)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    stats = await MessageRepository.get_channel_stats(channel.key)

    return ChannelDetail(
        channel=channel,
        message_counts=ChannelMessageCounts(**stats["message_counts"]),
        first_message_at=stats["first_message_at"],
        unique_sender_count=stats["unique_sender_count"],
        top_senders_24h=[ChannelTopSender(**s) for s in stats["top_senders_24h"]],
    )


@router.post("", response_model=Channel)
async def create_channel(request: CreateChannelRequest) -> Channel:
    """Create a channel in the database.

    Channels are NOT pushed to radio on creation. They are loaded to the radio
    automatically when sending a message (see messages.py send_channel_message).
    """
    requested_name = request.name
    is_hashtag = requested_name.startswith("#")

    # Reserve the canonical Public channel so it cannot drift to another key,
    # and the well-known Public key cannot be renamed to something else.
    if is_public_channel_name(requested_name):
        if request.key:
            try:
                key_bytes = bytes.fromhex(request.key)
                if len(key_bytes) != 16:
                    raise HTTPException(
                        status_code=400,
                        detail="Channel key must be exactly 16 bytes (32 hex chars)",
                    )
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid hex string for key") from None
            if key_bytes.hex().upper() != PUBLIC_CHANNEL_KEY:
                raise HTTPException(
                    status_code=400,
                    detail=f'"{PUBLIC_CHANNEL_NAME}" must use the canonical Public key',
                )
        key_hex = PUBLIC_CHANNEL_KEY
        channel_name = PUBLIC_CHANNEL_NAME
        is_hashtag = False
    elif request.key and not is_hashtag:
        try:
            key_bytes = bytes.fromhex(request.key)
            if len(key_bytes) != 16:
                raise HTTPException(
                    status_code=400, detail="Channel key must be exactly 16 bytes (32 hex chars)"
                )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid hex string for key") from None
        key_hex = key_bytes.hex().upper()
        if is_public_channel_key(key_hex):
            raise HTTPException(
                status_code=400,
                detail=f'The canonical Public key may only be used for "{PUBLIC_CHANNEL_NAME}"',
            )
        channel_name = requested_name
    else:
        # Derive key from name hash (same as meshcore library does)
        key_bytes = sha256(requested_name.encode("utf-8")).digest()[:16]
        key_hex = key_bytes.hex().upper()
        channel_name = requested_name

    logger.info("Creating channel %s: %s (hashtag=%s)", key_hex, channel_name, is_hashtag)

    # Store in database only - radio sync happens at send time
    await ChannelRepository.upsert(
        key=key_hex,
        name=channel_name,
        is_hashtag=is_hashtag,
        on_radio=False,
    )

    stored = await ChannelRepository.get_by_key(key_hex)
    if stored is None:
        raise HTTPException(status_code=500, detail="Channel was created but could not be reloaded")

    _broadcast_channel_update(stored)
    return stored


@router.post("/{key}/mark-read")
async def mark_channel_read(key: str) -> dict:
    """Mark a channel as read (update last_read_at timestamp)."""
    channel = await ChannelRepository.get_by_key(key)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    updated = await ChannelRepository.update_last_read_at(key)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update read state")

    return {"status": "ok", "key": channel.key}


@router.post("/{key}/flood-scope-override", response_model=Channel)
async def set_channel_flood_scope_override(
    key: str, request: ChannelFloodScopeOverrideRequest
) -> Channel:
    """Set or clear a per-channel flood-scope override."""
    channel = await ChannelRepository.get_by_key(key)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    override = normalize_region_scope(request.flood_scope_override) or None
    updated = await ChannelRepository.update_flood_scope_override(channel.key, override)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update flood-scope override")

    refreshed = await ChannelRepository.get_by_key(channel.key)
    if refreshed is None:
        raise HTTPException(status_code=500, detail="Channel disappeared after update")

    broadcast_event("channel", refreshed.model_dump())
    return refreshed


@router.delete("/{key}")
async def delete_channel(key: str) -> dict:
    """Delete a channel from the database by key.

    Note: This does not clear the channel from the radio. The radio's channel
    slots are managed separately (channels are loaded temporarily when sending).
    """
    if is_public_channel_key(key):
        raise HTTPException(
            status_code=400, detail="The canonical Public channel cannot be deleted"
        )

    logger.info("Deleting channel %s from database", key)
    await ChannelRepository.delete(key)

    broadcast_event("channel_deleted", {"key": key})

    return {"status": "ok"}
