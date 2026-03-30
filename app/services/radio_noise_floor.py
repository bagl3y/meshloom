"""In-memory local-radio noise floor history sampling."""

import asyncio
import logging
import time
from collections import deque

from meshcore import EventType

from app.radio import RadioDisconnectedError, RadioOperationBusyError
from app.services.radio_runtime import radio_runtime as radio_manager

logger = logging.getLogger(__name__)

NOISE_FLOOR_SAMPLE_INTERVAL_SECONDS = 300
NOISE_FLOOR_WINDOW_SECONDS = 24 * 60 * 60
MAX_NOISE_FLOOR_SAMPLES = 300

_noise_floor_task: asyncio.Task | None = None
_noise_floor_samples: deque[tuple[int, int]] = deque(maxlen=MAX_NOISE_FLOOR_SAMPLES)
_noise_floor_supported: bool | None = None
_samples_lock = asyncio.Lock()


async def _append_sample(timestamp: int, noise_floor_dbm: int) -> None:
    async with _samples_lock:
        _noise_floor_samples.append((timestamp, noise_floor_dbm))


async def sample_noise_floor_once(*, blocking: bool = False) -> None:
    """Fetch the current radio noise floor once and record it when available."""
    global _noise_floor_supported

    if not radio_manager.is_connected:
        return

    try:
        async with radio_manager.radio_operation("noise_floor_sample", blocking=blocking) as mc:
            event = await mc.commands.get_stats_radio()
    except (RadioDisconnectedError, RadioOperationBusyError):
        return
    except Exception as exc:
        logger.debug("Noise floor sampling failed: %s", exc)
        return

    if event.type == EventType.ERROR:
        _noise_floor_supported = False
        return

    if event.type != EventType.STATS_RADIO:
        return

    noise_floor = event.payload.get("noise_floor")
    if not isinstance(noise_floor, int):
        return

    _noise_floor_supported = True
    await _append_sample(int(time.time()), noise_floor)


async def _noise_floor_sampling_loop() -> None:
    while True:
        await sample_noise_floor_once()
        await asyncio.sleep(NOISE_FLOOR_SAMPLE_INTERVAL_SECONDS)


async def start_noise_floor_sampling() -> None:
    global _noise_floor_task
    if _noise_floor_task is not None and not _noise_floor_task.done():
        return
    _noise_floor_task = asyncio.create_task(_noise_floor_sampling_loop())


async def stop_noise_floor_sampling() -> None:
    global _noise_floor_task
    if _noise_floor_task is None:
        return
    if not _noise_floor_task.done():
        _noise_floor_task.cancel()
        try:
            await _noise_floor_task
        except asyncio.CancelledError:
            pass
    _noise_floor_task = None


async def get_noise_floor_history() -> dict:
    """Return the current 24-hour in-memory noise floor history snapshot."""
    await sample_noise_floor_once(blocking=False)

    now = int(time.time())
    cutoff = now - NOISE_FLOOR_WINDOW_SECONDS

    async with _samples_lock:
        samples = [
            {"timestamp": timestamp, "noise_floor_dbm": noise_floor_dbm}
            for timestamp, noise_floor_dbm in _noise_floor_samples
            if timestamp >= cutoff
        ]

    latest = samples[-1] if samples else None
    oldest_timestamp = samples[0]["timestamp"] if samples else None
    coverage_seconds = 0 if oldest_timestamp is None else max(0, now - oldest_timestamp)

    return {
        "sample_interval_seconds": NOISE_FLOOR_SAMPLE_INTERVAL_SECONDS,
        "coverage_seconds": coverage_seconds,
        "latest_noise_floor_dbm": latest["noise_floor_dbm"] if latest else None,
        "latest_timestamp": latest["timestamp"] if latest else None,
        "supported": _noise_floor_supported,
        "samples": samples,
    }
