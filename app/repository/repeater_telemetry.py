import logging

from app.database import db

logger = logging.getLogger(__name__)


class RepeaterTelemetryRepository:
    @staticmethod
    async def record(
        public_key: str,
        timestamp: int,
        battery_volts: float,
        uptime_seconds: int | None = None,
        noise_floor_dbm: int | None = None,
    ) -> None:
        """Insert a telemetry history row."""
        await db.conn.execute(
            """
            INSERT INTO repeater_telemetry_history
                (public_key, timestamp, battery_volts, uptime_seconds, noise_floor_dbm)
            VALUES (?, ?, ?, ?, ?)
            """,
            (public_key, timestamp, battery_volts, uptime_seconds, noise_floor_dbm),
        )
        await db.conn.commit()

    @staticmethod
    async def get_history(public_key: str, since_timestamp: int) -> list[dict]:
        """Return telemetry rows for a repeater since a given timestamp, ordered ASC."""
        cursor = await db.conn.execute(
            """
            SELECT timestamp, battery_volts, uptime_seconds, noise_floor_dbm
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
                "battery_volts": row["battery_volts"],
                "uptime_seconds": row["uptime_seconds"],
                "noise_floor_dbm": row["noise_floor_dbm"],
            }
            for row in rows
        ]

    @staticmethod
    async def prune_old(max_age_seconds: int) -> int:
        """Delete rows older than max_age_seconds. Returns count of deleted rows."""
        import time

        cutoff = int(time.time()) - max_age_seconds
        cursor = await db.conn.execute(
            "DELETE FROM repeater_telemetry_history WHERE timestamp < ?",
            (cutoff,),
        )
        await db.conn.commit()
        return cursor.rowcount
