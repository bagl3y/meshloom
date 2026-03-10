"""Shared access seam over the global RadioManager instance.

This module deliberately keeps behavior thin and forwarding-only. The goal is
to reduce direct `app.radio.radio_manager` imports across routers and helpers
without changing radio lifecycle, lock, or connection semantics.
"""

from collections.abc import Callable
from contextlib import asynccontextmanager
from typing import Any

from fastapi import HTTPException

import app.radio as radio_module


class RadioRuntime:
    """Thin wrapper around the process-global RadioManager."""

    def __init__(self, manager_or_getter=None):
        if manager_or_getter is None:
            self._manager_getter: Callable[[], Any] = lambda: radio_module.radio_manager
        elif callable(manager_or_getter):
            self._manager_getter = manager_or_getter
        else:
            self._manager_getter = lambda: manager_or_getter

    @property
    def manager(self) -> Any:
        return self._manager_getter()

    @property
    def meshcore(self):
        return self.manager.meshcore

    @property
    def connection_info(self) -> str | None:
        return self.manager.connection_info

    @property
    def is_connected(self) -> bool:
        return self.manager.is_connected

    @property
    def is_reconnecting(self) -> bool:
        return self.manager.is_reconnecting

    @property
    def is_setup_in_progress(self) -> bool:
        return self.manager.is_setup_in_progress

    @property
    def is_setup_complete(self) -> bool:
        return self.manager.is_setup_complete

    @property
    def path_hash_mode(self) -> int:
        return self.manager.path_hash_mode

    @path_hash_mode.setter
    def path_hash_mode(self, mode: int) -> None:
        self.manager.path_hash_mode = mode

    @property
    def path_hash_mode_supported(self) -> bool:
        return self.manager.path_hash_mode_supported

    @path_hash_mode_supported.setter
    def path_hash_mode_supported(self, supported: bool) -> None:
        self.manager.path_hash_mode_supported = supported

    def require_connected(self):
        """Return MeshCore when available, mirroring existing HTTP semantics."""
        if self.is_setup_in_progress:
            raise HTTPException(status_code=503, detail="Radio is initializing")
        mc = self.meshcore
        if not self.is_connected or mc is None:
            raise HTTPException(status_code=503, detail="Radio not connected")
        return mc

    @asynccontextmanager
    async def radio_operation(self, name: str, **kwargs):
        async with self.manager.radio_operation(name, **kwargs) as mc:
            yield mc

    async def start_connection_monitor(self) -> None:
        await self.manager.start_connection_monitor()

    async def stop_connection_monitor(self) -> None:
        await self.manager.stop_connection_monitor()

    async def disconnect(self) -> None:
        await self.manager.disconnect()

    async def prepare_connected(self, *, broadcast_on_success: bool = True) -> None:
        from app.services.radio_lifecycle import prepare_connected_radio

        await prepare_connected_radio(self.manager, broadcast_on_success=broadcast_on_success)

    async def reconnect_and_prepare(self, *, broadcast_on_success: bool = True) -> bool:
        from app.services.radio_lifecycle import reconnect_and_prepare_radio

        return await reconnect_and_prepare_radio(
            self.manager,
            broadcast_on_success=broadcast_on_success,
        )


radio_runtime = RadioRuntime()
