import logging

import aiosqlite

logger = logging.getLogger(__name__)

_COLUMNS: tuple[tuple[str, str], ...] = (
    ("radio_transport", "TEXT"),
    ("radio_serial_port", "TEXT DEFAULT ''"),
    ("radio_serial_baudrate", "INTEGER DEFAULT 115200"),
    ("radio_tcp_host", "TEXT DEFAULT ''"),
    ("radio_tcp_port", "INTEGER DEFAULT 5000"),
    ("radio_ble_address", "TEXT DEFAULT ''"),
    ("radio_ble_pin", "TEXT DEFAULT ''"),
    ("radio_bound_public_key", "TEXT"),
    ("radio_identity_state", "TEXT"),
    ("radio_previous_transport", "TEXT"),
    ("radio_mismatch_previous_public_key", "TEXT"),
    ("radio_mismatch_new_public_key", "TEXT"),
    ("radio_mismatch_new_name", "TEXT"),
    ("radio_transport_env_imported", "INTEGER DEFAULT 0"),
)


async def migrate(conn: aiosqlite.Connection) -> None:
    """Persist UX-owned radio transport and identity binding on app_settings."""
    tables_cursor = await conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = {row[0] for row in await tables_cursor.fetchall()}
    if "app_settings" not in tables:
        return

    col_cursor = await conn.execute("PRAGMA table_info(app_settings)")
    columns = {row[1] for row in await col_cursor.fetchall()}
    added: list[str] = []
    for name, definition in _COLUMNS:
        if name in columns:
            continue
        await conn.execute(f"ALTER TABLE app_settings ADD COLUMN {name} {definition}")
        added.append(name)
    await conn.commit()
    if added:
        logger.info("Added app_settings radio transport columns: %s", ", ".join(added))
