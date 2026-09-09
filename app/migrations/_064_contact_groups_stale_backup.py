import logging

import aiosqlite

logger = logging.getLogger(__name__)


async def migrate(conn: aiosqlite.Connection) -> None:
    """Contact groups, membership, and opt-in stale-contact purge setting.

    Groups are local-only (no radio sync). ``stale_contact_days`` defaults to 0
    (purge job off).
    """
    tables_cursor = await conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = {row[0] for row in await tables_cursor.fetchall()}

    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS contact_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        )
        """
    )
    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS contact_group_members (
            group_id INTEGER NOT NULL,
            public_key TEXT NOT NULL,
            PRIMARY KEY (group_id, public_key),
            FOREIGN KEY (group_id) REFERENCES contact_groups(id) ON DELETE CASCADE,
            FOREIGN KEY (public_key) REFERENCES contacts(public_key) ON DELETE CASCADE
        )
        """
    )
    await conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_contact_group_members_key
        ON contact_group_members(public_key)
        """
    )

    if "app_settings" in existing_tables:
        col_cursor = await conn.execute("PRAGMA table_info(app_settings)")
        columns = {row[1] for row in await col_cursor.fetchall()}
        if "stale_contact_days" not in columns:
            await conn.execute(
                "ALTER TABLE app_settings ADD COLUMN stale_contact_days INTEGER DEFAULT 0"
            )

    await conn.commit()
    logger.info("Added contact_groups tables and stale_contact_days setting")
