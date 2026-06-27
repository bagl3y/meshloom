from unittest.mock import AsyncMock, MagicMock

import pytest
from meshcore import EventType

from app.services.flood_scope import FORCE_UNSCOPED_FRAME, set_radio_flood_scope


@pytest.mark.asyncio
async def test_set_radio_flood_scope_uses_meshcore_scope_for_regions():
    mc = MagicMock()
    mc.commands.set_flood_scope = AsyncMock(return_value="ok")
    mc.commands.send = AsyncMock()

    result = await set_radio_flood_scope(mc, "Esperance")

    assert result == "ok"
    mc.commands.set_flood_scope.assert_awaited_once_with("#Esperance")
    mc.commands.send.assert_not_awaited()


@pytest.mark.asyncio
async def test_set_radio_flood_scope_empty_uses_firmware_unscoped_mode():
    mc = MagicMock()
    mc.commands.set_flood_scope = AsyncMock()
    mc.commands.send = AsyncMock(return_value="ok")

    result = await set_radio_flood_scope(mc, "")

    assert result == "ok"
    mc.commands.send.assert_awaited_once_with(FORCE_UNSCOPED_FRAME, [EventType.OK, EventType.ERROR])
    mc.commands.set_flood_scope.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("scope", [None, "   ", "0", "*"])
async def test_set_radio_flood_scope_unscoped_sentinels_use_firmware_mode(scope):
    mc = MagicMock()
    mc.commands.set_flood_scope = AsyncMock()
    mc.commands.send = AsyncMock(return_value="ok")

    result = await set_radio_flood_scope(mc, scope)

    assert result == "ok"
    mc.commands.send.assert_awaited_once_with(FORCE_UNSCOPED_FRAME, [EventType.OK, EventType.ERROR])
    mc.commands.set_flood_scope.assert_not_awaited()
