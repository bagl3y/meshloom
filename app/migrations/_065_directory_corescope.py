import logging

import aiosqlite

logger = logging.getLogger(__name__)


async def migrate(conn: aiosqlite.Connection) -> None:
    """Opt-in CoreScope directory settings and hop-resolution cache.

    ``directory_enabled`` defaults to 0 (off). ``directory_url`` is empty until
    the operator pastes an instance origin. The cache is directory-only and
    never writes RF contacts.
    """
    tables_cursor = await conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = {row[0] for row in await tables_cursor.fetchall()}

    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS directory_hop_cache (
            prefix TEXT NOT NULL,
            hash_width INTEGER NOT NULL,
            name TEXT,
            source TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            PRIMARY KEY (prefix, hash_width)
        )
        """
    )

    if "app_settings" in existing_tables:
        col_cursor = await conn.execute("PRAGMA table_info(app_settings)")
        columns = {row[1] for row in await col_cursor.fetchall()}
        if "directory_enabled" not in columns:
            await conn.execute(
                "ALTER TABLE app_settings ADD COLUMN directory_enabled INTEGER DEFAULT 0"
            )
        if "directory_url" not in columns:
            await conn.execute("ALTER TABLE app_settings ADD COLUMN directory_url TEXT DEFAULT ''")

    await conn.commit()
    logger.info("Added directory_hop_cache and CoreScope directory settings")
