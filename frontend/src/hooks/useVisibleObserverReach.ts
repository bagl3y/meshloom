import { useEffect, useMemo, useRef, useState } from 'react';

import { api, ApiError } from '../api';
import type { Message, ObserverReachCountState } from '../types';
import {
  isObserverReachEligible,
  isOutgoingReachReady,
  OUTGOING_REACH_DELAY_MS,
} from '../utils/observerReach';

const COUNT_CACHE_MS = 90_000;
const DEBOUNCE_MS = 250;
const BATCH_MAX = 20;

const countCache = new Map<string, { at: number; state: ObserverReachCountState }>();

function cacheKey(originConversation: string, hash: string): string {
  return `${originConversation}:${hash.toUpperCase()}`;
}

export function useVisibleObserverReach(options: {
  directoryEnabled: boolean;
  conversationKey: string | undefined;
  messages: Message[];
  visibleIndexes: number[];
}): {
  counts: Record<string, ObserverReachCountState>;
} {
  const { directoryEnabled, conversationKey, messages, visibleIndexes } = options;
  const [counts, setCounts] = useState<Record<string, ObserverReachCountState>>({});
  const [delayTick, setDelayTick] = useState(0);
  const conversationRef = useRef(conversationKey);
  conversationRef.current = conversationKey;

  const visibleHashes = useMemo(() => {
    if (!directoryEnabled || !conversationKey) return [];
    const now = Date.now();
    const hashes: string[] = [];
    const seen = new Set<string>();
    for (const index of visibleIndexes) {
      const msg = messages[index];
      if (!msg || !isObserverReachEligible(msg) || !isOutgoingReachReady(msg, now)) continue;
      const hash = msg.packet_hash!.toUpperCase();
      if (seen.has(hash)) continue;
      seen.add(hash);
      hashes.push(hash);
    }
    return hashes;
  }, [directoryEnabled, conversationKey, messages, visibleIndexes, delayTick]);

  const nextOutgoingDelayMs = useMemo(() => {
    if (!directoryEnabled) return null;
    const now = Date.now();
    let soonest: number | null = null;
    for (const index of visibleIndexes) {
      const msg = messages[index];
      if (!msg || !msg.outgoing || !isObserverReachEligible(msg)) continue;
      const wait = msg.received_at * 1000 + OUTGOING_REACH_DELAY_MS - now;
      if (wait <= 0) continue;
      soonest = soonest === null ? wait : Math.min(soonest, wait);
    }
    return soonest;
  }, [directoryEnabled, messages, visibleIndexes]);

  useEffect(() => {
    if (nextOutgoingDelayMs == null) return;
    const timer = window.setTimeout(() => setDelayTick((n) => n + 1), nextOutgoingDelayMs + 25);
    return () => window.clearTimeout(timer);
  }, [nextOutgoingDelayMs, delayTick]);

  useEffect(() => {
    if (!directoryEnabled || !conversationKey || visibleHashes.length === 0) {
      return;
    }
    const startedFor = conversationKey;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      const toFetch: string[] = [];
      const next: Record<string, ObserverReachCountState> = {};
      for (const hash of visibleHashes) {
        const cached = countCache.get(cacheKey(startedFor, hash));
        if (cached && now - cached.at < COUNT_CACHE_MS) {
          next[hash] = cached.state;
          continue;
        }
        next[hash] = { status: 'loading' };
        toFetch.push(hash);
      }
      setCounts((prev) => ({ ...prev, ...next }));
      if (toFetch.length === 0) return;

      void (async () => {
        try {
          const response = await api.getPacketObserverReachCounts(toFetch.slice(0, BATCH_MAX));
          if (cancelled || conversationRef.current !== startedFor) return;
          if (!response.directory_enabled) {
            const disabled: Record<string, ObserverReachCountState> = {};
            for (const hash of toFetch) {
              const state: ObserverReachCountState = { status: 'error' };
              countCache.set(cacheKey(startedFor, hash), { at: Date.now(), state });
              disabled[hash] = state;
            }
            setCounts((prev) => ({ ...prev, ...disabled }));
            return;
          }
          const fetched: Record<string, ObserverReachCountState> = {};
          for (const hash of toFetch) {
            const count = response.counts[hash] ?? response.counts[hash.toLowerCase()];
            const state: ObserverReachCountState =
              typeof count === 'number' ? { status: 'ok', count } : { status: 'error' };
            countCache.set(cacheKey(startedFor, hash), { at: Date.now(), state });
            fetched[hash] = state;
          }
          setCounts((prev) => ({ ...prev, ...fetched }));
        } catch (error) {
          if (cancelled || conversationRef.current !== startedFor) return;
          const isDown = error instanceof ApiError && error.status >= 500;
          const failed: Record<string, ObserverReachCountState> = {};
          for (const hash of toFetch) {
            const state: ObserverReachCountState = isDown
              ? { status: 'error' }
              : { status: 'error' };
            countCache.set(cacheKey(startedFor, hash), { at: Date.now(), state });
            failed[hash] = state;
          }
          setCounts((prev) => ({ ...prev, ...failed }));
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [directoryEnabled, conversationKey, visibleHashes]);

  return { counts };
}
