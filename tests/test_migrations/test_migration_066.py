"""Tests for migration 066: hop-cache GPS columns."""

import aiosqlite
import pytest

from app.migrations import run_migrations, set_version


class TestMigration066:
    @pytest.mark.asyncio
    async def test_adds_gps_columns(self):
        conn = await aiosqlite.connect(":memory:")
        conn.row_factory = aiosqlite.Row
        try:
            await set_version(conn, 65)
            await conn.execute(
                """
                CREATE TABLE directory_hop_cache (
                    prefix TEXT NOT NULL,
                    hash_width INTEGER NOT NULL,
                    name TEXT,
                    source TEXT NOT NULL,
                    expires_at INTEGER NOT NULL,
                    PRIMARY KEY (prefix, hash_width)
                )
                """
            )
            await conn.commit()

            await run_migrations(conn)

            columns = {
                row[1]
                for row in await (
                    await conn.execute("PRAGMA table_info(directory_hop_cache)")
                ).fetchall()
            }
            assert {"public_key", "lat", "lon"} <= columns
        finally:
            await conn.close()
