import json
import logging

import aiosqlite

logger = logging.getLogger(__name__)

_DEFAULT_PUSH_DEFAULTS = {
    "new_contact": True,
    "new_dm": True,
    "advert_repeater": True,
    "advert_companion": True,
    "advert_sensor": True,
}

_DEFAULT_PUSH_DEFAULTS_JSON = json.dumps(_DEFAULT_PUSH_DEFAULTS)


async def migrate(conn: aiosqlite.Connection) -> None:
    """Add push notification defaults, per-conversation overrides, and VAPID subject.

    Existing ``push_conversations`` list entries become explicit ``true`` overrides.
    The list column is kept for Vague B API compatibility.
    """
    tables_cursor = await conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = {row[0] for row in await tables_cursor.fetchall()}
    if "app_settings" not in existing_tables:
        await conn.commit()
        return

    col_cursor = await conn.execute("PRAGMA table_info(app_settings)")
    columns = {row[1] for row in await col_cursor.fetchall()}
    additions = (
        ("push_defaults", f"TEXT DEFAULT '{_DEFAULT_PUSH_DEFAULTS_JSON}'"),
        ("push_conversation_overrides", "TEXT DEFAULT '{}'"),
        ("vapid_subject", "TEXT DEFAULT ''"),
    )
    for name, decl in additions:
        if name not in columns:
            await conn.execute(f"ALTER TABLE app_settings ADD COLUMN {name} {decl}")

    had_push_conversations = "push_conversations" in columns
    select_cols = "push_conversation_overrides"
    if had_push_conversations:
        select_cols = "push_conversations, push_conversation_overrides"

    row = await (
        await conn.execute(f"SELECT {select_cols} FROM app_settings WHERE id = 1")
    ).fetchone()

    overrides: dict[str, bool] = {}
    conversations: list[str] = []
    if row is not None:
        raw_overrides = row["push_conversation_overrides"]
        if raw_overrides:
            try:
                parsed = json.loads(raw_overrides)
                if isinstance(parsed, dict):
                    overrides = {
                        str(key): bool(value)
                        for key, value in parsed.items()
                        if isinstance(key, str)
                    }
            except (json.JSONDecodeError, TypeError):
                overrides = {}
        if had_push_conversations:
            raw_conversations = row["push_conversations"]
            if raw_conversations:
                try:
                    parsed = json.loads(raw_conversations)
                    if isinstance(parsed, list):
                        conversations = [str(item) for item in parsed if isinstance(item, str)]
                except (json.JSONDecodeError, TypeError, KeyError):
                    conversations = []

    for key in conversations:
        if key not in overrides:
            overrides[key] = True

    await conn.execute(
        """
        UPDATE app_settings SET
            push_defaults = COALESCE(NULLIF(push_defaults, ''), ?),
            push_conversation_overrides = ?,
            vapid_subject = COALESCE(vapid_subject, '')
        WHERE id = 1
        """,
        (_DEFAULT_PUSH_DEFAULTS_JSON, json.dumps(overrides)),
    )

    await conn.commit()
    logger.info("Added push notification defaults, conversation overrides, and VAPID subject")
