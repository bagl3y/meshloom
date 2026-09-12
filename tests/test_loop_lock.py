"""LoopBoundLock must survive pytest-asyncio's per-test event loops."""

import asyncio

import pytest

from app.loop_lock import LoopBoundLock, LoopBoundSemaphore


def test_lock_can_be_reused_after_the_event_loop_changes():
    lock = LoopBoundLock()

    async def _use() -> None:
        async with lock:
            pass

    first = asyncio.new_event_loop()
    second = asyncio.new_event_loop()
    try:
        first.run_until_complete(_use())
        second.run_until_complete(_use())
    finally:
        first.close()
        second.close()


def test_semaphore_can_be_reused_after_the_event_loop_changes():
    semaphore = LoopBoundSemaphore(2)

    async def _use() -> None:
        async with semaphore:
            pass

    first = asyncio.new_event_loop()
    second = asyncio.new_event_loop()
    try:
        first.run_until_complete(_use())
        second.run_until_complete(_use())
    finally:
        first.close()
        second.close()


@pytest.mark.asyncio
async def test_lock_still_serializes_concurrent_tasks_on_one_loop():
    lock = LoopBoundLock()
    order: list[str] = []

    async def _hold(name: str) -> None:
        async with lock:
            order.append(f"{name}-enter")
            await asyncio.sleep(0)
            order.append(f"{name}-exit")

    await asyncio.gather(_hold("a"), _hold("b"))
    assert order in (
        ["a-enter", "a-exit", "b-enter", "b-exit"],
        ["b-enter", "b-exit", "a-enter", "a-exit"],
    )
