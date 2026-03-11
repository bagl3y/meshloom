import json
import time
from typing import Any

from app.database import db
from app.models import Message, MessagePath


class MessageRepository:
    @staticmethod
    def _parse_paths(paths_json: str | None) -> list[MessagePath] | None:
        """Parse paths JSON string to list of MessagePath objects."""
        if not paths_json:
            return None
        try:
            paths_data = json.loads(paths_json)
            return [MessagePath(**p) for p in paths_data]
        except (json.JSONDecodeError, TypeError, KeyError, ValueError):
            return None

    @staticmethod
    async def create(
        msg_type: str,
        text: str,
        received_at: int,
        conversation_key: str,
        sender_timestamp: int | None = None,
        path: str | None = None,
        path_len: int | None = None,
        txt_type: int = 0,
        signature: str | None = None,
        outgoing: bool = False,
        sender_name: str | None = None,
        sender_key: str | None = None,
    ) -> int | None:
        """Create a message, returning the ID or None if duplicate.

        Uses INSERT OR IGNORE to handle the UNIQUE constraint on
        (type, conversation_key, text, sender_timestamp). This prevents
        duplicate messages when the same message arrives via multiple RF paths.

        The path parameter is converted to the paths JSON array format.
        """
        # Convert single path to paths array format
        paths_json = None
        if path is not None:
            entry: dict = {"path": path, "received_at": received_at}
            if path_len is not None:
                entry["path_len"] = path_len
            paths_json = json.dumps([entry])

        cursor = await db.conn.execute(
            """
            INSERT OR IGNORE INTO messages (type, conversation_key, text, sender_timestamp,
                                            received_at, paths, txt_type, signature, outgoing,
                                            sender_name, sender_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                msg_type,
                conversation_key,
                text,
                sender_timestamp,
                received_at,
                paths_json,
                txt_type,
                signature,
                outgoing,
                sender_name,
                sender_key,
            ),
        )
        await db.conn.commit()
        # rowcount is 0 if INSERT was ignored due to UNIQUE constraint violation
        if cursor.rowcount == 0:
            return None
        return cursor.lastrowid

    @staticmethod
    async def add_path(
        message_id: int,
        path: str,
        received_at: int | None = None,
        path_len: int | None = None,
    ) -> list[MessagePath]:
        """Add a new path to an existing message.

        This is used when a repeat/echo of a message arrives via a different route.
        Returns the updated list of paths.
        """
        ts = received_at if received_at is not None else int(time.time())

        # Atomic append: use json_insert to avoid read-modify-write race when
        # multiple duplicate packets arrive concurrently for the same message.
        entry: dict = {"path": path, "received_at": ts}
        if path_len is not None:
            entry["path_len"] = path_len
        new_entry = json.dumps(entry)
        await db.conn.execute(
            """UPDATE messages SET paths = json_insert(
                COALESCE(paths, '[]'), '$[#]', json(?)
            ) WHERE id = ?""",
            (new_entry, message_id),
        )
        await db.conn.commit()

        # Read back the full list for the return value
        cursor = await db.conn.execute("SELECT paths FROM messages WHERE id = ?", (message_id,))
        row = await cursor.fetchone()
        if not row or not row["paths"]:
            return []

        try:
            all_paths = json.loads(row["paths"])
        except json.JSONDecodeError:
            return []

        return [MessagePath(**p) for p in all_paths]

    @staticmethod
    async def claim_prefix_messages(full_key: str) -> int:
        """Promote prefix-stored messages to the full conversation key.

        When a full key becomes known for a contact, any messages stored with
        only a prefix as conversation_key are updated to use the full key.
        """
        lower_key = full_key.lower()
        cursor = await db.conn.execute(
            """UPDATE messages SET conversation_key = ?
               WHERE type = 'PRIV' AND length(conversation_key) < 64
               AND ? LIKE conversation_key || '%'
               AND (
                   SELECT COUNT(*) FROM contacts
                   WHERE public_key LIKE messages.conversation_key || '%'
               ) = 1""",
            (lower_key, lower_key),
        )
        await db.conn.commit()
        return cursor.rowcount

    @staticmethod
    async def backfill_channel_sender_key(public_key: str, name: str) -> int:
        """Backfill sender_key on channel messages that match a contact's name.

        When a contact becomes known (via advert, sync, or manual creation),
        any channel messages with a matching sender_name but no sender_key
        are updated to associate them with this contact's public key.
        """
        cursor = await db.conn.execute(
            """UPDATE messages SET sender_key = ?
               WHERE type = 'CHAN' AND sender_name = ? AND sender_key IS NULL""",
            (public_key.lower(), name),
        )
        await db.conn.commit()
        return cursor.rowcount

    @staticmethod
    def _normalize_conversation_key(conversation_key: str) -> tuple[str, str]:
        """Normalize a conversation key and return (sql_clause, normalized_key).

        Returns the WHERE clause fragment and the normalized key value.
        """
        if len(conversation_key) == 64:
            return "AND conversation_key = ?", conversation_key.lower()
        elif len(conversation_key) == 32:
            return "AND conversation_key = ?", conversation_key.upper()
        else:
            return "AND conversation_key LIKE ?", f"{conversation_key}%"

    @staticmethod
    def _row_to_message(row: Any) -> Message:
        """Convert a database row to a Message model."""
        return Message(
            id=row["id"],
            type=row["type"],
            conversation_key=row["conversation_key"],
            text=row["text"],
            sender_timestamp=row["sender_timestamp"],
            received_at=row["received_at"],
            paths=MessageRepository._parse_paths(row["paths"]),
            txt_type=row["txt_type"],
            signature=row["signature"],
            sender_key=row["sender_key"],
            outgoing=bool(row["outgoing"]),
            acked=row["acked"],
            sender_name=row["sender_name"],
        )

    @staticmethod
    async def get_all(
        limit: int = 100,
        offset: int = 0,
        msg_type: str | None = None,
        conversation_key: str | None = None,
        before: int | None = None,
        before_id: int | None = None,
        after: int | None = None,
        after_id: int | None = None,
        q: str | None = None,
        blocked_keys: list[str] | None = None,
        blocked_names: list[str] | None = None,
    ) -> list[Message]:
        query = "SELECT * FROM messages WHERE 1=1"
        params: list[Any] = []

        if blocked_keys:
            placeholders = ",".join("?" for _ in blocked_keys)
            query += (
                f" AND NOT (outgoing=0 AND ("
                f"(type='PRIV' AND LOWER(conversation_key) IN ({placeholders}))"
                f" OR (type='CHAN' AND sender_key IS NOT NULL AND LOWER(sender_key) IN ({placeholders}))"
                f"))"
            )
            params.extend(blocked_keys)
            params.extend(blocked_keys)

        if blocked_names:
            placeholders = ",".join("?" for _ in blocked_names)
            query += (
                f" AND NOT (outgoing=0 AND sender_name IS NOT NULL"
                f" AND sender_name IN ({placeholders}))"
            )
            params.extend(blocked_names)

        if msg_type:
            query += " AND type = ?"
            params.append(msg_type)
        if conversation_key:
            clause, norm_key = MessageRepository._normalize_conversation_key(conversation_key)
            query += f" {clause}"
            params.append(norm_key)

        if q:
            escaped_q = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            query += " AND text LIKE ? ESCAPE '\\' COLLATE NOCASE"
            params.append(f"%{escaped_q}%")

        # Forward cursor (after/after_id) — mutually exclusive with before/before_id
        if after is not None and after_id is not None:
            query += " AND (received_at > ? OR (received_at = ? AND id > ?))"
            params.extend([after, after, after_id])
            query += " ORDER BY received_at ASC, id ASC LIMIT ?"
            params.append(limit)
        else:
            if before is not None and before_id is not None:
                query += " AND (received_at < ? OR (received_at = ? AND id < ?))"
                params.extend([before, before, before_id])

            query += " ORDER BY received_at DESC, id DESC LIMIT ?"
            params.append(limit)
            if before is None or before_id is None:
                query += " OFFSET ?"
                params.append(offset)

        cursor = await db.conn.execute(query, params)
        rows = await cursor.fetchall()
        return [MessageRepository._row_to_message(row) for row in rows]

    @staticmethod
    async def get_around(
        message_id: int,
        msg_type: str | None = None,
        conversation_key: str | None = None,
        context_size: int = 100,
        blocked_keys: list[str] | None = None,
        blocked_names: list[str] | None = None,
    ) -> tuple[list[Message], bool, bool]:
        """Get messages around a target message.

        Returns (messages, has_older, has_newer).
        """
        # Build common WHERE clause for optional conversation/type filtering.
        # If the target message doesn't match filters, return an empty result.
        where_parts: list[str] = []
        base_params: list[Any] = []
        if msg_type:
            where_parts.append("type = ?")
            base_params.append(msg_type)
        if conversation_key:
            clause, norm_key = MessageRepository._normalize_conversation_key(conversation_key)
            where_parts.append(clause.removeprefix("AND "))
            base_params.append(norm_key)

        if blocked_keys:
            placeholders = ",".join("?" for _ in blocked_keys)
            where_parts.append(
                f"NOT (outgoing=0 AND ("
                f"(type='PRIV' AND LOWER(conversation_key) IN ({placeholders}))"
                f" OR (type='CHAN' AND sender_key IS NOT NULL AND LOWER(sender_key) IN ({placeholders}))"
                f"))"
            )
            base_params.extend(blocked_keys)
            base_params.extend(blocked_keys)

        if blocked_names:
            placeholders = ",".join("?" for _ in blocked_names)
            where_parts.append(
                f"NOT (outgoing=0 AND sender_name IS NOT NULL AND sender_name IN ({placeholders}))"
            )
            base_params.extend(blocked_names)

        where_sql = " AND ".join(["1=1", *where_parts])

        # 1. Get the target message (must satisfy filters if provided)
        target_cursor = await db.conn.execute(
            f"SELECT * FROM messages WHERE id = ? AND {where_sql}",
            (message_id, *base_params),
        )
        target_row = await target_cursor.fetchone()
        if not target_row:
            return [], False, False

        target = MessageRepository._row_to_message(target_row)

        # 2. Get context_size+1 messages before target (DESC)
        before_query = f"""
            SELECT * FROM messages WHERE {where_sql}
            AND (received_at < ? OR (received_at = ? AND id < ?))
            ORDER BY received_at DESC, id DESC LIMIT ?
        """
        before_params = [
            *base_params,
            target.received_at,
            target.received_at,
            target.id,
            context_size + 1,
        ]
        before_cursor = await db.conn.execute(before_query, before_params)
        before_rows = list(await before_cursor.fetchall())

        has_older = len(before_rows) > context_size
        before_messages = [MessageRepository._row_to_message(r) for r in before_rows[:context_size]]

        # 3. Get context_size+1 messages after target (ASC)
        after_query = f"""
            SELECT * FROM messages WHERE {where_sql}
            AND (received_at > ? OR (received_at = ? AND id > ?))
            ORDER BY received_at ASC, id ASC LIMIT ?
        """
        after_params = [
            *base_params,
            target.received_at,
            target.received_at,
            target.id,
            context_size + 1,
        ]
        after_cursor = await db.conn.execute(after_query, after_params)
        after_rows = list(await after_cursor.fetchall())

        has_newer = len(after_rows) > context_size
        after_messages = [MessageRepository._row_to_message(r) for r in after_rows[:context_size]]

        # Combine: before (reversed to ASC) + target + after
        all_messages = list(reversed(before_messages)) + [target] + after_messages
        return all_messages, has_older, has_newer

    @staticmethod
    async def increment_ack_count(message_id: int) -> int:
        """Increment ack count and return the new value."""
        await db.conn.execute("UPDATE messages SET acked = acked + 1 WHERE id = ?", (message_id,))
        await db.conn.commit()
        cursor = await db.conn.execute("SELECT acked FROM messages WHERE id = ?", (message_id,))
        row = await cursor.fetchone()
        return row["acked"] if row else 1

    @staticmethod
    async def get_ack_and_paths(message_id: int) -> tuple[int, list[MessagePath] | None]:
        """Get the current ack count and paths for a message."""
        cursor = await db.conn.execute(
            "SELECT acked, paths FROM messages WHERE id = ?", (message_id,)
        )
        row = await cursor.fetchone()
        if not row:
            return 0, None
        return row["acked"], MessageRepository._parse_paths(row["paths"])

    @staticmethod
    async def get_by_id(message_id: int) -> "Message | None":
        """Look up a message by its ID."""
        cursor = await db.conn.execute(
            "SELECT * FROM messages WHERE id = ?",
            (message_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return None

        return MessageRepository._row_to_message(row)

    @staticmethod
    async def get_by_content(
        msg_type: str,
        conversation_key: str,
        text: str,
        sender_timestamp: int | None,
    ) -> "Message | None":
        """Look up a message by its unique content fields."""
        cursor = await db.conn.execute(
            """
            SELECT * FROM messages
            WHERE type = ? AND conversation_key = ? AND text = ?
              AND (sender_timestamp = ? OR (sender_timestamp IS NULL AND ? IS NULL))
            """,
            (msg_type, conversation_key, text, sender_timestamp, sender_timestamp),
        )
        row = await cursor.fetchone()
        if not row:
            return None

        return MessageRepository._row_to_message(row)

    @staticmethod
    async def get_unread_counts(
        name: str | None = None,
        blocked_keys: list[str] | None = None,
        blocked_names: list[str] | None = None,
    ) -> dict:
        """Get unread message counts, mention flags, and last message times for all conversations.

        Args:
            name: User's display name for @[name] mention detection. If None, mentions are skipped.
            blocked_keys: Public keys whose messages should be excluded from counts.
            blocked_names: Display names whose messages should be excluded from counts.

        Returns:
            Dict with 'counts', 'mentions', and 'last_message_times' keys.
        """
        counts: dict[str, int] = {}
        mention_flags: dict[str, bool] = {}
        last_message_times: dict[str, int] = {}

        mention_token = f"@[{name}]" if name else None

        # Build optional block-list WHERE fragments for channel messages
        chan_block_sql = ""
        chan_block_params: list[Any] = []
        if blocked_keys:
            placeholders = ",".join("?" for _ in blocked_keys)
            chan_block_sql += (
                f" AND NOT (m.sender_key IS NOT NULL AND LOWER(m.sender_key) IN ({placeholders}))"
            )
            chan_block_params.extend(blocked_keys)
        if blocked_names:
            placeholders = ",".join("?" for _ in blocked_names)
            chan_block_sql += (
                f" AND NOT (m.sender_name IS NOT NULL AND m.sender_name IN ({placeholders}))"
            )
            chan_block_params.extend(blocked_names)

        # Channel unreads
        cursor = await db.conn.execute(
            f"""
            SELECT m.conversation_key,
                   COUNT(*) as unread_count,
                   SUM(CASE
                           WHEN ? <> '' AND INSTR(LOWER(m.text), LOWER(?)) > 0 THEN 1
                           ELSE 0
                       END) > 0 as has_mention
            FROM messages m
            JOIN channels c ON m.conversation_key = c.key
            WHERE m.type = 'CHAN' AND m.outgoing = 0
              AND m.received_at > COALESCE(c.last_read_at, 0)
              {chan_block_sql}
            GROUP BY m.conversation_key
            """,
            (mention_token or "", mention_token or "", *chan_block_params),
        )
        rows = await cursor.fetchall()
        for row in rows:
            state_key = f"channel-{row['conversation_key']}"
            counts[state_key] = row["unread_count"]
            if mention_token and row["has_mention"]:
                mention_flags[state_key] = True

        # Build block-list exclusion for contact (DM) unreads
        contact_block_sql = ""
        contact_block_params: list[Any] = []
        if blocked_keys:
            placeholders = ",".join("?" for _ in blocked_keys)
            contact_block_sql += f" AND LOWER(m.conversation_key) NOT IN ({placeholders})"
            contact_block_params.extend(blocked_keys)

        # Contact unreads
        cursor = await db.conn.execute(
            f"""
            SELECT m.conversation_key,
                   COUNT(*) as unread_count,
                   SUM(CASE
                           WHEN ? <> '' AND INSTR(LOWER(m.text), LOWER(?)) > 0 THEN 1
                           ELSE 0
                       END) > 0 as has_mention
            FROM messages m
            JOIN contacts ct ON m.conversation_key = ct.public_key
            WHERE m.type = 'PRIV' AND m.outgoing = 0
              AND m.received_at > COALESCE(ct.last_read_at, 0)
              {contact_block_sql}
            GROUP BY m.conversation_key
            """,
            (mention_token or "", mention_token or "", *contact_block_params),
        )
        rows = await cursor.fetchall()
        for row in rows:
            state_key = f"contact-{row['conversation_key']}"
            counts[state_key] = row["unread_count"]
            if mention_token and row["has_mention"]:
                mention_flags[state_key] = True

        # Last message times for all conversations (including read ones)
        cursor = await db.conn.execute(
            """
            SELECT type, conversation_key, MAX(received_at) as last_message_time
            FROM messages
            GROUP BY type, conversation_key
            """
        )
        rows = await cursor.fetchall()
        for row in rows:
            prefix = "channel" if row["type"] == "CHAN" else "contact"
            state_key = f"{prefix}-{row['conversation_key']}"
            last_message_times[state_key] = row["last_message_time"]

        return {
            "counts": counts,
            "mentions": mention_flags,
            "last_message_times": last_message_times,
        }

    @staticmethod
    async def count_dm_messages(contact_key: str) -> int:
        """Count total DM messages for a contact."""
        cursor = await db.conn.execute(
            "SELECT COUNT(*) as cnt FROM messages WHERE type = 'PRIV' AND conversation_key = ?",
            (contact_key.lower(),),
        )
        row = await cursor.fetchone()
        return row["cnt"] if row else 0

    @staticmethod
    async def count_channel_messages_by_sender(sender_key: str) -> int:
        """Count channel messages sent by a specific contact."""
        cursor = await db.conn.execute(
            "SELECT COUNT(*) as cnt FROM messages WHERE type = 'CHAN' AND sender_key = ?",
            (sender_key.lower(),),
        )
        row = await cursor.fetchone()
        return row["cnt"] if row else 0

    @staticmethod
    async def count_channel_messages_by_sender_name(sender_name: str) -> int:
        """Count channel messages attributed to a display name."""
        cursor = await db.conn.execute(
            "SELECT COUNT(*) as cnt FROM messages WHERE type = 'CHAN' AND sender_name = ?",
            (sender_name,),
        )
        row = await cursor.fetchone()
        return row["cnt"] if row else 0

    @staticmethod
    async def get_channel_stats(conversation_key: str) -> dict:
        """Get channel message statistics: time-windowed counts, first message, unique senders, top senders.

        Returns a dict with message_counts, first_message_at, unique_sender_count, top_senders_24h.
        """
        import time as _time

        now = int(_time.time())
        t_1h = now - 3600
        t_24h = now - 86400
        t_48h = now - 172800
        t_7d = now - 604800

        cursor = await db.conn.execute(
            """
            SELECT COUNT(*) AS all_time,
                SUM(CASE WHEN received_at >= ? THEN 1 ELSE 0 END) AS last_1h,
                SUM(CASE WHEN received_at >= ? THEN 1 ELSE 0 END) AS last_24h,
                SUM(CASE WHEN received_at >= ? THEN 1 ELSE 0 END) AS last_48h,
                SUM(CASE WHEN received_at >= ? THEN 1 ELSE 0 END) AS last_7d,
                MIN(received_at) AS first_message_at,
                COUNT(DISTINCT sender_key) AS unique_sender_count
            FROM messages WHERE type = 'CHAN' AND conversation_key = ?
            """,
            (t_1h, t_24h, t_48h, t_7d, conversation_key),
        )
        row = await cursor.fetchone()
        assert row is not None  # Aggregate query always returns a row

        message_counts = {
            "last_1h": row["last_1h"] or 0,
            "last_24h": row["last_24h"] or 0,
            "last_48h": row["last_48h"] or 0,
            "last_7d": row["last_7d"] or 0,
            "all_time": row["all_time"] or 0,
        }

        cursor2 = await db.conn.execute(
            """
            SELECT COALESCE(sender_name, sender_key, 'Unknown') AS display_name,
                sender_key, COUNT(*) AS cnt
            FROM messages
            WHERE type = 'CHAN' AND conversation_key = ?
                AND received_at >= ? AND sender_key IS NOT NULL
            GROUP BY sender_key ORDER BY cnt DESC LIMIT 5
            """,
            (conversation_key, t_24h),
        )
        top_rows = await cursor2.fetchall()
        top_senders = [
            {
                "sender_name": r["display_name"],
                "sender_key": r["sender_key"],
                "message_count": r["cnt"],
            }
            for r in top_rows
        ]

        return {
            "message_counts": message_counts,
            "first_message_at": row["first_message_at"],
            "unique_sender_count": row["unique_sender_count"] or 0,
            "top_senders_24h": top_senders,
        }

    @staticmethod
    async def get_most_active_rooms(sender_key: str, limit: int = 5) -> list[tuple[str, str, int]]:
        """Get channels where a contact has sent the most messages.

        Returns list of (channel_key, channel_name, message_count) tuples.
        """
        cursor = await db.conn.execute(
            """
            SELECT m.conversation_key, COALESCE(c.name, m.conversation_key) AS channel_name,
                   COUNT(*) AS cnt
            FROM messages m
            LEFT JOIN channels c ON m.conversation_key = c.key
            WHERE m.type = 'CHAN' AND m.sender_key = ?
            GROUP BY m.conversation_key
            ORDER BY cnt DESC
            LIMIT ?
            """,
            (sender_key.lower(), limit),
        )
        rows = await cursor.fetchall()
        return [(row["conversation_key"], row["channel_name"], row["cnt"]) for row in rows]

    @staticmethod
    async def get_most_active_rooms_by_sender_name(
        sender_name: str, limit: int = 5
    ) -> list[tuple[str, str, int]]:
        """Get channels where a display name has sent the most messages."""
        cursor = await db.conn.execute(
            """
            SELECT m.conversation_key, COALESCE(c.name, m.conversation_key) AS channel_name,
                   COUNT(*) AS cnt
            FROM messages m
            LEFT JOIN channels c ON m.conversation_key = c.key
            WHERE m.type = 'CHAN' AND m.sender_name = ?
            GROUP BY m.conversation_key
            ORDER BY cnt DESC
            LIMIT ?
            """,
            (sender_name, limit),
        )
        rows = await cursor.fetchall()
        return [(row["conversation_key"], row["channel_name"], row["cnt"]) for row in rows]
