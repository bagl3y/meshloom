import logging

import aiosqlite

logger = logging.getLogger(__name__)


async def migrate(conn: aiosqlite.Connection) -> None:
    """Persist the UI language for each Web Push subscription."""
    tables_cursor = await conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = {row[0] for row in await tables_cursor.fetchall()}
    if "push_subscriptions" not in tables:
        return

    col_cursor = await conn.execute("PRAGMA table_info(push_subscriptions)")
    columns = {row[1] for row in await col_cursor.fetchall()}
    if "language" not in columns:
        await conn.execute(
            "ALTER TABLE push_subscriptions ADD COLUMN language TEXT NOT NULL DEFAULT 'fr'"
        )
    await conn.commit()
    logger.info("Added push_subscriptions.language")
