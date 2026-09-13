import { useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../api';
import type { Message, ObserverReachCountState } from '../types';
import {
  isObserverReachEligible,
  isOutgoingReachReady,
  messageAgeMs,
  observerReachPollIntervalMs,
  OUTGOING_REACH_DELAY_MS,
} from '../utils/observerReach';

const DEBOUNCE_MS = 250;
const BATCH_MAX = 20;
const RETRY_BACKOFF_MS = 30_000;
const RETRY_BACKOFF_MAX_MS = 4 * 60_000;

type CountCacheEntry = {
  at: number;
  state: ObserverReachCountState;
  sealed: boolean;
  failures: number;
};

const countCache = new Map<string, CountCacheEntry>();
const lastFetchAt = new Map<string, number>();

function retryBackoffMs(failures: number): number {
  const exp = Math.max(failures - 1, 0);
  return Math.min(RETRY_BACKOFF_MS * 2 ** exp, RETRY_BACKOFF_MAX_MS);
}

function responseSealed(sealed: Record<string, boolean> | undefined, hash: string): boolean {
  return sealed?.[hash] === true || sealed?.[hash.toLowerCase()] === true;
}

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
        const hash = msg.packet_hash!.toUpperCase();
        const key = cacheKey(startedFor, hash);
        const entry = countCache.get(key);
        if (entry?.sealed) continue;
        const interval = observerReachPollIntervalMs(messageAgeMs(msg, now));
        const last = lastFetchAt.get(key);
        if (last == null) {
          consider(1);
          continue;
        }
        const waitFor = interval ?? retryBackoffMs(entry?.failures ?? 1);
        consider(waitFor - (now - last));
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
        const due = cached?.sealed
          ? false
          : interval != null
            ? last == null || now - last >= interval
            : last == null || now - last >= retryBackoffMs(cached?.failures ?? 0);
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
              const prev = countCache.get(key);
              countCache.set(key, {
                at: fetchedAt,
                state,
                sealed: false,
                failures: (prev?.failures ?? 0) + 1,
              });
              lastFetchAt.set(key, fetchedAt);
              disabled[hash] = state;
            }
            setCounts((prev) => ({ ...prev, ...disabled }));
            return;
          }
          const fetched: Record<string, ObserverReachCountState> = {};
          for (const hash of requested) {
            const count = response.counts[hash] ?? response.counts[hash.toLowerCase()];
            const sealed = responseSealed(response.sealed, hash);
            const state: ObserverReachCountState =
              typeof count === 'number' ? { status: 'ok', count } : { status: 'error' };
            const key = cacheKey(startedFor, hash);
            const prev = countCache.get(key);
            const final = sealed && state.status === 'ok';
            countCache.set(key, {
              at: fetchedAt,
              state,
              sealed: final,
              failures: final ? 0 : (prev?.failures ?? 0) + 1,
            });
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
            const prev = countCache.get(key);
            countCache.set(key, {
              at: fetchedAt,
              state,
              sealed: false,
              failures: (prev?.failures ?? 0) + 1,
            });
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
