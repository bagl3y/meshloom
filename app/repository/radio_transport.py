"""Radio transport + identity binding stored in app_settings.

Not part of ``AppSettings`` / GET /settings so the BLE PIN is not leaked
through generic settings or JSON backup. The full SQLite backup still
contains the PIN.
"""

from __future__ import annotations

import json
import logging

import aiosqlite

from app.database import db
from app.models import RadioIdentityState, RadioTransportKind, RadioTransportSnapshot

logger = logging.getLogger(__name__)

_TRANSPORT_COLUMNS = (
    "radio_transport",
    "radio_serial_port",
    "radio_serial_baudrate",
    "radio_tcp_host",
    "radio_tcp_port",
    "radio_ble_address",
    "radio_ble_pin",
    "radio_bound_public_key",
    "radio_identity_state",
    "radio_previous_transport",
    "radio_mismatch_previous_public_key",
    "radio_mismatch_new_public_key",
    "radio_mismatch_new_name",
    "radio_transport_env_imported",
)


def snapshot_public_dict(snapshot: RadioTransportSnapshot) -> dict[str, object]:
    """JSON-safe previous-transport snapshot without the BLE PIN."""
    return {
        "transport": snapshot.transport,
        "serial_port": snapshot.serial_port,
        "serial_baudrate": snapshot.serial_baudrate,
        "tcp_host": snapshot.tcp_host,
        "tcp_port": snapshot.tcp_port,
        "ble_address": snapshot.ble_address,
    }


def snapshot_restore_dict(snapshot: RadioTransportSnapshot) -> dict[str, object]:
    """Internal previous-transport snapshot used to restore a rejected change.

    Includes the BLE PIN so a BLE→other→reject cycle remains usable. Never
    return this dict from an API response.
    """
    restored = snapshot_public_dict(snapshot)
    restored["ble_pin"] = snapshot.ble_pin
    return restored


def validate_transport_update(
    transport: RadioTransportKind,
    *,
    serial_port: str | None = None,
    tcp_host: str | None = None,
    ble_address: str | None = None,
    ble_pin: str | None = None,
) -> None:
    """Raise ValueError when the selected transport is missing required fields."""
    if transport == "tcp" and not (tcp_host or "").strip():
        raise ValueError("tcp_host is required when transport is tcp")
    if transport == "ble":
        if not (ble_address or "").strip():
            raise ValueError("ble_address is required when transport is ble")
        if not (ble_pin or "").strip():
            raise ValueError("ble_pin is required when transport is ble")
    if transport == "serial":
        _ = serial_port


def _parse_previous_transport(raw: object) -> dict[str, object] | None:
    if not raw:
        return None
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return None
        return parsed if isinstance(parsed, dict) else None
    return None


def _row_to_snapshot(row: aiosqlite.Row | None) -> RadioTransportSnapshot:
    if row is None:
        return RadioTransportSnapshot()
    keys = set(row.keys())
    transport_raw = row["radio_transport"] if "radio_transport" in keys else None
    transport: RadioTransportKind | None = None
    if transport_raw in ("serial", "tcp", "ble"):
        transport = transport_raw
    identity_raw = row["radio_identity_state"] if "radio_identity_state" in keys else None
    identity_state: RadioIdentityState | None = None
    if identity_raw in ("identity_mismatch", "identity_unbound_legacy"):
        identity_state = identity_raw
    return RadioTransportSnapshot(
        transport=transport,
        serial_port=str(row["radio_serial_port"] or "") if "radio_serial_port" in keys else "",
        serial_baudrate=int(row["radio_serial_baudrate"] or 115200)
        if "radio_serial_baudrate" in keys
        else 115200,
        tcp_host=str(row["radio_tcp_host"] or "") if "radio_tcp_host" in keys else "",
        tcp_port=int(row["radio_tcp_port"] or 5000) if "radio_tcp_port" in keys else 5000,
        ble_address=str(row["radio_ble_address"] or "") if "radio_ble_address" in keys else "",
        ble_pin=str(row["radio_ble_pin"] or "") if "radio_ble_pin" in keys else "",
        bound_public_key=(
            str(row["radio_bound_public_key"]) if row["radio_bound_public_key"] else None
        )
        if "radio_bound_public_key" in keys
        else None,
        identity_state=identity_state,
        previous_transport=_parse_previous_transport(
            row["radio_previous_transport"] if "radio_previous_transport" in keys else None
        ),
        mismatch_previous_public_key=(
            str(row["radio_mismatch_previous_public_key"])
            if row["radio_mismatch_previous_public_key"]
            else None
        )
        if "radio_mismatch_previous_public_key" in keys
        else None,
        mismatch_new_public_key=(
            str(row["radio_mismatch_new_public_key"])
            if row["radio_mismatch_new_public_key"]
            else None
        )
        if "radio_mismatch_new_public_key" in keys
        else None,
        mismatch_new_name=(
            str(row["radio_mismatch_new_name"]) if row["radio_mismatch_new_name"] else None
        )
        if "radio_mismatch_new_name" in keys
        else None,
        env_imported=bool(row["radio_transport_env_imported"])
        if "radio_transport_env_imported" in keys
        else False,
    )


class RadioTransportRepository:
    """Concrete SQLite access for UX-owned radio transport."""

    @staticmethod
    async def _get_in_conn(conn: aiosqlite.Connection) -> RadioTransportSnapshot:
        columns = ", ".join(_TRANSPORT_COLUMNS)
        try:
            async with conn.execute(f"SELECT {columns} FROM app_settings WHERE id = 1") as cursor:
                row = await cursor.fetchone()
        except aiosqlite.OperationalError:
            logger.debug("Radio transport columns not ready yet")
            return RadioTransportSnapshot()
        return _row_to_snapshot(row)

    @staticmethod
    async def get() -> RadioTransportSnapshot:
        async with db.readonly() as conn:
            return await RadioTransportRepository._get_in_conn(conn)

    @staticmethod
    async def _save_in_conn(
        conn: aiosqlite.Connection, snapshot: RadioTransportSnapshot
    ) -> RadioTransportSnapshot:
        previous = json.dumps(snapshot.previous_transport) if snapshot.previous_transport else None
        await conn.execute(
            """
            UPDATE app_settings SET
                radio_transport = ?,
                radio_serial_port = ?,
                radio_serial_baudrate = ?,
                radio_tcp_host = ?,
                radio_tcp_port = ?,
                radio_ble_address = ?,
                radio_ble_pin = ?,
                radio_bound_public_key = ?,
                radio_identity_state = ?,
                radio_previous_transport = ?,
                radio_mismatch_previous_public_key = ?,
                radio_mismatch_new_public_key = ?,
                radio_mismatch_new_name = ?,
                radio_transport_env_imported = ?
            WHERE id = 1
            """,
            (
                snapshot.transport,
                snapshot.serial_port,
                snapshot.serial_baudrate,
                snapshot.tcp_host,
                snapshot.tcp_port,
                snapshot.ble_address,
                snapshot.ble_pin,
                snapshot.bound_public_key,
                snapshot.identity_state,
                previous,
                snapshot.mismatch_previous_public_key,
                snapshot.mismatch_new_public_key,
                snapshot.mismatch_new_name,
                1 if snapshot.env_imported else 0,
            ),
        )
        return snapshot

    @staticmethod
    async def save(snapshot: RadioTransportSnapshot) -> RadioTransportSnapshot:
        async with db.tx() as conn:
            return await RadioTransportRepository._save_in_conn(conn, snapshot)

    @staticmethod
    async def clear_identity_gate() -> RadioTransportSnapshot:
        async with db.tx() as conn:
            current = await RadioTransportRepository._get_in_conn(conn)
            current.identity_state = None
            current.previous_transport = None
            current.mismatch_previous_public_key = None
            current.mismatch_new_public_key = None
            current.mismatch_new_name = None
            return await RadioTransportRepository._save_in_conn(conn, current)

    @staticmethod
    async def bind_public_key(public_key: str) -> RadioTransportSnapshot:
        key = public_key.strip().lower()
        async with db.tx() as conn:
            current = await RadioTransportRepository._get_in_conn(conn)
            current.bound_public_key = key
            current.identity_state = None
            current.previous_transport = None
            current.mismatch_previous_public_key = None
            current.mismatch_new_public_key = None
            current.mismatch_new_name = None
            return await RadioTransportRepository._save_in_conn(conn, current)

    @staticmethod
    async def set_identity_gate(
        *,
        state: RadioIdentityState,
        previous_public_key: str | None = None,
        new_public_key: str | None = None,
        new_name: str | None = None,
        previous_transport: dict[str, object] | None = None,
    ) -> RadioTransportSnapshot:
        async with db.tx() as conn:
            current = await RadioTransportRepository._get_in_conn(conn)
            current.identity_state = state
            current.mismatch_previous_public_key = previous_public_key
            current.mismatch_new_public_key = new_public_key
            current.mismatch_new_name = new_name
            current.previous_transport = previous_transport
            return await RadioTransportRepository._save_in_conn(conn, current)

    @staticmethod
    async def mark_env_imported() -> None:
        async with db.tx() as conn:
            current = await RadioTransportRepository._get_in_conn(conn)
            current.env_imported = True
            await RadioTransportRepository._save_in_conn(conn, current)


def apply_saved_transport(
    current: RadioTransportSnapshot,
    *,
    transport: RadioTransportKind,
    serial_port: str | None = None,
    serial_baudrate: int | None = None,
    tcp_host: str | None = None,
    tcp_port: int | None = None,
    ble_address: str | None = None,
    ble_pin: str | None = None,
) -> RadioTransportSnapshot:
    """Build the next snapshot for a PUT, preserving PIN when omitted."""
    validate_transport_update(
        transport,
        serial_port=serial_port,
        tcp_host=tcp_host,
        ble_address=ble_address,
        ble_pin=ble_pin if ble_pin is not None else current.ble_pin,
    )
    next_snapshot = current.model_copy(deep=True)
    next_snapshot.transport = transport
    if transport == "serial":
        next_snapshot.serial_port = (serial_port or "").strip()
        if serial_baudrate is not None:
            next_snapshot.serial_baudrate = serial_baudrate
        next_snapshot.tcp_host = ""
        next_snapshot.ble_address = ""
        next_snapshot.ble_pin = ""
    elif transport == "tcp":
        next_snapshot.tcp_host = (tcp_host or "").strip()
        if tcp_port is not None:
            next_snapshot.tcp_port = tcp_port
        next_snapshot.serial_port = ""
        next_snapshot.ble_address = ""
        next_snapshot.ble_pin = ""
    else:
        next_snapshot.ble_address = (ble_address or "").strip()
        if ble_pin is not None:
            next_snapshot.ble_pin = ble_pin.strip()
        next_snapshot.serial_port = ""
        next_snapshot.tcp_host = ""
    return next_snapshot
