import json
import logging
import time
from typing import Any, Literal

from app.database import db
from app.models import AppSettings, Favorite
from app.path_utils import parse_packet_envelope

logger = logging.getLogger(__name__)

SECONDS_1H = 3600
SECONDS_24H = 86400
SECONDS_7D = 604800
RAW_PACKET_STATS_BATCH_SIZE = 500


class AppSettingsRepository:
    """Repository for app_settings table (single-row pattern)."""

    @staticmethod
    async def get() -> AppSettings:
        """Get the current app settings.

        Always returns settings - creates default row if needed (migration handles initial row).
        """
        cursor = await db.conn.execute(
            """
            SELECT max_radio_contacts, favorites, auto_decrypt_dm_on_advert,
                   last_message_times, preferences_migrated,
                   advert_interval, last_advert_time, flood_scope,
                   blocked_keys, blocked_names, discovery_blocked_types,
                   tracked_telemetry_repeaters
            FROM app_settings WHERE id = 1
            """
        )
        row = await cursor.fetchone()

        if not row:
            # Should not happen after migration, but handle gracefully
            return AppSettings()

        # Parse favorites JSON
        favorites = []
        if row["favorites"]:
            try:
                favorites_data = json.loads(row["favorites"])
                favorites = [Favorite(**f) for f in favorites_data]
            except (json.JSONDecodeError, TypeError, KeyError) as e:
                logger.warning(
                    "Failed to parse favorites JSON, using empty list: %s (data=%r)",
                    e,
                    row["favorites"][:100] if row["favorites"] else None,
                )
                favorites = []

        # Parse last_message_times JSON
        last_message_times: dict[str, int] = {}
        if row["last_message_times"]:
            try:
                last_message_times = json.loads(row["last_message_times"])
            except (json.JSONDecodeError, TypeError) as e:
                logger.warning(
                    "Failed to parse last_message_times JSON, using empty dict: %s",
                    e,
                )
                last_message_times = {}

        # Parse blocked_keys JSON
        blocked_keys: list[str] = []
        if row["blocked_keys"]:
            try:
                blocked_keys = json.loads(row["blocked_keys"])
            except (json.JSONDecodeError, TypeError):
                blocked_keys = []

        # Parse blocked_names JSON
        blocked_names: list[str] = []
        if row["blocked_names"]:
            try:
                blocked_names = json.loads(row["blocked_names"])
            except (json.JSONDecodeError, TypeError):
                blocked_names = []

        # Parse discovery_blocked_types JSON
        discovery_blocked_types: list[int] = []
        if row["discovery_blocked_types"]:
            try:
                discovery_blocked_types = json.loads(row["discovery_blocked_types"])
            except (json.JSONDecodeError, TypeError):
                discovery_blocked_types = []

        # Parse tracked_telemetry_repeaters JSON
        tracked_telemetry_repeaters: list[str] = []
        try:
            raw_tracked = row["tracked_telemetry_repeaters"]
            if raw_tracked:
                tracked_telemetry_repeaters = json.loads(raw_tracked)
        except (json.JSONDecodeError, TypeError, KeyError):
            tracked_telemetry_repeaters = []

        return AppSettings(
            max_radio_contacts=row["max_radio_contacts"],
            favorites=favorites,
            auto_decrypt_dm_on_advert=bool(row["auto_decrypt_dm_on_advert"]),
            last_message_times=last_message_times,
            preferences_migrated=bool(row["preferences_migrated"]),
            advert_interval=row["advert_interval"] or 0,
            last_advert_time=row["last_advert_time"] or 0,
            flood_scope=row["flood_scope"] or "",
            blocked_keys=blocked_keys,
            blocked_names=blocked_names,
            discovery_blocked_types=discovery_blocked_types,
            tracked_telemetry_repeaters=tracked_telemetry_repeaters,
        )

    @staticmethod
    async def update(
        max_radio_contacts: int | None = None,
        favorites: list[Favorite] | None = None,
        auto_decrypt_dm_on_advert: bool | None = None,
        last_message_times: dict[str, int] | None = None,
        preferences_migrated: bool | None = None,
        advert_interval: int | None = None,
        last_advert_time: int | None = None,
        flood_scope: str | None = None,
        blocked_keys: list[str] | None = None,
        blocked_names: list[str] | None = None,
        discovery_blocked_types: list[int] | None = None,
        tracked_telemetry_repeaters: list[str] | None = None,
    ) -> AppSettings:
        """Update app settings. Only provided fields are updated."""
        updates = []
        params: list[Any] = []

        if max_radio_contacts is not None:
            updates.append("max_radio_contacts = ?")
            params.append(max_radio_contacts)

        if favorites is not None:
            updates.append("favorites = ?")
            favorites_json = json.dumps([f.model_dump() for f in favorites])
            params.append(favorites_json)

        if auto_decrypt_dm_on_advert is not None:
            updates.append("auto_decrypt_dm_on_advert = ?")
            params.append(1 if auto_decrypt_dm_on_advert else 0)

        if last_message_times is not None:
            updates.append("last_message_times = ?")
            params.append(json.dumps(last_message_times))

        if preferences_migrated is not None:
            updates.append("preferences_migrated = ?")
            params.append(1 if preferences_migrated else 0)

        if advert_interval is not None:
            updates.append("advert_interval = ?")
            params.append(advert_interval)

        if last_advert_time is not None:
            updates.append("last_advert_time = ?")
            params.append(last_advert_time)

        if flood_scope is not None:
            updates.append("flood_scope = ?")
            params.append(flood_scope)

        if blocked_keys is not None:
            updates.append("blocked_keys = ?")
            params.append(json.dumps(blocked_keys))

        if blocked_names is not None:
            updates.append("blocked_names = ?")
            params.append(json.dumps(blocked_names))

        if discovery_blocked_types is not None:
            updates.append("discovery_blocked_types = ?")
            params.append(json.dumps(discovery_blocked_types))

        if tracked_telemetry_repeaters is not None:
            updates.append("tracked_telemetry_repeaters = ?")
            params.append(json.dumps(tracked_telemetry_repeaters))

        if updates:
            query = f"UPDATE app_settings SET {', '.join(updates)} WHERE id = 1"
            await db.conn.execute(query, params)
            await db.conn.commit()

        return await AppSettingsRepository.get()

    @staticmethod
    async def add_favorite(fav_type: Literal["channel", "contact"], fav_id: str) -> AppSettings:
        """Add a favorite, avoiding duplicates."""
        settings = await AppSettingsRepository.get()

        # Check if already favorited
        if any(f.type == fav_type and f.id == fav_id for f in settings.favorites):
            return settings

        new_favorites = settings.favorites + [Favorite(type=fav_type, id=fav_id)]
        return await AppSettingsRepository.update(favorites=new_favorites)

    @staticmethod
    async def remove_favorite(fav_type: Literal["channel", "contact"], fav_id: str) -> AppSettings:
        """Remove a favorite."""
        settings = await AppSettingsRepository.get()
        new_favorites = [
            f for f in settings.favorites if not (f.type == fav_type and f.id == fav_id)
        ]
        return await AppSettingsRepository.update(favorites=new_favorites)

    @staticmethod
    async def toggle_blocked_key(key: str) -> AppSettings:
        """Toggle a public key in the blocked list. Keys are normalized to lowercase."""
        normalized = key.lower()
        settings = await AppSettingsRepository.get()
        if normalized in settings.blocked_keys:
            new_keys = [k for k in settings.blocked_keys if k != normalized]
        else:
            new_keys = settings.blocked_keys + [normalized]
        return await AppSettingsRepository.update(blocked_keys=new_keys)

    @staticmethod
    async def toggle_blocked_name(name: str) -> AppSettings:
        """Toggle a display name in the blocked list."""
        settings = await AppSettingsRepository.get()
        if name in settings.blocked_names:
            new_names = [n for n in settings.blocked_names if n != name]
        else:
            new_names = settings.blocked_names + [name]
        return await AppSettingsRepository.update(blocked_names=new_names)

    @staticmethod
    async def migrate_preferences_from_frontend(
        favorites: list[dict],
        sort_order: str,
        last_message_times: dict[str, int],
    ) -> tuple[AppSettings, bool]:
        """Migrate all preferences from frontend localStorage.

        This is a one-time migration. If already migrated, returns current settings
        without overwriting. Returns (settings, did_migrate) tuple.
        """
        settings = await AppSettingsRepository.get()

        if settings.preferences_migrated:
            # Already migrated, don't overwrite
            return settings, False

        # Convert frontend favorites format to Favorite objects
        new_favorites = []
        for f in favorites:
            if f.get("type") in ("channel", "contact") and f.get("id"):
                new_favorites.append(Favorite(type=f["type"], id=f["id"]))

        # Update with migrated preferences and mark as migrated
        settings = await AppSettingsRepository.update(
            favorites=new_favorites,
            last_message_times=last_message_times,
            preferences_migrated=True,
        )

        return settings, True


class StatisticsRepository:
    @staticmethod
    async def get_database_message_totals() -> dict[str, int]:
        """Return message totals needed by lightweight debug surfaces."""
        cursor = await db.conn.execute(
            """
            SELECT
                SUM(CASE WHEN type = 'PRIV' THEN 1 ELSE 0 END) AS total_dms,
                SUM(CASE WHEN type = 'CHAN' THEN 1 ELSE 0 END) AS total_channel_messages,
                SUM(CASE WHEN outgoing = 1 THEN 1 ELSE 0 END) AS total_outgoing
            FROM messages
            """
        )
        row = await cursor.fetchone()
        assert row is not None
        return {
            "total_dms": row["total_dms"] or 0,
            "total_channel_messages": row["total_channel_messages"] or 0,
            "total_outgoing": row["total_outgoing"] or 0,
        }

    @staticmethod
    async def _activity_counts(*, contact_type: int, exclude: bool = False) -> dict[str, int]:
        """Get time-windowed counts for contacts/repeaters heard."""
        now = int(time.time())
        op = "!=" if exclude else "="
        cursor = await db.conn.execute(
            f"""
            SELECT
                SUM(CASE WHEN last_seen >= ? THEN 1 ELSE 0 END) AS last_hour,
                SUM(CASE WHEN last_seen >= ? THEN 1 ELSE 0 END) AS last_24_hours,
                SUM(CASE WHEN last_seen >= ? THEN 1 ELSE 0 END) AS last_week
            FROM contacts
            WHERE type {op} ? AND last_seen IS NOT NULL
            """,
            (now - SECONDS_1H, now - SECONDS_24H, now - SECONDS_7D, contact_type),
        )
        row = await cursor.fetchone()
        assert row is not None  # Aggregate query always returns a row
        return {
            "last_hour": row["last_hour"] or 0,
            "last_24_hours": row["last_24_hours"] or 0,
            "last_week": row["last_week"] or 0,
        }

    @staticmethod
    async def _known_channels_active() -> dict[str, int]:
        """Count known channel keys with any traffic in each time window.

        Channel keys are stored canonically as uppercase hex, so we can avoid
        the old UPPER(...) join and aggregate per known channel directly.
        """
        now = int(time.time())
        cursor = await db.conn.execute(
            """
            WITH known AS (
                SELECT conversation_key, MAX(received_at) AS last_received_at
                FROM messages
                WHERE type = 'CHAN'
                  AND conversation_key IN (SELECT key FROM channels)
                GROUP BY conversation_key
            )
            SELECT
                SUM(CASE WHEN last_received_at >= ? THEN 1 ELSE 0 END) AS last_hour,
                SUM(CASE WHEN last_received_at >= ? THEN 1 ELSE 0 END) AS last_24_hours,
                SUM(CASE WHEN last_received_at >= ? THEN 1 ELSE 0 END) AS last_week
            FROM known
            """,
            (now - SECONDS_1H, now - SECONDS_24H, now - SECONDS_7D),
        )
        row = await cursor.fetchone()
        assert row is not None
        return {
            "last_hour": row["last_hour"] or 0,
            "last_24_hours": row["last_24_hours"] or 0,
            "last_week": row["last_week"] or 0,
        }

    @staticmethod
    async def _path_hash_width_24h() -> dict[str, int | float]:
        """Count parsed raw packets from the last 24h by hop hash width."""
        now = int(time.time())
        cursor = await db.conn.execute(
            "SELECT data FROM raw_packets WHERE timestamp >= ?",
            (now - SECONDS_24H,),
        )

        single_byte = 0
        double_byte = 0
        triple_byte = 0

        while True:
            rows = await cursor.fetchmany(RAW_PACKET_STATS_BATCH_SIZE)
            if not rows:
                break

            for row in rows:
                envelope = parse_packet_envelope(bytes(row["data"]))
                if envelope is None:
                    continue
                if envelope.hash_size == 1:
                    single_byte += 1
                elif envelope.hash_size == 2:
                    double_byte += 1
                elif envelope.hash_size == 3:
                    triple_byte += 1

        total_packets = single_byte + double_byte + triple_byte
        if total_packets == 0:
            return {
                "total_packets": 0,
                "single_byte": 0,
                "double_byte": 0,
                "triple_byte": 0,
                "single_byte_pct": 0.0,
                "double_byte_pct": 0.0,
                "triple_byte_pct": 0.0,
            }

        return {
            "total_packets": total_packets,
            "single_byte": single_byte,
            "double_byte": double_byte,
            "triple_byte": triple_byte,
            "single_byte_pct": (single_byte / total_packets) * 100,
            "double_byte_pct": (double_byte / total_packets) * 100,
            "triple_byte_pct": (triple_byte / total_packets) * 100,
        }

    @staticmethod
    async def get_all() -> dict:
        """Aggregate all statistics from existing tables."""
        now = int(time.time())

        # Top 5 busiest channels in last 24h
        cursor = await db.conn.execute(
            """
            SELECT m.conversation_key, COALESCE(c.name, m.conversation_key) AS channel_name,
                   COUNT(*) AS message_count
            FROM messages m
            LEFT JOIN channels c ON m.conversation_key = c.key
            WHERE m.type = 'CHAN' AND m.received_at >= ?
            GROUP BY m.conversation_key
            ORDER BY COUNT(*) DESC
            LIMIT 5
            """,
            (now - SECONDS_24H,),
        )
        rows = await cursor.fetchall()
        busiest_channels_24h = [
            {
                "channel_key": row["conversation_key"],
                "channel_name": row["channel_name"],
                "message_count": row["message_count"],
            }
            for row in rows
        ]

        # Entity counts
        cursor = await db.conn.execute("SELECT COUNT(*) AS cnt FROM contacts WHERE type != 2")
        row = await cursor.fetchone()
        assert row is not None
        contact_count: int = row["cnt"]

        cursor = await db.conn.execute("SELECT COUNT(*) AS cnt FROM contacts WHERE type = 2")
        row = await cursor.fetchone()
        assert row is not None
        repeater_count: int = row["cnt"]

        cursor = await db.conn.execute("SELECT COUNT(*) AS cnt FROM channels")
        row = await cursor.fetchone()
        assert row is not None
        channel_count: int = row["cnt"]

        # Packet split
        cursor = await db.conn.execute(
            """
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN message_id IS NOT NULL THEN 1 ELSE 0 END) AS decrypted
            FROM raw_packets
            """
        )
        pkt_row = await cursor.fetchone()
        assert pkt_row is not None
        total_packets = pkt_row["total"] or 0
        decrypted_packets = pkt_row["decrypted"] or 0
        undecrypted_packets = total_packets - decrypted_packets

        message_totals = await StatisticsRepository.get_database_message_totals()

        # Activity windows
        contacts_heard = await StatisticsRepository._activity_counts(contact_type=2, exclude=True)
        repeaters_heard = await StatisticsRepository._activity_counts(contact_type=2)
        known_channels_active = await StatisticsRepository._known_channels_active()
        path_hash_width_24h = await StatisticsRepository._path_hash_width_24h()

        return {
            "busiest_channels_24h": busiest_channels_24h,
            "contact_count": contact_count,
            "repeater_count": repeater_count,
            "channel_count": channel_count,
            "total_packets": total_packets,
            "decrypted_packets": decrypted_packets,
            "undecrypted_packets": undecrypted_packets,
            "total_dms": message_totals["total_dms"],
            "total_channel_messages": message_totals["total_channel_messages"],
            "total_outgoing": message_totals["total_outgoing"],
            "contacts_heard": contacts_heard,
            "repeaters_heard": repeaters_heard,
            "known_channels_active": known_channels_active,
            "path_hash_width_24h": path_hash_width_24h,
        }
