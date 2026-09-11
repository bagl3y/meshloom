"""Runtime access to the UX-owned radio transport snapshot."""

from __future__ import annotations

import asyncio
import logging
import os

from app.models import RadioTransportKind, RadioTransportSnapshot
from app.repository.radio_transport import RadioTransportRepository

logger = logging.getLogger(__name__)

_ENV_SERIAL_PORT = "MESHCORE_SERIAL_PORT"
_ENV_SERIAL_BAUD = "MESHCORE_SERIAL_BAUDRATE"
_ENV_TCP_HOST = "MESHCORE_TCP_HOST"
_ENV_TCP_PORT = "MESHCORE_TCP_PORT"
_ENV_BLE_ADDRESS = "MESHCORE_BLE_ADDRESS"
_ENV_BLE_PIN = "MESHCORE_BLE_PIN"


def _env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def _legacy_env_transport() -> RadioTransportSnapshot | None:
    serial_port = _env(_ENV_SERIAL_PORT)
    tcp_host = _env(_ENV_TCP_HOST)
    ble_address = _env(_ENV_BLE_ADDRESS)
    set_count = sum(bool(v) for v in (serial_port, tcp_host, ble_address))
    if set_count == 0:
        return None
    if set_count > 1:
        logger.warning("Ignoring leftover MESHCORE transport env vars: more than one family is set")
        return None
    baud_raw = _env(_ENV_SERIAL_BAUD)
    tcp_port_raw = _env(_ENV_TCP_PORT)
    ble_pin = _env(_ENV_BLE_PIN)
    try:
        baud = int(baud_raw) if baud_raw else 115200
    except ValueError:
        baud = 115200
    try:
        tcp_port = int(tcp_port_raw) if tcp_port_raw else 5000
    except ValueError:
        tcp_port = 5000
    if serial_port:
        return RadioTransportSnapshot(
            transport="serial", serial_port=serial_port, serial_baudrate=baud
        )
    if tcp_host:
        return RadioTransportSnapshot(transport="tcp", tcp_host=tcp_host, tcp_port=tcp_port)
    return RadioTransportSnapshot(transport="ble", ble_address=ble_address, ble_pin=ble_pin)


async def database_has_mesh_history() -> bool:
    """True when the DB already holds identity-bound mesh rows (not default channels)."""
    from app.database import db

    async with db.readonly() as conn:
        for table in (
            "contacts",
            "messages",
            "raw_packets",
            "repeater_telemetry_history",
            "contact_telemetry_history",
            "contact_groups",
        ):
            try:
                async with conn.execute(f"SELECT 1 FROM {table} LIMIT 1") as cursor:
                    if await cursor.fetchone() is not None:
                        return True
            except Exception:
                continue
    return False


async def maybe_import_legacy_env(*, existing_database: bool) -> RadioTransportSnapshot:
    """One-shot copy of leftover MESHCORE_* transport env into the DB.

    New databases ignore leftover env. Existing DBs import only when transport
    is empty and the import marker is unset. After that the env vars are never
    read again.
    """
    current = await RadioTransportRepository.get()
    if current.env_imported:
        return current
    if current.configured:
        await RadioTransportRepository.mark_env_imported()
        return await RadioTransportRepository.get()
    if not existing_database:
        await RadioTransportRepository.mark_env_imported()
        logger.info("New database: leftover MESHCORE transport env vars are ignored")
        return await RadioTransportRepository.get()
    imported = _legacy_env_transport()
    if imported is None:
        await RadioTransportRepository.mark_env_imported()
        return await RadioTransportRepository.get()
    imported.env_imported = True
    saved = await RadioTransportRepository.save(imported)
    logger.warning(
        "Imported leftover MESHCORE transport env (%s) into app_settings; "
        "these variables are no longer read",
        saved.transport,
    )
    return saved


async def get_transport() -> RadioTransportSnapshot:
    return await RadioTransportRepository.get()


def connection_type_of(snapshot: RadioTransportSnapshot) -> RadioTransportKind:
    return snapshot.connection_type


def is_tcp(snapshot: RadioTransportSnapshot | None = None) -> bool:
    if snapshot is None:
        return False
    return snapshot.transport == "tcp" or (
        snapshot.transport is None and snapshot.connection_type == "tcp"
    )


async def probe_serial_ports() -> list[tuple[str, str]]:
    """Return (path, description) for visible serial devices. Never raises."""
    from app.radio import detect_serial_devices

    ports: list[tuple[str, str]] = []
    seen: set[str] = set()
    try:
        from serial.tools import list_ports

        for item in list_ports.comports():
            path = getattr(item, "device", None) or ""
            if not path or path in seen:
                continue
            seen.add(path)
            ports.append((path, getattr(item, "description", "") or ""))
    except Exception:
        logger.debug("pyserial list_ports failed", exc_info=True)
    try:
        for path in detect_serial_devices():
            if path in seen:
                continue
            seen.add(path)
            ports.append((path, ""))
    except Exception:
        logger.debug("detect_serial_devices failed", exc_info=True)
    return ports


async def probe_ble_available() -> tuple[bool, str | None]:
    """Return (available, reason). Timeout-bounded, never on the health path."""
    try:
        from bleak import BleakScanner
    except Exception:
        return False, "BLE stack (bleak) is not available in this process"
    try:
        devices = await asyncio.wait_for(BleakScanner.discover(timeout=2.0), timeout=4.0)
    except TimeoutError:
        return False, "BLE scan timed out"
    except Exception as exc:
        return False, str(exc) or "No Bluetooth adapter"
    if devices:
        return True, None
    return True, None


async def scan_ble_devices() -> list[tuple[str, str | None]]:
    available, reason = await probe_ble_available()
    if not available:
        raise RuntimeError(reason or "BLE is not available")
    from bleak import BleakScanner

    devices = await asyncio.wait_for(BleakScanner.discover(timeout=5.0), timeout=8.0)
    found: list[tuple[str, str | None]] = []
    for device in devices:
        address = getattr(device, "address", None)
        if not address:
            continue
        name = getattr(device, "name", None)
        found.append((str(address), str(name) if name else None))
    return found


async def build_transport_response():
    from app.models import (
        RadioSerialPortInfo,
        RadioTransportCapabilities,
        RadioTransportResponse,
    )

    snapshot = await get_transport()
    serial_ports = await probe_serial_ports()
    ble_ok, ble_reason = await probe_ble_available()
    serial_ok = bool(serial_ports) or snapshot.transport == "serial"
    serial_reason = None
    if not serial_ports:
        serial_reason = "No serial ports are visible. On Docker, map the device in Compose."
    return RadioTransportResponse(
        configured=snapshot.configured,
        transport=snapshot.transport,
        serial_port=snapshot.serial_port,
        serial_baudrate=snapshot.serial_baudrate,
        tcp_host=snapshot.tcp_host,
        tcp_port=snapshot.tcp_port,
        ble_address=snapshot.ble_address,
        ble_pin_configured=bool(snapshot.ble_pin),
        bound_public_key=snapshot.bound_public_key,
        capabilities=RadioTransportCapabilities(
            tcp=True,
            serial=serial_ok,
            ble=ble_ok,
            serial_unavailable_reason=serial_reason if not serial_ports else None,
            ble_unavailable_reason=None if ble_ok else ble_reason,
        ),
        serial_ports=[
            RadioSerialPortInfo(path=path, description=desc) for path, desc in serial_ports
        ],
    )
