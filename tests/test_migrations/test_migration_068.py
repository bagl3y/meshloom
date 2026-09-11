"""Tests for migration 068: radio transport columns on app_settings."""

import aiosqlite
import pytest

from app.migrations import run_migrations, set_version


class TestMigration068:
    @pytest.mark.asyncio
    async def test_adds_radio_transport_columns(self):
        conn = await aiosqlite.connect(":memory:")
        conn.row_factory = aiosqlite.Row
        try:
            await set_version(conn, 67)
            await conn.execute(
                """
                CREATE TABLE app_settings (
                    id INTEGER PRIMARY KEY CHECK (id = 1)
                )
                """
            )
            await conn.execute("INSERT INTO app_settings (id) VALUES (1)")
            await conn.commit()

            await run_migrations(conn)

            columns = {
                row[1]
                for row in await (await conn.execute("PRAGMA table_info(app_settings)")).fetchall()
            }
            assert "radio_transport" in columns
            assert "radio_bound_public_key" in columns
            assert "radio_identity_state" in columns
            assert "radio_transport_env_imported" in columns
            assert "radio_ble_pin" in columns
        finally:
            await conn.close()
