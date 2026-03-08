import logging
from pathlib import Path

import aiosqlite

from app.config import settings

logger = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS contacts (
    public_key TEXT PRIMARY KEY,
    name TEXT,
    type INTEGER DEFAULT 0,
    flags INTEGER DEFAULT 0,
    last_path TEXT,
    last_path_len INTEGER DEFAULT -1,
    out_path_hash_mode INTEGER DEFAULT 0,
    last_advert INTEGER,
    lat REAL,
    lon REAL,
    last_seen INTEGER,
    on_radio INTEGER DEFAULT 0,
    last_contacted INTEGER,
    first_seen INTEGER
);

CREATE TABLE IF NOT EXISTS channels (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_hashtag INTEGER DEFAULT 0,
    on_radio INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    conversation_key TEXT NOT NULL,
    text TEXT NOT NULL,
    sender_timestamp INTEGER,
    received_at INTEGER NOT NULL,
    path TEXT,
    txt_type INTEGER DEFAULT 0,
    signature TEXT,
    outgoing INTEGER DEFAULT 0,
    acked INTEGER DEFAULT 0,
    sender_name TEXT,
    sender_key TEXT
    -- Deduplication: identical text + timestamp in the same conversation is treated as a
    -- mesh echo/repeat. Second-precision timestamps mean two intentional identical messages
    -- within the same second would collide, but this is not feasible in practice — LoRa
    -- transmission takes several seconds per message, and the UI clears the input on send.
    -- Enforced via idx_messages_dedup_null_safe (unique index) rather than a table constraint
    -- to avoid the storage overhead of SQLite's autoindex duplicating every message text.
);

CREATE TABLE IF NOT EXISTS raw_packets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    data BLOB NOT NULL,
    message_id INTEGER,
    payload_hash BLOB,
    FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE TABLE IF NOT EXISTS contact_advert_paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_key TEXT NOT NULL,
    path_hex TEXT NOT NULL,
    path_len INTEGER NOT NULL,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    heard_count INTEGER NOT NULL DEFAULT 1,
    UNIQUE(public_key, path_hex, path_len),
    FOREIGN KEY (public_key) REFERENCES contacts(public_key)
);

CREATE TABLE IF NOT EXISTS contact_name_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_key TEXT NOT NULL,
    name TEXT NOT NULL,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    UNIQUE(public_key, name),
    FOREIGN KEY (public_key) REFERENCES contacts(public_key)
);

CREATE INDEX IF NOT EXISTS idx_messages_received ON messages(received_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_dedup_null_safe
    ON messages(type, conversation_key, text, COALESCE(sender_timestamp, 0));
CREATE INDEX IF NOT EXISTS idx_raw_packets_message_id ON raw_packets(message_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_packets_payload_hash ON raw_packets(payload_hash);
CREATE INDEX IF NOT EXISTS idx_contacts_on_radio ON contacts(on_radio);
-- idx_messages_sender_key is created by migration 25 (after adding the sender_key column)
CREATE INDEX IF NOT EXISTS idx_contact_advert_paths_recent
    ON contact_advert_paths(public_key, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_contact_name_history_key
    ON contact_name_history(public_key, last_seen DESC);
"""


class Database:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._connection: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        logger.info("Connecting to database at %s", self.db_path)
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._connection = await aiosqlite.connect(self.db_path)
        self._connection.row_factory = aiosqlite.Row

        # WAL mode: faster writes, concurrent readers during writes, no journal file churn.
        # Persists in the DB file but we set it explicitly on every connection.
        await self._connection.execute("PRAGMA journal_mode = WAL")

        # Incremental auto-vacuum: freed pages are reclaimable via
        # PRAGMA incremental_vacuum without a full VACUUM. Must be set before
        # the first table is created (for new databases); for existing databases
        # migration 20 handles the one-time VACUUM to restructure the file.
        await self._connection.execute("PRAGMA auto_vacuum = INCREMENTAL")

        await self._connection.executescript(SCHEMA)
        await self._connection.commit()
        logger.debug("Database schema initialized")

        # Run any pending migrations
        from app.migrations import run_migrations

        await run_migrations(self._connection)

    async def disconnect(self) -> None:
        if self._connection:
            await self._connection.close()
            self._connection = None
            logger.debug("Database connection closed")

    @property
    def conn(self) -> aiosqlite.Connection:
        if not self._connection:
            raise RuntimeError("Database not connected")
        return self._connection


db = Database(settings.database_path)
