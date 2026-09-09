"""Tests for migration 067: push subscription language."""

import aiosqlite
import pytest

from app.migrations import run_migrations, set_version


class TestMigration067:
    @pytest.mark.asyncio
    async def test_adds_language_column(self):
        conn = await aiosqlite.connect(":memory:")
        conn.row_factory = aiosqlite.Row
        try:
            await set_version(conn, 66)
            await conn.execute(
                """
                CREATE TABLE push_subscriptions (
                    id INTEGER PRIMARY KEY,
                    endpoint TEXT NOT NULL
                )
                """
            )
            await conn.commit()

            await run_migrations(conn)

            columns = {
                row[1]
                for row in await (
                    await conn.execute("PRAGMA table_info(push_subscriptions)")
                ).fetchall()
            }
            assert "language" in columns
        finally:
            await conn.close()
