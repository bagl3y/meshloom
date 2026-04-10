import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import radio_stats


def _make_event(event_type, payload=None):
    return SimpleNamespace(type=event_type, payload=payload or {})


class TestRadioStatsSamplingLoop:
    @pytest.mark.asyncio
    async def test_logs_and_continues_after_unexpected_sample_exception(self):
        sample_calls = 0
        sleep_calls = 0

        async def fake_sample() -> None:
            nonlocal sample_calls
            sample_calls += 1
            if sample_calls == 1:
                raise RuntimeError("boom")

        async def fake_sleep(_seconds: int) -> None:
            nonlocal sleep_calls
            sleep_calls += 1
            if sleep_calls >= 2:
                raise asyncio.CancelledError()

        with (
            patch.object(radio_stats, "_sample_all_stats", side_effect=fake_sample),
            patch.object(radio_stats.asyncio, "sleep", side_effect=fake_sleep),
            patch.object(radio_stats.logger, "exception") as mock_exception,
        ):
            with pytest.raises(asyncio.CancelledError):
                await radio_stats._stats_sampling_loop()

        assert sample_calls == 2
        assert sleep_calls == 2
        mock_exception.assert_called_once()

    @pytest.mark.asyncio
    async def test_broadcasts_health_every_cycle(self):
        """The loop should push a WS health broadcast after every iteration."""
        sleep_calls = 0

        async def fake_sample() -> None:
            pass  # no-op; just testing that broadcast fires

        async def fake_sleep(_seconds: int) -> None:
            nonlocal sleep_calls
            sleep_calls += 1
            if sleep_calls >= 2:
                raise asyncio.CancelledError()

        with (
            patch.object(radio_stats, "_sample_all_stats", side_effect=fake_sample),
            patch.object(radio_stats.asyncio, "sleep", side_effect=fake_sleep),
            patch("app.websocket.broadcast_health") as mock_broadcast,
        ):
            with pytest.raises(asyncio.CancelledError):
                await radio_stats._stats_sampling_loop()

        assert mock_broadcast.call_count == 2


class TestSampleAllStats:
    @pytest.mark.asyncio
    async def test_clears_cache_when_disconnected(self):
        """Stats cache should be empty when radio is disconnected."""
        radio_stats._latest_stats = {"old": "data"}

        with patch.object(radio_stats, "radio_manager") as mock_rm:
            mock_rm.is_connected = False
            await radio_stats._sample_all_stats()

        assert radio_stats._latest_stats == {}

    @pytest.mark.asyncio
    async def test_partial_stats_still_records_available_data(self):
        """If core stats return ERROR but radio/packet stats succeed, noise floor
        is still sampled and available fields are cached."""
        from meshcore import EventType

        radio_stats._latest_stats = {}
        radio_stats._noise_floor_samples.clear()

        core_event = _make_event(EventType.ERROR, {"reason": "unsupported"})
        radio_event = _make_event(
            EventType.STATS_RADIO,
            {
                "noise_floor": -118,
                "last_rssi": -90,
                "last_snr": 8.0,
                "tx_air_secs": 10,
                "rx_air_secs": 20,
            },
        )
        packet_event = _make_event(
            EventType.STATS_PACKETS,
            {
                "recv": 100,
                "sent": 50,
                "flood_tx": 20,
                "direct_tx": 30,
                "flood_rx": 60,
                "direct_rx": 40,
            },
        )

        mock_mc = AsyncMock()
        mock_mc.commands.get_stats_core = AsyncMock(return_value=core_event)
        mock_mc.commands.get_stats_radio = AsyncMock(return_value=radio_event)
        mock_mc.commands.get_stats_packets = AsyncMock(return_value=packet_event)

        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_mc)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch.object(radio_stats, "radio_manager") as mock_rm:
            mock_rm.is_connected = True
            mock_rm.radio_operation = MagicMock(return_value=mock_ctx)
            await radio_stats._sample_all_stats()

        snapshot = radio_stats._latest_stats
        # Core fields missing (ERROR), but radio + packet fields present
        assert "battery_mv" not in snapshot
        assert snapshot["noise_floor"] == -118
        assert snapshot["packets"]["recv"] == 100
        # Noise floor history was still appended
        assert len(radio_stats._noise_floor_samples) == 1

    @pytest.mark.asyncio
    async def test_all_stats_succeed(self):
        """All three stats commands succeed — full snapshot cached."""
        from meshcore import EventType

        radio_stats._latest_stats = {}
        radio_stats._noise_floor_samples.clear()

        core_event = _make_event(
            EventType.STATS_CORE,
            {"battery_mv": 4100, "uptime_secs": 7200, "errors": 0, "queue_len": 2},
        )
        radio_event = _make_event(
            EventType.STATS_RADIO,
            {
                "noise_floor": -120,
                "last_rssi": -85,
                "last_snr": 9.5,
                "tx_air_secs": 100,
                "rx_air_secs": 200,
            },
        )
        packet_event = _make_event(
            EventType.STATS_PACKETS,
            {
                "recv": 500,
                "sent": 250,
                "flood_tx": 100,
                "direct_tx": 150,
                "flood_rx": 300,
                "direct_rx": 200,
            },
        )

        mock_mc = AsyncMock()
        mock_mc.commands.get_stats_core = AsyncMock(return_value=core_event)
        mock_mc.commands.get_stats_radio = AsyncMock(return_value=radio_event)
        mock_mc.commands.get_stats_packets = AsyncMock(return_value=packet_event)

        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_mc)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch.object(radio_stats, "radio_manager") as mock_rm:
            mock_rm.is_connected = True
            mock_rm.radio_operation = MagicMock(return_value=mock_ctx)
            await radio_stats._sample_all_stats()

        snapshot = radio_stats._latest_stats
        assert snapshot["battery_mv"] == 4100
        assert snapshot["noise_floor"] == -120
        assert snapshot["packets"]["sent"] == 250
        assert len(radio_stats._noise_floor_samples) == 1

    @pytest.mark.asyncio
    async def test_all_errors_clears_cache(self):
        """If every stats command returns ERROR, cache is empty."""
        from meshcore import EventType

        radio_stats._latest_stats = {"old": "stale"}

        error = _make_event(EventType.ERROR, {"reason": "unsupported"})

        mock_mc = AsyncMock()
        mock_mc.commands.get_stats_core = AsyncMock(return_value=error)
        mock_mc.commands.get_stats_radio = AsyncMock(return_value=error)
        mock_mc.commands.get_stats_packets = AsyncMock(return_value=error)

        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_mc)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)

        with patch.object(radio_stats, "radio_manager") as mock_rm:
            mock_rm.is_connected = True
            mock_rm.radio_operation = MagicMock(return_value=mock_ctx)
            await radio_stats._sample_all_stats()

        assert radio_stats._latest_stats == {}
