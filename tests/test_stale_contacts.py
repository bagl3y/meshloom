"""Stale-contact purge uses the bulk-delete last-heard filter and stays off by default."""

from unittest.mock import MagicMock, patch

import pytest

from app.models import ContactUpsert
from app.repository import AppSettingsRepository, ContactRepository
from app.routers.settings import AppSettingsUpdate, update_settings
from app.services.stale_contacts import purge_stale_contacts

NOW = 1_800_000_000


async def _contact(
    key: str,
    *,
    favorite: bool = False,
    last_seen: int | None,
    first_seen: int | None,
) -> None:
    await ContactRepository.upsert(
        ContactUpsert(
            public_key=key, name=key[:8], type=1, last_seen=last_seen, first_seen=first_seen
        )
    )
    if favorite:
        await ContactRepository.set_favorite(key, True)


class TestStaleContactSetting:
    @pytest.mark.asyncio
    async def test_defaults_to_off(self, test_db):
        settings = await AppSettingsRepository.get()
        assert settings.stale_contact_days == 0

    @pytest.mark.asyncio
    async def test_round_trip_via_patch(self, test_db):
        result = await update_settings(AppSettingsUpdate(stale_contact_days=90))
        assert result.stale_contact_days == 90
        fresh = await AppSettingsRepository.get()
        assert fresh.stale_contact_days == 90


class TestStaleContactPurge:
    @pytest.mark.asyncio
    async def test_off_by_default_deletes_nothing(self, test_db):
        await _contact("aa" * 32, last_seen=1, first_seen=1)
        assert await purge_stale_contacts() == 0
        assert await ContactRepository.get_by_key("aa" * 32) is not None

    @pytest.mark.asyncio
    async def test_purges_last_heard_before_cutoff_not_favorites(self, test_db):
        stale = "11" * 32
        fresh = "22" * 32
        favored = "33" * 32
        new_qr = "44" * 32
        await _contact(stale, last_seen=NOW - 40 * 86400, first_seen=NOW - 80 * 86400)
        await _contact(fresh, last_seen=NOW - 2 * 86400, first_seen=NOW - 80 * 86400)
        await _contact(
            favored, favorite=True, last_seen=NOW - 40 * 86400, first_seen=NOW - 80 * 86400
        )
        await _contact(new_qr, last_seen=None, first_seen=NOW - 1 * 86400)
        await AppSettingsRepository.update(stale_contact_days=30)

        mock_rm = MagicMock()
        mock_rm.is_connected = False

        with (
            patch("time.time", return_value=NOW),
            patch("app.services.radio_runtime.radio_runtime", mock_rm),
            patch("app.websocket.broadcast_event") as broadcast,
        ):
            deleted = await purge_stale_contacts()

        assert deleted == 1
        assert await ContactRepository.get_by_key(stale) is None
        assert await ContactRepository.get_by_key(fresh) is not None
        assert await ContactRepository.get_by_key(favored) is not None
        assert await ContactRepository.get_by_key(new_qr) is not None
        broadcast.assert_called_once_with("contact_deleted", {"public_key": stale})

    @pytest.mark.asyncio
    async def test_null_rf_timestamps_survive_when_purge_enabled(self, test_db):
        """NEW_CONTACT / POST contact leave first_seen and last_seen NULL."""
        never_heard = "66" * 32
        await _contact(never_heard, last_seen=None, first_seen=None)
        await AppSettingsRepository.update(stale_contact_days=30)

        mock_rm = MagicMock()
        mock_rm.is_connected = False

        with (
            patch("time.time", return_value=NOW),
            patch("app.services.radio_runtime.radio_runtime", mock_rm),
            patch("app.websocket.broadcast_event") as broadcast,
        ):
            deleted = await purge_stale_contacts()

        assert deleted == 0
        assert await ContactRepository.get_by_key(never_heard) is not None
        broadcast.assert_not_called()

    @pytest.mark.asyncio
    async def test_radio_removal_is_best_effort(self, test_db):
        key = "55" * 32
        await _contact(key, last_seen=1, first_seen=1)
        await AppSettingsRepository.update(stale_contact_days=1)

        mock_rm = MagicMock()
        mock_rm.is_connected = True
        mock_rm.radio_operation = MagicMock(side_effect=RuntimeError("radio busy"))

        with (
            patch("time.time", return_value=NOW),
            patch("app.services.radio_runtime.radio_runtime", mock_rm),
            patch("app.websocket.broadcast_event"),
        ):
            # radio_operation is an async context manager in production; a raise
            # from the helper still deletes the DB row.
            deleted = await purge_stale_contacts()

        assert deleted == 1
        assert await ContactRepository.get_by_key(key) is None
