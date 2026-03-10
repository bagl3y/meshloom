from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.radio_lifecycle import prepare_connected_radio, reconnect_and_prepare_radio


class TestPrepareConnectedRadio:
    @pytest.mark.asyncio
    async def test_runs_setup_then_broadcasts_health(self):
        radio_manager = MagicMock()
        radio_manager._last_connected = False
        radio_manager.connection_info = "TCP: test:4000"

        call_order: list[str] = []

        async def _setup():
            call_order.append("setup")

        radio_manager.post_connect_setup = AsyncMock(side_effect=_setup)

        with patch("app.websocket.broadcast_health") as mock_broadcast:
            await prepare_connected_radio(radio_manager, broadcast_on_success=True)

        assert call_order == ["setup"]
        assert radio_manager._last_connected is True
        mock_broadcast.assert_called_once_with(True, "TCP: test:4000")

    @pytest.mark.asyncio
    async def test_can_skip_broadcast(self):
        radio_manager = MagicMock()
        radio_manager._last_connected = False
        radio_manager.connection_info = "TCP: test:4000"
        radio_manager.post_connect_setup = AsyncMock()

        with patch("app.websocket.broadcast_health") as mock_broadcast:
            await prepare_connected_radio(radio_manager, broadcast_on_success=False)

        assert radio_manager._last_connected is True
        mock_broadcast.assert_not_called()


class TestReconnectAndPrepareRadio:
    @pytest.mark.asyncio
    async def test_reconnects_without_early_health_broadcast(self):
        radio_manager = MagicMock()
        radio_manager._last_connected = False
        radio_manager.connection_info = "Serial: /dev/ttyUSB0"

        reconnect_calls: list[bool] = []
        call_order: list[str] = []

        async def _reconnect(*, broadcast_on_success: bool):
            reconnect_calls.append(broadcast_on_success)
            call_order.append("reconnect")
            return True

        async def _setup():
            call_order.append("setup")

        radio_manager.reconnect = AsyncMock(side_effect=_reconnect)
        radio_manager.post_connect_setup = AsyncMock(side_effect=_setup)

        with patch("app.websocket.broadcast_health") as mock_broadcast:
            result = await reconnect_and_prepare_radio(radio_manager, broadcast_on_success=True)

        assert result is True
        assert reconnect_calls == [False]
        assert call_order == ["reconnect", "setup"]
        assert radio_manager._last_connected is True
        mock_broadcast.assert_called_once_with(True, "Serial: /dev/ttyUSB0")

    @pytest.mark.asyncio
    async def test_returns_false_without_running_setup_when_reconnect_fails(self):
        radio_manager = MagicMock()
        radio_manager.reconnect = AsyncMock(return_value=False)
        radio_manager.post_connect_setup = AsyncMock()

        with patch("app.websocket.broadcast_health") as mock_broadcast:
            result = await reconnect_and_prepare_radio(radio_manager, broadcast_on_success=True)

        assert result is False
        radio_manager.post_connect_setup.assert_not_awaited()
        mock_broadcast.assert_not_called()
