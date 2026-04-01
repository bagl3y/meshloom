import json
import logging

from app.database import db

logger = logging.getLogger(__name__)


class RepeaterTelemetryRepository:
    @staticmethod
    async def record(
        public_key: str,
        timestamp: int,
        data: dict,
    ) -> None:
        """Insert a telemetry history row with the full status snapshot as JSON."""
        await db.conn.execute(
            """
            INSERT INTO repeater_telemetry_history
                (public_key, timestamp, data)
            VALUES (?, ?, ?)
            """,
            (public_key, timestamp, json.dumps(data)),
        )
        await db.conn.commit()

    @staticmethod
    async def get_history(public_key: str, since_timestamp: int) -> list[dict]:
        """Return telemetry rows for a repeater since a given timestamp, ordered ASC."""
        cursor = await db.conn.execute(
            """
            SELECT timestamp, data
            FROM repeater_telemetry_history
            WHERE public_key = ? AND timestamp >= ?
            ORDER BY timestamp ASC
            """,
            (public_key, since_timestamp),
        )
        rows = await cursor.fetchall()
        return [
            {
                "timestamp": row["timestamp"],
                "data": json.loads(row["data"]),
            }
            for row in rows
        ]
