import logging

import aiosqlite

logger = logging.getLogger(__name__)


async def migrate(conn: aiosqlite.Connection) -> None:
    """Add VAPID key columns and push_subscriptions table for Web Push."""

    # VAPID key pair stored in app_settings (one per instance)
    table_check = await conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'"
    )
    if await table_check.fetchone():
        cursor = await conn.execute("PRAGMA table_info(app_settings)")
        columns = {row[1] for row in await cursor.fetchall()}

        if "vapid_private_key" not in columns:
            await conn.execute(
                "ALTER TABLE app_settings ADD COLUMN vapid_private_key TEXT DEFAULT ''"
            )
        if "vapid_public_key" not in columns:
            await conn.execute(
                "ALTER TABLE app_settings ADD COLUMN vapid_public_key TEXT DEFAULT ''"
            )

    # Push subscriptions — one row per browser
    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id TEXT PRIMARY KEY,
            endpoint TEXT NOT NULL,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            label TEXT NOT NULL DEFAULT '',
            filter_mode TEXT NOT NULL DEFAULT 'all_messages',
            filter_conversations TEXT NOT NULL DEFAULT '[]',
            created_at INTEGER NOT NULL,
            last_success_at INTEGER,
            failure_count INTEGER DEFAULT 0,
            UNIQUE(endpoint)
        )
        """
    )

    await conn.commit()
