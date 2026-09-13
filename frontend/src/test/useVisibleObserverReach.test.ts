import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resetObserverReachCountCache,
  useVisibleObserverReach,
} from '../hooks/useVisibleObserverReach';
import type { Message } from '../types';

const getCounts = vi.hoisted(() => vi.fn());

vi.mock('../api', () => ({
  api: {
    getPacketObserverReachCounts: (...args: [string[]]) => getCounts(...args),
  },
}));

function channelMessage(receivedAt: number): Message {
  return {
    id: 1,
    type: 'CHAN',
    conversation_key: 'C3B889530D4F02DB5662EA13C417F530',
    text: 'Alice: hello',
    sender_timestamp: receivedAt,
    received_at: receivedAt,
    paths: null,
    txt_type: 0,
    signature: null,
    sender_key: null,
    outgoing: false,
    acked: 0,
    sender_name: 'Alice',
    packet_hash: 'AABBCCDDEEFF0011',
    observer_reach_eligible: true,
  };
}

describe('useVisibleObserverReach', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetObserverReachCountCache();
    getCounts.mockReset();
    getCounts.mockResolvedValue({
      directory_enabled: true,
      counts: { AABBCCDDEEFF0011: 2 },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refetches a 30-second-old visible message', async () => {
    const receivedAt = Math.floor(Date.now() / 1000) - 30;
    renderHook(() =>
      useVisibleObserverReach({
        directoryEnabled: true,
        conversationKey: 'C3B889530D4F02DB5662EA13C417F530',
        messages: [channelMessage(receivedAt)],
        visibleIndexes: [0],
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(getCounts).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_050);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(getCounts).toHaveBeenCalledTimes(2);
  });

  it('does not loop-refetch a 15-minute-old message', async () => {
    const receivedAt = Math.floor(Date.now() / 1000) - 15 * 60;
    renderHook(() =>
      useVisibleObserverReach({
        directoryEnabled: true,
        conversationKey: 'C3B889530D4F02DB5662EA13C417F530',
        messages: [channelMessage(receivedAt)],
        visibleIndexes: [0],
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(getCounts).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(getCounts).toHaveBeenCalledTimes(1);
  });

  it('keeps counts when the messages array is replaced with the same hashes', async () => {
    const receivedAt = Math.floor(Date.now() / 1000) - 15 * 60;
    const first = channelMessage(receivedAt);
    const { rerender, result } = renderHook(
      ({ messages }: { messages: Message[] }) =>
        useVisibleObserverReach({
          directoryEnabled: true,
          conversationKey: 'C3B889530D4F02DB5662EA13C417F530',
          messages,
          visibleIndexes: [0],
        }),
      { initialProps: { messages: [first] } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(getCounts).toHaveBeenCalledTimes(1);
    expect(result.current.counts.AABBCCDDEEFF0011).toEqual({ status: 'ok', count: 2 });

    rerender({ messages: [{ ...first }] });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(getCounts).toHaveBeenCalledTimes(1);
    expect(result.current.counts.AABBCCDDEEFF0011).toEqual({ status: 'ok', count: 2 });
  });
});
