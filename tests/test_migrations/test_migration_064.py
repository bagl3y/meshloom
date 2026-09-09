"""Tests for migration 064: contact groups + stale_contact_days."""

import aiosqlite
import pytest

from app.migrations import run_migrations, set_version


class TestMigration064:
    @pytest.mark.asyncio
    async def test_adds_tables_and_stale_setting(self):
        conn = await aiosqlite.connect(":memory:")
        conn.row_factory = aiosqlite.Row
        try:
            await set_version(conn, 63)
            await conn.execute(
                """
                CREATE TABLE app_settings (
                    id INTEGER PRIMARY KEY,
                    max_radio_contacts INTEGER DEFAULT 200
                )
                """
            )
            await conn.execute("INSERT INTO app_settings (id) VALUES (1)")
            await conn.execute(
                """
                CREATE TABLE contacts (
                    public_key TEXT PRIMARY KEY,
                    name TEXT
                )
                """
            )
            await conn.commit()

            await run_migrations(conn)

            tables = {
                row[0]
                for row in await (
                    await conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
                ).fetchall()
            }
            assert "contact_groups" in tables
            assert "contact_group_members" in tables

            cursor = await conn.execute("SELECT stale_contact_days FROM app_settings WHERE id = 1")
            row = await cursor.fetchone()
            assert row["stale_contact_days"] == 0
        finally:
            await conn.close()
