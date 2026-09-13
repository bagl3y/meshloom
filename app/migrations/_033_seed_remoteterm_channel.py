import logging

import aiosqlite

logger = logging.getLogger(__name__)


async def migrate(conn: aiosqlite.Connection) -> None:
    """Seed the #meshloom hashtag channel so new installs have it by default.

    Uses INSERT OR IGNORE so it's a no-op if the channel already exists
    (e.g. existing users who already added it manually). The channels table
    is created by the base schema before migrations run, so it always exists
    in production.
    """
    try:
        await conn.execute(
            "INSERT OR IGNORE INTO channels (key, name, is_hashtag, on_radio) VALUES (?, ?, ?, ?)",
            ("D8F3E005453E56988DE0A853348640F7", "#meshloom", 1, 0),
        )
        await conn.commit()
    except Exception:
        logger.debug("Skipping #meshloom seed (channels table not ready)")
