import { useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../api';
import type { Message, ObserverReachCountState } from '../types';
import {
  isObserverReachEligible,
  isOutgoingReachReady,
  messageAgeMs,
  observerReachPollIntervalMs,
  OUTGOING_REACH_DELAY_MS,
  STALE_REACH_CACHE_MS,
} from '../utils/observerReach';

const DEBOUNCE_MS = 250;
const BATCH_MAX = 20;

const countCache = new Map<string, { at: number; state: ObserverReachCountState }>();
const lastFetchAt = new Map<string, number>();

function cacheKey(originConversation: string, hash: string): string {
  return `${originConversation}:${hash.toUpperCase()}`;
}

export function resetObserverReachCountCache(): void {
  countCache.clear();
  lastFetchAt.clear();
}

function readyVisibleHashes(messages: Message[], visibleIndexes: number[], now: number): string[] {
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
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const indexesRef = useRef(visibleIndexes);
  indexesRef.current = visibleIndexes;

  const hashSignature = useMemo(() => {
    if (!directoryEnabled || !conversationKey) return '';
    return readyVisibleHashes(messages, visibleIndexes, Date.now()).join(',');
  }, [directoryEnabled, conversationKey, messages, visibleIndexes, delayTick]);

  useEffect(() => {
    if (!directoryEnabled || !conversationKey) {
      return;
    }
    const startedFor = conversationKey;
    let cancelled = false;
    let wakeTimer: number | undefined;

    const nextWakeMs = (now: number): number | null => {
      let soonest: number | null = null;
      const consider = (wait: number) => {
        if (wait <= 0) return;
        soonest = soonest === null ? wait : Math.min(soonest, wait);
      };
      for (const index of indexesRef.current) {
        const msg = messagesRef.current[index];
        if (!msg || !isObserverReachEligible(msg)) continue;
        if (!isOutgoingReachReady(msg, now)) {
          consider(msg.received_at * 1000 + OUTGOING_REACH_DELAY_MS - now);
          continue;
        }
        const interval = observerReachPollIntervalMs(messageAgeMs(msg, now));
        if (interval == null) continue;
        const hash = msg.packet_hash!.toUpperCase();
        const last = lastFetchAt.get(cacheKey(startedFor, hash));
        if (last == null) {
          consider(1);
          continue;
        }
        consider(interval - (now - last));
      }
      return soonest;
    };

    const scheduleWake = () => {
      if (cancelled) return;
      const wait = nextWakeMs(Date.now());
      if (wait == null) return;
      wakeTimer = window.setTimeout(() => {
        setDelayTick((n) => n + 1);
      }, wait + 25);
    };

    const debounceTimer = window.setTimeout(() => {
      const now = Date.now();
      const toFetch: string[] = [];
      const fromCache: Record<string, ObserverReachCountState> = {};

      const visibleHashes = hashSignature ? hashSignature.split(',') : [];
      for (const hash of visibleHashes) {
        const key = cacheKey(startedFor, hash);
        const cached = countCache.get(key);
        const last = lastFetchAt.get(key);
        const msg = messagesRef.current.find((item) => item.packet_hash?.toUpperCase() === hash);
        const interval = msg != null ? observerReachPollIntervalMs(messageAgeMs(msg, now)) : null;
        const due =
          interval == null
            ? cached == null || now - cached.at >= STALE_REACH_CACHE_MS
            : last == null || now - last >= interval;
        if (due) {
          toFetch.push(hash);
          if (cached) {
            fromCache[hash] = cached.state;
          }
        } else if (cached) {
          fromCache[hash] = cached.state;
        }
      }

      if (Object.keys(fromCache).length > 0) {
        setCounts((prev) => ({ ...prev, ...fromCache }));
      }
      if (toFetch.length === 0) {
        scheduleWake();
        return;
      }

      void (async () => {
        const requested = toFetch.slice(0, BATCH_MAX);
        try {
          const response = await api.getPacketObserverReachCounts(requested);
          if (cancelled || conversationRef.current !== startedFor) return;
          const fetchedAt = Date.now();
          if (!response.directory_enabled) {
            const disabled: Record<string, ObserverReachCountState> = {};
            for (const hash of requested) {
              const state: ObserverReachCountState = { status: 'error' };
              const key = cacheKey(startedFor, hash);
              countCache.set(key, { at: fetchedAt, state });
              lastFetchAt.set(key, fetchedAt);
              disabled[hash] = state;
            }
            setCounts((prev) => ({ ...prev, ...disabled }));
            return;
          }
          const fetched: Record<string, ObserverReachCountState> = {};
          for (const hash of requested) {
            const count = response.counts[hash] ?? response.counts[hash.toLowerCase()];
            const state: ObserverReachCountState =
              typeof count === 'number' ? { status: 'ok', count } : { status: 'error' };
            const key = cacheKey(startedFor, hash);
            countCache.set(key, { at: fetchedAt, state });
            lastFetchAt.set(key, fetchedAt);
            fetched[hash] = state;
          }
          setCounts((prev) => ({ ...prev, ...fetched }));
        } catch {
          if (cancelled || conversationRef.current !== startedFor) return;
          const fetchedAt = Date.now();
          const failed: Record<string, ObserverReachCountState> = {};
          for (const hash of requested) {
            const state: ObserverReachCountState = { status: 'error' };
            const key = cacheKey(startedFor, hash);
            countCache.set(key, { at: fetchedAt, state });
            lastFetchAt.set(key, fetchedAt);
            failed[hash] = state;
          }
          setCounts((prev) => ({ ...prev, ...failed }));
        } finally {
          scheduleWake();
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
      if (wakeTimer != null) window.clearTimeout(wakeTimer);
    };
  }, [directoryEnabled, conversationKey, hashSignature, delayTick]);

  return { counts };
}
