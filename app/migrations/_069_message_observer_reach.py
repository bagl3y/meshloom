import logging

import aiosqlite

from app.decoder import RouteType, parse_packet
from app.path_utils import calculate_packet_hash, canonical_packet_hash, is_flood_route_type

logger = logging.getLogger(__name__)


async def migrate(conn: aiosqlite.Connection) -> None:
    """Persist packet hash and flood eligibility for observer-reach lookups.

    Raw packets may be purged later, so the hash and flood-route flag must live
    on the message row. Existing rows still linked to a raw packet are backfilled.
    """
    tables_cursor = await conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = {row[0] for row in await tables_cursor.fetchall()}
    if "messages" not in existing_tables:
        await conn.commit()
        return

    col_cursor = await conn.execute("PRAGMA table_info(messages)")
    message_columns = {row[1] for row in await col_cursor.fetchall()}
    if "packet_hash" not in message_columns:
        await conn.execute("ALTER TABLE messages ADD COLUMN packet_hash TEXT")
    if "observer_reach_eligible" not in message_columns:
        await conn.execute("ALTER TABLE messages ADD COLUMN observer_reach_eligible INTEGER")
    await conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_messages_packet_hash "
        "ON messages(packet_hash) WHERE packet_hash IS NOT NULL"
    )
    await conn.commit()

    if "raw_packets" not in existing_tables:
        return
    if "type" not in message_columns:
        return
    raw_cols_cursor = await conn.execute("PRAGMA table_info(raw_packets)")
    raw_columns = {row[1] for row in await raw_cols_cursor.fetchall()}
    if "data" not in raw_columns or "message_id" not in raw_columns:
        return

    cursor = await conn.execute(
        """
        SELECT m.id, m.type, rp.data
        FROM messages m
        JOIN raw_packets rp ON rp.message_id = m.id
        WHERE m.packet_hash IS NULL OR m.observer_reach_eligible IS NULL
        """
    )
    rows = await cursor.fetchall()
    updated = 0
    for row in rows:
        message_id = row[0]
        msg_type = row[1]
        raw_bytes = row[2]
        if not isinstance(raw_bytes, (bytes, bytearray)):
            continue
        packet_hash = canonical_packet_hash(calculate_packet_hash(bytes(raw_bytes)))
        packet_info = parse_packet(bytes(raw_bytes))
        route_type = int(packet_info.route_type) if packet_info is not None else None
        eligible = 1 if (msg_type == "CHAN" or is_flood_route_type(route_type)) else 0
        # TRANSPORT_FLOOD / FLOOD are the only PRIV routes that can have MQTT observers.
        if msg_type == "PRIV" and packet_info is not None:
            eligible = (
                1
                if packet_info.route_type
                in (
                    RouteType.TRANSPORT_FLOOD,
                    RouteType.FLOOD,
                )
                else 0
            )
        await conn.execute(
            """
            UPDATE messages
            SET packet_hash = COALESCE(?, packet_hash),
                observer_reach_eligible = COALESCE(?, observer_reach_eligible)
            WHERE id = ?
            """,
            (packet_hash, eligible, message_id),
        )
        updated += 1
    await conn.commit()
    if updated:
        logger.info("Backfilled observer-reach fields on %d message(s)", updated)
