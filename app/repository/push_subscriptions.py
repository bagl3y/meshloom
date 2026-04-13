"""Repository for push_subscriptions table."""

import json
import logging
import time
import uuid
from typing import Any

from app.database import db

logger = logging.getLogger(__name__)


def _row_to_dict(row: Any) -> dict[str, Any]:
    result = {
        "id": row["id"],
        "endpoint": row["endpoint"],
        "p256dh": row["p256dh"],
        "auth": row["auth"],
        "label": row["label"] or "",
        "filter_mode": row["filter_mode"] or "all_messages",
        "filter_conversations": json.loads(row["filter_conversations"])
        if row["filter_conversations"]
        else [],
        "created_at": row["created_at"] or 0,
        "last_success_at": row["last_success_at"],
        "failure_count": row["failure_count"] or 0,
    }
    return result


class PushSubscriptionRepository:
    @staticmethod
    async def create(
        endpoint: str,
        p256dh: str,
        auth: str,
        label: str = "",
        filter_mode: str = "all_messages",
        filter_conversations: list[str] | None = None,
    ) -> dict[str, Any]:
        """Create or upsert a push subscription (keyed by endpoint)."""
        sub_id = str(uuid.uuid4())
        now = int(time.time())
        convos_json = json.dumps(filter_conversations or [])

        # Upsert: if endpoint already exists, update keys/label but keep the ID
        await db.conn.execute(
            """
            INSERT INTO push_subscriptions
                (id, endpoint, p256dh, auth, label, filter_mode,
                 filter_conversations, created_at, failure_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            ON CONFLICT(endpoint) DO UPDATE SET
                p256dh = excluded.p256dh,
                auth = excluded.auth,
                label = CASE WHEN excluded.label != '' THEN excluded.label ELSE push_subscriptions.label END,
                failure_count = 0
            """,
            (sub_id, endpoint, p256dh, auth, label, filter_mode, convos_json, now),
        )
        await db.conn.commit()

        # Return the actual row (may be existing on upsert)
        return await PushSubscriptionRepository.get_by_endpoint(endpoint)  # type: ignore[return-value]

    @staticmethod
    async def get(subscription_id: str) -> dict[str, Any] | None:
        cursor = await db.conn.execute(
            "SELECT * FROM push_subscriptions WHERE id = ?", (subscription_id,)
        )
        row = await cursor.fetchone()
        return _row_to_dict(row) if row else None

    @staticmethod
    async def get_by_endpoint(endpoint: str) -> dict[str, Any] | None:
        cursor = await db.conn.execute(
            "SELECT * FROM push_subscriptions WHERE endpoint = ?", (endpoint,)
        )
        row = await cursor.fetchone()
        return _row_to_dict(row) if row else None

    @staticmethod
    async def get_all() -> list[dict[str, Any]]:
        cursor = await db.conn.execute("SELECT * FROM push_subscriptions ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [_row_to_dict(row) for row in rows]

    @staticmethod
    async def update(subscription_id: str, **fields: Any) -> dict[str, Any] | None:
        updates: list[str] = []
        params: list[Any] = []

        for key in ("label", "filter_mode"):
            if key in fields:
                updates.append(f"{key} = ?")
                params.append(fields[key])

        if "filter_conversations" in fields:
            updates.append("filter_conversations = ?")
            params.append(json.dumps(fields["filter_conversations"]))

        if not updates:
            return await PushSubscriptionRepository.get(subscription_id)

        params.append(subscription_id)
        await db.conn.execute(
            f"UPDATE push_subscriptions SET {', '.join(updates)} WHERE id = ?",
            params,
        )
        await db.conn.commit()
        return await PushSubscriptionRepository.get(subscription_id)

    @staticmethod
    async def delete(subscription_id: str) -> bool:
        cursor = await db.conn.execute(
            "DELETE FROM push_subscriptions WHERE id = ?", (subscription_id,)
        )
        await db.conn.commit()
        return cursor.rowcount > 0

    @staticmethod
    async def delete_by_endpoint(endpoint: str) -> bool:
        cursor = await db.conn.execute(
            "DELETE FROM push_subscriptions WHERE endpoint = ?", (endpoint,)
        )
        await db.conn.commit()
        return cursor.rowcount > 0

    @staticmethod
    async def record_success(subscription_id: str) -> None:
        now = int(time.time())
        await db.conn.execute(
            "UPDATE push_subscriptions SET last_success_at = ?, failure_count = 0 WHERE id = ?",
            (now, subscription_id),
        )
        await db.conn.commit()

    @staticmethod
    async def record_failure(subscription_id: str) -> None:
        await db.conn.execute(
            "UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE id = ?",
            (subscription_id,),
        )
        await db.conn.commit()
