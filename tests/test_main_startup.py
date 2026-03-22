"""Tests for app startup/lifespan behavior."""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from app.main import app, lifespan


class TestStartupLifespan:
    @pytest.mark.asyncio
    async def test_lifespan_does_not_wait_for_radio_setup(self):
        """HTTP serving should start before post-connect setup finishes."""
        setup_started = asyncio.Event()
        release_setup = asyncio.Event()

        async def slow_setup():
            setup_started.set()
            await release_setup.wait()

        with (
            patch("app.main.db.connect", new=AsyncMock()),
            patch("app.main.db.disconnect", new=AsyncMock()),
            patch("app.radio_sync.ensure_default_channels", new=AsyncMock()),
            patch("app.radio.radio_manager.start_connection_monitor", new=AsyncMock()),
            patch("app.radio.radio_manager.stop_connection_monitor", new=AsyncMock()),
            patch("app.radio.radio_manager.disconnect", new=AsyncMock()),
            patch("app.radio.radio_manager.reconnect", new=AsyncMock(return_value=True)),
            patch(
                "app.radio.radio_manager.post_connect_setup", new=AsyncMock(side_effect=slow_setup)
            ),
            patch("app.fanout.manager.fanout_manager.load_from_db", new=AsyncMock()),
            patch("app.fanout.manager.fanout_manager.stop_all", new=AsyncMock()),
            patch("app.radio_sync.stop_message_polling", new=AsyncMock()),
            patch("app.radio_sync.stop_periodic_advert", new=AsyncMock()),
            patch("app.radio_sync.stop_periodic_sync", new=AsyncMock()),
            patch("app.websocket.broadcast_health"),
        ):
            cm = lifespan(app)
            await asyncio.wait_for(cm.__aenter__(), timeout=0.2)

            await asyncio.wait_for(setup_started.wait(), timeout=0.2)
            startup_task = app.state.startup_radio_task
            assert startup_task.done() is False

            release_setup.set()
            await asyncio.wait_for(cm.__aexit__(None, None, None), timeout=0.5)
