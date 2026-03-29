"""Tests for repeater telemetry history: repository CRUD, pruning, and API endpoints."""

import time

import pytest

from app.models import CONTACT_TYPE_REPEATER
from app.repository import (
    AppSettingsRepository,
    ContactRepository,
    RepeaterTelemetryRepository,
)

KEY_A = "aa" * 32
KEY_B = "bb" * 32


async def _insert_repeater(public_key: str, name: str = "Repeater"):
    """Insert a repeater contact into the test database."""
    await ContactRepository.upsert(
        {
            "public_key": public_key,
            "name": name,
            "type": CONTACT_TYPE_REPEATER,
            "flags": 0,
            "direct_path": None,
            "direct_path_len": -1,
            "direct_path_hash_mode": -1,
            "last_advert": None,
            "lat": None,
            "lon": None,
            "last_seen": None,
            "on_radio": False,
            "last_contacted": None,
            "first_seen": None,
        }
    )


@pytest.fixture
async def _db(test_db):
    """Set up test DB and patch the repeater_telemetry module's db reference."""
    from app.repository import repeater_telemetry

    original = repeater_telemetry.db
    repeater_telemetry.db = test_db
    try:
        yield test_db
    finally:
        repeater_telemetry.db = original


class TestRepeaterTelemetryRepository:
    """Tests for RepeaterTelemetryRepository CRUD operations."""

    @pytest.mark.asyncio
    async def test_record_and_get_history(self, _db):
        await _insert_repeater(KEY_A)
        now = int(time.time())

        await RepeaterTelemetryRepository.record(
            public_key=KEY_A,
            timestamp=now - 3600,
            battery_volts=4.15,
            uptime_seconds=1000,
            noise_floor_dbm=-100,
        )
        await RepeaterTelemetryRepository.record(
            public_key=KEY_A,
            timestamp=now,
            battery_volts=4.10,
            uptime_seconds=2000,
            noise_floor_dbm=-95,
        )

        history = await RepeaterTelemetryRepository.get_history(KEY_A, now - 7200)
        assert len(history) == 2
        assert history[0]["battery_volts"] == 4.15
        assert history[1]["battery_volts"] == 4.10
        assert history[0]["timestamp"] < history[1]["timestamp"]

    @pytest.mark.asyncio
    async def test_get_history_filters_by_time(self, _db):
        await _insert_repeater(KEY_A)
        now = int(time.time())

        await RepeaterTelemetryRepository.record(KEY_A, now - 7200, 4.0)
        await RepeaterTelemetryRepository.record(KEY_A, now - 3600, 4.1)
        await RepeaterTelemetryRepository.record(KEY_A, now, 4.2)

        history = await RepeaterTelemetryRepository.get_history(KEY_A, now - 3601)
        assert len(history) == 2

    @pytest.mark.asyncio
    async def test_get_history_isolates_by_key(self, _db):
        await _insert_repeater(KEY_A)
        await _insert_repeater(KEY_B)
        now = int(time.time())

        await RepeaterTelemetryRepository.record(KEY_A, now, 4.1)
        await RepeaterTelemetryRepository.record(KEY_B, now, 3.9)

        history_a = await RepeaterTelemetryRepository.get_history(KEY_A, 0)
        history_b = await RepeaterTelemetryRepository.get_history(KEY_B, 0)
        assert len(history_a) == 1
        assert len(history_b) == 1
        assert history_a[0]["battery_volts"] == 4.1

    @pytest.mark.asyncio
    async def test_prune_old(self, _db):
        await _insert_repeater(KEY_A)
        now = int(time.time())

        # Insert one old and one recent
        await RepeaterTelemetryRepository.record(KEY_A, now - 100000, 3.5)
        await RepeaterTelemetryRepository.record(KEY_A, now, 4.0)

        pruned = await RepeaterTelemetryRepository.prune_old(50000)
        assert pruned == 1

        remaining = await RepeaterTelemetryRepository.get_history(KEY_A, 0)
        assert len(remaining) == 1
        assert remaining[0]["battery_volts"] == 4.0

    @pytest.mark.asyncio
    async def test_record_nullable_fields(self, _db):
        await _insert_repeater(KEY_A)
        now = int(time.time())

        await RepeaterTelemetryRepository.record(KEY_A, now, 4.0)
        history = await RepeaterTelemetryRepository.get_history(KEY_A, 0)
        assert len(history) == 1
        assert history[0]["uptime_seconds"] is None
        assert history[0]["noise_floor_dbm"] is None


class TestTelemetryTrackingToggle:
    """Tests for telemetry tracking toggle in app settings."""

    @pytest.mark.asyncio
    async def test_toggle_adds_and_removes_key(self, _db):
        settings = await AppSettingsRepository.get()
        assert settings.telemetry_tracked_keys == []

        settings = await AppSettingsRepository.toggle_telemetry_tracked_key(KEY_A)
        assert KEY_A.lower() in settings.telemetry_tracked_keys

        settings = await AppSettingsRepository.toggle_telemetry_tracked_key(KEY_A)
        assert KEY_A.lower() not in settings.telemetry_tracked_keys

    @pytest.mark.asyncio
    async def test_toggle_normalizes_to_lowercase(self, _db):
        upper_key = "AA" * 32
        settings = await AppSettingsRepository.toggle_telemetry_tracked_key(upper_key)
        assert KEY_A in settings.telemetry_tracked_keys

    @pytest.mark.asyncio
    async def test_toggle_persists_across_reads(self, _db):
        await AppSettingsRepository.toggle_telemetry_tracked_key(KEY_A)
        settings = await AppSettingsRepository.get()
        assert KEY_A in settings.telemetry_tracked_keys


class TestTelemetryHistoryEndpoint:
    """Tests for the telemetry history API endpoint."""

    @pytest.mark.asyncio
    async def test_history_endpoint(self, _db, client):
        await _insert_repeater(KEY_A)
        now = int(time.time())

        await RepeaterTelemetryRepository.record(KEY_A, now, 4.1, 1000, -90)

        resp = await client.get(f"/api/contacts/{KEY_A}/repeater/telemetry-history?hours=24")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["entries"]) == 1
        assert data["entries"][0]["battery_volts"] == 4.1
        assert data["entries"][0]["uptime_seconds"] == 1000
        assert data["entries"][0]["noise_floor_dbm"] == -90

    @pytest.mark.asyncio
    async def test_history_endpoint_non_repeater_rejected(self, _db, client):
        await ContactRepository.upsert(
            {
                "public_key": KEY_A,
                "name": "Node",
                "type": 0,
                "flags": 0,
                "direct_path": None,
                "direct_path_len": -1,
                "direct_path_hash_mode": -1,
                "last_advert": None,
                "lat": None,
                "lon": None,
                "last_seen": None,
                "on_radio": False,
                "last_contacted": None,
                "first_seen": None,
            }
        )
        resp = await client.get(f"/api/contacts/{KEY_A}/repeater/telemetry-history")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_history_endpoint_404_unknown_key(self, _db, client):
        resp = await client.get(f"/api/contacts/{KEY_A}/repeater/telemetry-history")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_history_endpoint_default_hours(self, _db, client):
        await _insert_repeater(KEY_A)
        resp = await client.get(f"/api/contacts/{KEY_A}/repeater/telemetry-history")
        assert resp.status_code == 200


class TestToggleEndpoint:
    """Tests for the telemetry tracking toggle API endpoint."""

    @pytest.mark.asyncio
    async def test_toggle_endpoint(self, _db, client):
        resp = await client.post(
            "/api/settings/telemetry-tracked-keys/toggle",
            json={"key": KEY_A},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert KEY_A in data["telemetry_tracked_keys"]

        # Toggle off
        resp = await client.post(
            "/api/settings/telemetry-tracked-keys/toggle",
            json={"key": KEY_A},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert KEY_A not in data["telemetry_tracked_keys"]
