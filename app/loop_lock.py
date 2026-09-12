"""Event-loop-aware asyncio primitives for process-wide coordination."""

from __future__ import annotations

import asyncio


class LoopBoundLock:
    """An ``asyncio.Lock`` that rebinds when the running event loop changes.

    A module-level ``asyncio.Lock()`` binds to the first loop that acquires it.
    pytest-asyncio 1.x uses a fresh function-scoped loop per test, so a later
    test in the same xdist worker would raise
    ``RuntimeError: Lock is bound to a different event loop``. Production
    uvicorn keeps one loop for the process lifetime, so this stays a no-op
    there.
    """

    def __init__(self) -> None:
        self._lock: asyncio.Lock | None = None
        self._loop: asyncio.AbstractEventLoop | None = None

    def _for_running_loop(self) -> asyncio.Lock:
        loop = asyncio.get_running_loop()
        if self._lock is None or self._loop is not loop:
            self._lock = asyncio.Lock()
            self._loop = loop
        return self._lock

    async def __aenter__(self) -> asyncio.Lock:
        lock = self._for_running_loop()
        await lock.acquire()
        return lock

    async def __aexit__(self, exc_type, exc, tb) -> None:
        self._for_running_loop().release()


class LoopBoundSemaphore:
    """An ``asyncio.Semaphore`` that rebinds when the running event loop changes."""

    def __init__(self, value: int) -> None:
        self._value = value
        self._semaphore: asyncio.Semaphore | None = None
        self._loop: asyncio.AbstractEventLoop | None = None

    def _for_running_loop(self) -> asyncio.Semaphore:
        loop = asyncio.get_running_loop()
        if self._semaphore is None or self._loop is not loop:
            self._semaphore = asyncio.Semaphore(self._value)
            self._loop = loop
        return self._semaphore

    async def __aenter__(self) -> asyncio.Semaphore:
        semaphore = self._for_running_loop()
        await semaphore.acquire()
        return semaphore

    async def __aexit__(self, exc_type, exc, tb) -> None:
        self._for_running_loop().release()
