"""Firmware-compatible flood-scope command helpers."""

from typing import Any

from meshcore import EventType
from meshcore.packets import CommandType

from app.region_scope import normalize_region_scope

SET_FLOOD_SCOPE_MODE_UNSCOPED = 1
FORCE_UNSCOPED_FRAME = bytes([CommandType.SET_FLOOD_SCOPE.value, SET_FLOOD_SCOPE_MODE_UNSCOPED])


async def set_radio_flood_scope(mc, scope: str | None) -> Any:
    """Apply the standing radio flood-scope state.

    A non-empty scope is delegated to meshcore_py's mode-0 ``set_flood_scope``.
    An empty scope means explicit unscoped/plain flood and must use firmware's
    mode-1 command. Sending a mode-0 all-zero key would fall back to the radio's
    configured default scope on firmware-compatible companions.
    """

    normalized_scope = normalize_region_scope(scope)
    if normalized_scope:
        return await mc.commands.set_flood_scope(normalized_scope)
    return await force_radio_unscoped(mc)


async def force_radio_unscoped(mc) -> Any:
    """Tell the radio to send following flood packets unscoped until mode 0."""

    return await mc.commands.send(FORCE_UNSCOPED_FRAME, [EventType.OK, EventType.ERROR])
