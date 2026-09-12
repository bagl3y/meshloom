import logging

import aiosqlite

logger = logging.getLogger(__name__)


async def migrate(conn: aiosqlite.Connection) -> None:
    """Meshloom Stats community columns. Existing rows stay opted out (enabled=0)."""
    tables_cursor = await conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = {row[0] for row in await tables_cursor.fetchall()}
    if "app_settings" not in existing_tables:
        await conn.commit()
        return

    col_cursor = await conn.execute("PRAGMA table_info(app_settings)")
    columns = {row[1] for row in await col_cursor.fetchall()}
    additions = (
        ("community_enabled", "INTEGER DEFAULT 0"),
        ("community_iata", "TEXT DEFAULT ''"),
        ("community_broker_host", "TEXT DEFAULT ''"),
        ("community_api_base", "TEXT DEFAULT ''"),
    )
    for name, decl in additions:
        if name not in columns:
            await conn.execute(f"ALTER TABLE app_settings ADD COLUMN {name} {decl}")

    await conn.commit()
    logger.info("Added Meshloom Stats community settings columns")
