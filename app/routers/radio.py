import asyncio
import logging
import random
import time
from typing import Literal, TypeAlias

from fastapi import APIRouter, HTTPException
from meshcore import EventType
from pydantic import BaseModel, Field

from app.dependencies import require_connected
from app.models import (
    ContactUpsert,
    RadioDiscoveryRequest,
    RadioDiscoveryResponse,
    RadioDiscoveryResult,
)
from app.radio_sync import send_advertisement as do_send_advertisement
from app.radio_sync import sync_radio_time
from app.repository import ContactRepository
from app.services.radio_commands import (
    KeystoreRefreshError,
    PathHashModeUnsupportedError,
    RadioCommandRejectedError,
    apply_radio_config_update,
    import_private_key_and_refresh_keystore,
)
from app.services.radio_runtime import radio_runtime as radio_manager
from app.websocket import broadcast_event, broadcast_health

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/radio", tags=["radio"])

AdvertLocationSource = Literal["off", "current"]
DiscoveryNodeType: TypeAlias = Literal["repeater", "sensor"]
DISCOVERY_WINDOW_SECONDS = 8.0
_DISCOVERY_TARGET_BITS = {
    "repeaters": 1 << 2,
    "sensors": 1 << 4,
    "all": (1 << 2) | (1 << 4),
}
_DISCOVERY_NODE_TYPES: dict[int, DiscoveryNodeType] = {
    2: "repeater",
    4: "sensor",
}


async def _prepare_connected(*, broadcast_on_success: bool) -> bool:
    return await radio_manager.prepare_connected(broadcast_on_success=broadcast_on_success)


async def _reconnect_and_prepare(*, broadcast_on_success: bool) -> bool:
    return await radio_manager.reconnect_and_prepare(
        broadcast_on_success=broadcast_on_success,
    )


class RadioSettings(BaseModel):
    freq: float = Field(description="Frequency in MHz")
    bw: float = Field(description="Bandwidth in kHz")
    sf: int = Field(description="Spreading factor (7-12)")
    cr: int = Field(description="Coding rate (1-4)")


class RadioConfigResponse(BaseModel):
    public_key: str = Field(description="Public key (64-char hex)")
    name: str
    lat: float
    lon: float
    tx_power: int = Field(description="Transmit power in dBm")
    max_tx_power: int = Field(description="Maximum transmit power in dBm")
    radio: RadioSettings
    path_hash_mode: int = Field(
        default=0, description="Path hash mode (0=1-byte, 1=2-byte, 2=3-byte)"
    )
    path_hash_mode_supported: bool = Field(
        default=False, description="Whether firmware supports path hash mode setting"
    )
    advert_location_source: AdvertLocationSource = Field(
        default="current",
        description="Whether adverts include the node's current location state",
    )


class RadioConfigUpdate(BaseModel):
    name: str | None = None
    lat: float | None = None
    lon: float | None = None
    tx_power: int | None = Field(default=None, description="Transmit power in dBm")
    radio: RadioSettings | None = None
    path_hash_mode: int | None = Field(
        default=None,
        ge=0,
        le=2,
        description="Path hash mode (0=1-byte, 1=2-byte, 2=3-byte)",
    )
    advert_location_source: AdvertLocationSource | None = Field(
        default=None,
        description="Whether adverts include the node's current location state",
    )


class PrivateKeyUpdate(BaseModel):
    private_key: str = Field(description="Private key as hex string")


def _monotonic() -> float:
    return time.monotonic()


def _better_signal(first: float | None, second: float | None) -> float | None:
    if first is None:
        return second
    if second is None:
        return first
    return second if second > first else first


def _coerce_float(value: object) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _coerce_int(value: object) -> int | None:
    if isinstance(value, int):
        return value
    return None


def _merge_discovery_result(
    existing: RadioDiscoveryResult | None, event_payload: dict[str, object]
) -> RadioDiscoveryResult | None:
    public_key = event_payload.get("pubkey")
    node_type_code = event_payload.get("node_type")
    if not isinstance(public_key, str) or not public_key:
        return existing
    if not isinstance(node_type_code, int):
        return existing

    node_type = _DISCOVERY_NODE_TYPES.get(node_type_code)
    if node_type is None:
        return existing

    if existing is None:
        return RadioDiscoveryResult(
            public_key=public_key,
            node_type=node_type,
            heard_count=1,
            local_snr=_coerce_float(event_payload.get("SNR")),
            local_rssi=_coerce_int(event_payload.get("RSSI")),
            remote_snr=_coerce_float(event_payload.get("SNR_in")),
        )

    existing.heard_count += 1
    existing.local_snr = _better_signal(existing.local_snr, _coerce_float(event_payload.get("SNR")))
    current_rssi = _coerce_int(event_payload.get("RSSI"))
    if existing.local_rssi is None or (
        current_rssi is not None and current_rssi > existing.local_rssi
    ):
        existing.local_rssi = current_rssi
    existing.remote_snr = _better_signal(
        existing.remote_snr,
        _coerce_float(event_payload.get("SNR_in")),
    )
    return existing


async def _persist_new_discovery_contacts(results: list[RadioDiscoveryResult]) -> None:
    now = int(time.time())
    for result in results:
        existing = await ContactRepository.get_by_key(result.public_key)
        if existing is not None:
            continue

        contact = ContactUpsert(
            public_key=result.public_key,
            type=2 if result.node_type == "repeater" else 4,
            last_seen=now,
            first_seen=now,
            on_radio=False,
        )
        await ContactRepository.upsert(contact)
        created = await ContactRepository.get_by_key(result.public_key)
        if created is not None:
            broadcast_event("contact", created.model_dump())


@router.get("/config", response_model=RadioConfigResponse)
async def get_radio_config() -> RadioConfigResponse:
    """Get the current radio configuration."""
    mc = require_connected()

    info = mc.self_info
    if not info:
        raise HTTPException(status_code=503, detail="Radio info not available")

    adv_loc_policy = info.get("adv_loc_policy", 1)
    advert_location_source: AdvertLocationSource = "off" if adv_loc_policy == 0 else "current"

    return RadioConfigResponse(
        public_key=info.get("public_key", ""),
        name=info.get("name", ""),
        lat=info.get("adv_lat", 0.0),
        lon=info.get("adv_lon", 0.0),
        tx_power=info.get("tx_power", 0),
        max_tx_power=info.get("max_tx_power", 0),
        radio=RadioSettings(
            freq=info.get("radio_freq", 0.0),
            bw=info.get("radio_bw", 0.0),
            sf=info.get("radio_sf", 0),
            cr=info.get("radio_cr", 0),
        ),
        path_hash_mode=radio_manager.path_hash_mode,
        path_hash_mode_supported=radio_manager.path_hash_mode_supported,
        advert_location_source=advert_location_source,
    )


@router.patch("/config", response_model=RadioConfigResponse)
async def update_radio_config(update: RadioConfigUpdate) -> RadioConfigResponse:
    """Update radio configuration. Only provided fields will be updated."""
    require_connected()

    async with radio_manager.radio_operation("update_radio_config") as mc:
        try:
            await apply_radio_config_update(
                mc,
                update,
                path_hash_mode_supported=radio_manager.path_hash_mode_supported,
                set_path_hash_mode=lambda mode: setattr(radio_manager, "path_hash_mode", mode),
                sync_radio_time_fn=sync_radio_time,
            )
        except PathHashModeUnsupportedError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RadioCommandRejectedError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    return await get_radio_config()


@router.put("/private-key")
async def set_private_key(update: PrivateKeyUpdate) -> dict:
    """Set the radio's private key. This is write-only."""
    require_connected()

    try:
        key_bytes = bytes.fromhex(update.private_key)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid hex string for private key") from None

    logger.info("Importing private key")
    async with radio_manager.radio_operation("import_private_key") as mc:
        from app.keystore import export_and_store_private_key

        try:
            await import_private_key_and_refresh_keystore(
                mc,
                key_bytes,
                export_and_store_private_key_fn=export_and_store_private_key,
            )
        except (RadioCommandRejectedError, KeystoreRefreshError) as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"status": "ok"}


@router.post("/advertise")
async def send_advertisement() -> dict:
    """Send a flood advertisement to announce presence on the mesh.

    Manual advertisement requests always send immediately, updating the
    last_advert_time which affects when the next periodic/startup advert
    can occur.

    Returns:
        status: "ok" if sent successfully
    """
    require_connected()

    logger.info("Sending flood advertisement")
    async with radio_manager.radio_operation("manual_advertisement") as mc:
        success = await do_send_advertisement(mc, force=True)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to send advertisement")

    return {"status": "ok"}


@router.post("/discover", response_model=RadioDiscoveryResponse)
async def discover_mesh(request: RadioDiscoveryRequest) -> RadioDiscoveryResponse:
    """Run a short node-discovery sweep from the local radio."""
    require_connected()

    target_bits = _DISCOVERY_TARGET_BITS[request.target]
    tag = random.randint(1, 0xFFFFFFFF)
    tag_hex = tag.to_bytes(4, "little", signed=False).hex()
    events: asyncio.Queue = asyncio.Queue()

    async with radio_manager.radio_operation(
        "discover_mesh",
        pause_polling=True,
        suspend_auto_fetch=True,
    ) as mc:
        subscription = mc.subscribe(
            EventType.DISCOVER_RESPONSE,
            lambda event: events.put_nowait(event),
            {"tag": tag_hex},
        )
        try:
            send_result = await mc.commands.send_node_discover_req(
                target_bits,
                prefix_only=False,
                tag=tag,
            )
            if send_result is None or send_result.type == EventType.ERROR:
                raise HTTPException(status_code=500, detail="Failed to start mesh discovery")

            deadline = _monotonic() + DISCOVERY_WINDOW_SECONDS
            results_by_key: dict[str, RadioDiscoveryResult] = {}

            while True:
                remaining = deadline - _monotonic()
                if remaining <= 0:
                    break
                try:
                    event = await asyncio.wait_for(events.get(), timeout=remaining)
                except asyncio.TimeoutError:
                    break

                merged = _merge_discovery_result(
                    results_by_key.get(event.payload.get("pubkey")),
                    event.payload,
                )
                if merged is not None:
                    results_by_key[merged.public_key] = merged
        finally:
            subscription.unsubscribe()

    results = sorted(
        results_by_key.values(),
        key=lambda item: (
            item.node_type,
            -(item.local_snr if item.local_snr is not None else -999.0),
            item.public_key,
        ),
    )
    await _persist_new_discovery_contacts(results)
    return RadioDiscoveryResponse(
        target=request.target,
        duration_seconds=DISCOVERY_WINDOW_SECONDS,
        results=results,
    )


async def _attempt_reconnect() -> dict:
    """Shared reconnection logic for reboot and reconnect endpoints."""
    radio_manager.resume_connection()

    if radio_manager.is_reconnecting:
        return {
            "status": "pending",
            "message": "Reconnection already in progress",
            "connected": False,
        }

    try:
        success = await _reconnect_and_prepare(broadcast_on_success=True)
    except Exception as e:
        logger.exception("Post-connect setup failed after reconnect")
        raise HTTPException(
            status_code=503,
            detail=f"Radio connected but setup failed: {e}",
        ) from e

    if not success:
        raise HTTPException(
            status_code=503, detail="Failed to reconnect. Check radio connection and power."
        )

    return {"status": "ok", "message": "Reconnected successfully", "connected": True}


@router.post("/disconnect")
async def disconnect_radio() -> dict:
    """Disconnect from the radio and pause automatic reconnect attempts."""
    logger.info("Manual radio disconnect requested")
    await radio_manager.pause_connection()
    broadcast_health(False, radio_manager.connection_info)
    return {
        "status": "ok",
        "message": "Disconnected. Automatic reconnect is paused.",
        "connected": False,
        "paused": True,
    }


@router.post("/reboot")
async def reboot_radio() -> dict:
    """Reboot the radio, or reconnect if not currently connected.

    If connected: sends reboot command, connection will temporarily drop and auto-reconnect.
    If not connected: attempts to reconnect (same as /reconnect endpoint).
    """
    if radio_manager.is_connected:
        logger.info("Rebooting radio")
        async with radio_manager.radio_operation("reboot_radio") as mc:
            await mc.commands.reboot()
        return {
            "status": "ok",
            "message": "Reboot command sent. Radio will reconnect automatically.",
        }

    logger.info("Radio not connected, attempting reconnect")
    return await _attempt_reconnect()


@router.post("/reconnect")
async def reconnect_radio() -> dict:
    """Attempt to reconnect to the radio.

    This will try to re-establish connection to the radio, with auto-detection
    if no specific port is configured. Useful when the radio has been disconnected
    or power-cycled.
    """
    if radio_manager.is_connected:
        if radio_manager.is_setup_complete:
            return {"status": "ok", "message": "Already connected", "connected": True}

        logger.info("Radio connected but setup incomplete, retrying setup")
        try:
            if not await _prepare_connected(broadcast_on_success=True):
                raise HTTPException(status_code=503, detail="Radio connection is paused")
            return {"status": "ok", "message": "Setup completed", "connected": True}
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Post-connect setup failed")
            raise HTTPException(
                status_code=503,
                detail=f"Radio connected but setup failed: {e}",
            ) from e

    logger.info("Manual reconnect requested")
    return await _attempt_reconnect()
