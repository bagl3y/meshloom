"""In-memory local-radio stats sampling.

A single 60s loop fetches core, radio, and packet stats from the connected
radio in one radio-lock acquisition and caches everything in memory.  The
noise-floor 24h history deque is maintained as a side effect.

Consumers:
- GET /api/health      → get_latest_radio_stats()  (battery, uptime, etc.)
- GET /api/statistics  → get_noise_floor_history()  (24h noise-floor chart)
"""

import asyncio
import logging
import time
from collections import deque
from typing import Any

from meshcore import EventType

from app.radio import RadioDisconnectedError, RadioOperationBusyError
from app.services.radio_runtime import radio_runtime as radio_manager

logger = logging.getLogger(__name__)

STATS_SAMPLE_INTERVAL_SECONDS = 60
NOISE_FLOOR_WINDOW_SECONDS = 24 * 60 * 60
MAX_NOISE_FLOOR_SAMPLES = 1500  # 24h at 60s intervals = 1440

_stats_task: asyncio.Task | None = None
_noise_floor_samples: deque[tuple[int, int]] = deque(maxlen=MAX_NOISE_FLOOR_SAMPLES)
_latest_stats: dict[str, Any] = {}


async def _sample_all_stats() -> None:
    """Fetch core, radio, and packet stats in one radio operation."""
    global _latest_stats

    if not radio_manager.is_connected:
        _latest_stats = {}
        return

    try:
        async with radio_manager.radio_operation("radio_stats_sample") as mc:
            core_event = await mc.commands.get_stats_core()
            radio_event = await mc.commands.get_stats_radio()
            packet_event = await mc.commands.get_stats_packets()
    except (RadioDisconnectedError, RadioOperationBusyError):
        return
    except Exception as exc:
        logger.debug("Radio stats sampling failed: %s", exc)
        return

    now = int(time.time())
    snapshot: dict[str, Any] = {"timestamp": now}

    if getattr(core_event, "type", None) == EventType.STATS_CORE:
        snapshot.update(core_event.payload)

    if getattr(radio_event, "type", None) == EventType.STATS_RADIO:
        snapshot.update(radio_event.payload)
        noise_floor = radio_event.payload.get("noise_floor")
        if isinstance(noise_floor, int):
            _noise_floor_samples.append((now, noise_floor))

    if getattr(packet_event, "type", None) == EventType.STATS_PACKETS:
        snapshot["packets"] = packet_event.payload

    has_any_data = len(snapshot) > 1
    _latest_stats = snapshot if has_any_data else {}


async def _stats_sampling_loop() -> None:
    while True:
        try:
            await _sample_all_stats()
            from app.websocket import broadcast_health

            broadcast_health(radio_manager.is_connected, radio_manager.connection_info)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Radio stats sampling loop error")

        try:
            await asyncio.sleep(STATS_SAMPLE_INTERVAL_SECONDS)
        except asyncio.CancelledError:
            raise


# ── Public API ────────────────────────────────────────────────────────────


async def start_radio_stats_sampling() -> None:
    """Start the periodic radio stats background task."""
    global _stats_task
    if _stats_task is not None and not _stats_task.done():
        return
    _stats_task = asyncio.create_task(_stats_sampling_loop())


async def stop_radio_stats_sampling() -> None:
    """Stop the periodic radio stats background task."""
    global _stats_task
    if _stats_task is None:
        return
    if not _stats_task.done():
        _stats_task.cancel()
        try:
            await _stats_task
        except asyncio.CancelledError:
            pass
    _stats_task = None


def get_noise_floor_history() -> dict:
    """Return the current 24-hour in-memory noise floor history snapshot."""
    now = int(time.time())
    cutoff = now - NOISE_FLOOR_WINDOW_SECONDS

    samples = [
        {"timestamp": timestamp, "noise_floor_dbm": noise_floor_dbm}
        for timestamp, noise_floor_dbm in _noise_floor_samples
        if timestamp >= cutoff
    ]

    latest = samples[-1] if samples else None
    oldest_timestamp = samples[0]["timestamp"] if samples else None
    coverage_seconds = 0 if oldest_timestamp is None else max(0, now - oldest_timestamp)

    return {
        "sample_interval_seconds": STATS_SAMPLE_INTERVAL_SECONDS,
        "coverage_seconds": coverage_seconds,
        "latest_noise_floor_dbm": latest["noise_floor_dbm"] if latest else None,
        "latest_timestamp": latest["timestamp"] if latest else None,
        "samples": samples,
    }


def get_latest_radio_stats() -> dict[str, Any]:
    """Return the most recent radio stats snapshot."""
    return dict(_latest_stats)
