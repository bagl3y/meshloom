"""Best-effort stale-contact purge. Off unless ``stale_contact_days`` > 0."""

import asyncio
import logging
import time

from app.repository import AppSettingsRepository, ContactRepository

logger = logging.getLogger(__name__)

SECONDS_PER_DAY = 86400
STALE_PURGE_INTERVAL_SECONDS = 3600

_purge_task: asyncio.Task | None = None


async def delete_contacts_best_effort(public_keys: list[str]) -> int:
    """Delete contacts from the DB and, if connected, from the radio.

    Radio removal is best-effort: a radio failure still deletes the DB rows.
    """
    from app.services.radio_runtime import radio_runtime
    from app.websocket import broadcast_event

    contacts = []
    for key in public_keys:
        contact = await ContactRepository.get_by_key(key.lower())
        if contact:
            contacts.append(contact)
    if not contacts:
        return 0

    if radio_runtime.is_connected:
        try:
            async with radio_runtime.radio_operation("stale_contact_purge") as mc:
                for contact in contacts:
                    radio_contact = mc.get_contact_by_key_prefix(contact.public_key[:12])
                    if radio_contact:
                        await mc.commands.remove_contact(radio_contact)
        except Exception as e:
            logger.warning("Radio removal during stale purge failed: %s", e)

    deleted = 0
    for contact in contacts:
        await ContactRepository.delete(contact.public_key)
        broadcast_event("contact_deleted", {"public_key": contact.public_key})
        deleted += 1
    return deleted


async def purge_stale_contacts() -> int:
    """Delete non-favorite contacts matching the bulk-delete last-heard filter."""
    settings = await AppSettingsRepository.get()
    days = settings.stale_contact_days
    if days <= 0:
        return 0
    cutoff = int(time.time()) - days * SECONDS_PER_DAY
    keys = await ContactRepository.list_stale_public_keys(cutoff)
    if not keys:
        return 0
    deleted = await delete_contacts_best_effort(keys)
    logger.info("Stale contact purge removed %d contact(s) (days=%d)", deleted, days)
    return deleted


async def _stale_purge_loop() -> None:
    await asyncio.sleep(60)
    while True:
        try:
            await purge_stale_contacts()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Stale contact purge failed")
        await asyncio.sleep(STALE_PURGE_INTERVAL_SECONDS)


def start_stale_contact_purge() -> None:
    global _purge_task
    if _purge_task is None or _purge_task.done():
        _purge_task = asyncio.create_task(_stale_purge_loop())
        logger.info(
            "Started stale contact purge task (interval: %ds)", STALE_PURGE_INTERVAL_SECONDS
        )


async def stop_stale_contact_purge() -> None:
    global _purge_task
    if _purge_task is None:
        return
    _purge_task.cancel()
    try:
        await _purge_task
    except asyncio.CancelledError:
        pass
    _purge_task = None
    logger.info("Stopped stale contact purge")
