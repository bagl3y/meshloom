import logging
import time
from collections.abc import AsyncIterator
from hashlib import sha256

from app.database import db
from app.decoder import PayloadType, extract_payload, get_packet_payload_type

logger = logging.getLogger(__name__)

UNDECRYPTED_PACKET_BATCH_SIZE = 500


class RawPacketRepository:
    @staticmethod
    async def create(data: bytes, timestamp: int | None = None) -> tuple[int, bool]:
        """
        Create a raw packet with payload-based deduplication.

        Returns (packet_id, is_new) tuple:
        - is_new=True: New packet stored, packet_id is the new row ID
        - is_new=False: Duplicate payload detected, packet_id is the existing row ID

        Deduplication is based on the SHA-256 hash of the packet payload
        (excluding routing/path information).
        """
        ts = timestamp if timestamp is not None else int(time.time())

        # Compute payload hash for deduplication
        payload = extract_payload(data)
        if payload:
            payload_hash = sha256(payload).digest()
        else:
            # For malformed packets, hash the full data
            payload_hash = sha256(data).digest()

        cursor = await db.conn.execute(
            "INSERT OR IGNORE INTO raw_packets (timestamp, data, payload_hash) VALUES (?, ?, ?)",
            (ts, data, payload_hash),
        )
        await db.conn.commit()

        if cursor.rowcount > 0:
            assert cursor.lastrowid is not None
            return (cursor.lastrowid, True)

        # Duplicate payload — look up the existing row.
        cursor = await db.conn.execute(
            "SELECT id FROM raw_packets WHERE payload_hash = ?", (payload_hash,)
        )
        existing = await cursor.fetchone()
        assert existing is not None
        return (existing["id"], False)

    @staticmethod
    async def get_undecrypted_count() -> int:
        """Get count of undecrypted packets (those without a linked message)."""
        cursor = await db.conn.execute(
            "SELECT COUNT(*) as count FROM raw_packets WHERE message_id IS NULL"
        )
        row = await cursor.fetchone()
        return row["count"] if row else 0

    @staticmethod
    async def get_oldest_undecrypted() -> int | None:
        """Get timestamp of oldest undecrypted packet, or None if none exist."""
        cursor = await db.conn.execute(
            "SELECT MIN(timestamp) as oldest FROM raw_packets WHERE message_id IS NULL"
        )
        row = await cursor.fetchone()
        return row["oldest"] if row and row["oldest"] is not None else None

    @staticmethod
    async def stream_all_undecrypted(
        batch_size: int = UNDECRYPTED_PACKET_BATCH_SIZE,
    ) -> AsyncIterator[tuple[int, bytes, int]]:
        """Yield all undecrypted packets as (id, data, timestamp) in bounded batches."""
        cursor = await db.conn.execute(
            "SELECT id, data, timestamp FROM raw_packets WHERE message_id IS NULL ORDER BY timestamp ASC"
        )
        try:
            while True:
                rows = await cursor.fetchmany(batch_size)
                if not rows:
                    break
                for row in rows:
                    yield (row["id"], bytes(row["data"]), row["timestamp"])
        finally:
            await cursor.close()

    @staticmethod
    async def stream_undecrypted_text_messages(
        batch_size: int = UNDECRYPTED_PACKET_BATCH_SIZE,
    ) -> AsyncIterator[tuple[int, bytes, int]]:
        """Yield undecrypted TEXT_MESSAGE packets in bounded-size batches."""
        cursor = await db.conn.execute(
            "SELECT id, data, timestamp FROM raw_packets WHERE message_id IS NULL ORDER BY timestamp ASC"
        )
        try:
            while True:
                rows = await cursor.fetchmany(batch_size)
                if not rows:
                    break

                for row in rows:
                    data = bytes(row["data"])
                    payload_type = get_packet_payload_type(data)
                    if payload_type == PayloadType.TEXT_MESSAGE:
                        yield (row["id"], data, row["timestamp"])
        finally:
            await cursor.close()

    @staticmethod
    async def count_undecrypted_text_messages(
        batch_size: int = UNDECRYPTED_PACKET_BATCH_SIZE,
    ) -> int:
        """Count undecrypted TEXT_MESSAGE packets without materializing them all."""
        count = 0
        async for _packet in RawPacketRepository.stream_undecrypted_text_messages(
            batch_size=batch_size
        ):
            count += 1
        return count

    @staticmethod
    async def mark_decrypted(packet_id: int, message_id: int) -> None:
        """Link a raw packet to its decrypted message."""
        await db.conn.execute(
            "UPDATE raw_packets SET message_id = ? WHERE id = ?",
            (message_id, packet_id),
        )
        await db.conn.commit()

    @staticmethod
    async def get_linked_message_id(packet_id: int) -> int | None:
        """Return the linked message ID for a raw packet, if any."""
        cursor = await db.conn.execute(
            "SELECT message_id FROM raw_packets WHERE id = ?",
            (packet_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return row["message_id"]

    @staticmethod
    async def get_by_id(packet_id: int) -> tuple[int, bytes, int, int | None] | None:
        """Return a raw packet row as (id, data, timestamp, message_id)."""
        cursor = await db.conn.execute(
            "SELECT id, data, timestamp, message_id FROM raw_packets WHERE id = ?",
            (packet_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return (row["id"], bytes(row["data"]), row["timestamp"], row["message_id"])

    @staticmethod
    async def prune_old_undecrypted(max_age_days: int) -> int:
        """Delete undecrypted packets older than max_age_days. Returns count deleted."""
        cutoff = int(time.time()) - (max_age_days * 86400)
        cursor = await db.conn.execute(
            "DELETE FROM raw_packets WHERE message_id IS NULL AND timestamp < ?",
            (cutoff,),
        )
        await db.conn.commit()
        return cursor.rowcount

    @staticmethod
    async def purge_linked_to_messages() -> int:
        """Delete raw packets that are already linked to a stored message."""
        cursor = await db.conn.execute("DELETE FROM raw_packets WHERE message_id IS NOT NULL")
        await db.conn.commit()
        return cursor.rowcount

    @staticmethod
    async def get_undecrypted_text_messages() -> list[tuple[int, bytes, int]]:
        """Get all undecrypted TEXT_MESSAGE packets as (id, data, timestamp) tuples.

        Filters raw packets to only include those with PayloadType.TEXT_MESSAGE (0x02).
        These are direct messages that can be decrypted with contact ECDH keys.
        """
        return [packet async for packet in RawPacketRepository.stream_undecrypted_text_messages()]
