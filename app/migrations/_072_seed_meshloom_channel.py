import logging

import aiosqlite

logger = logging.getLogger(__name__)

MESHLOOM_CHANNEL_KEY = "D8F3E005453E56988DE0A853348640F7"


async def migrate(conn: aiosqlite.Connection) -> None:
    """Seed #meshloom for databases that already ran the old #remoteterm 033 seed."""
    try:
        await conn.execute(
            "INSERT OR IGNORE INTO channels (key, name, is_hashtag, on_radio) VALUES (?, ?, ?, ?)",
            (MESHLOOM_CHANNEL_KEY, "#meshloom", 1, 0),
        )
        await conn.commit()
    except Exception:
        logger.debug("Skipping #meshloom seed (channels table not ready)")
