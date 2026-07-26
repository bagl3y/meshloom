/**
 * Real-layout harness for MessageList.
 *
 * jsdom has no layout engine, so windowing and scroll anchoring cannot be
 * verified there. This mounts the real component in a real browser at a fixed
 * viewport and exposes a control surface on `window` for a CDP driver.
 */
import { createRoot } from 'react-dom/client';
import { StrictMode, useMemo, useState } from 'react';
import { MessageList } from '../src/components/MessageList';
import type { Message } from '../src/types';
import '../src/index.css';

const CHANNEL_KEY = 'AA'.repeat(16);

function makeMessage(i: number, opts: { long?: boolean } = {}): Message {
  const body = opts.long
    ? `message ${i} ` + 'wrapped filler text to force multi-line layout '.repeat(4)
    : `message ${i}`;
  return {
    id: i + 1,
    type: 'CHAN',
    conversation_key: CHANNEL_KEY,
    text: `Alice: ${body}`,
    sender_timestamp: 1700000000 + i,
    received_at: 1700000000 + i,
    paths: null,
    txt_type: 0,
    signature: null,
    sender_key: null,
    outgoing: false,
    acked: 0,
    sender_name: 'Alice',
  };
}

function buildMessages(count: number, longEvery = 0): Message[] {
  return Array.from({ length: count }, (_, i) =>
    makeMessage(i, { long: longEvery > 0 && i % longEvery === 0 })
  );
}

interface HarnessState {
  count: number;
  longEvery: number;
  hasOlderMessages: boolean;
  loadingOlder: boolean;
  targetMessageId: number | null;
  unreadMarkerLastReadAt: number | null | undefined;
  prepended: number;
}

function Harness() {
  const q = new URLSearchParams(location.search);
  const [state, setState] = useState<HarnessState>({
    count: Number(q.get('count') ?? 500),
    longEvery: Number(q.get('longEvery') ?? 0),
    hasOlderMessages: q.get('hasOlder') === '1',
    loadingOlder: false,
    targetMessageId: null,
    // ?unread=1 puts the unread boundary before all loaded history, like a channel
    // with thousands unread.
    unreadMarkerLastReadAt: q.get('unread') === '1' ? 1600000000 : undefined,
    prepended: 0,
  });

  // Prepending shifts ids negative so existing rows keep their identity, which is
  // what the real app does when older history loads in. Memoized so the array
  // identity is stable across unrelated re-renders, matching the real app.
  const messages = useMemo(() => {
    const base = buildMessages(state.count, state.longEvery);
    const older = Array.from({ length: state.prepended }, (_, i) => {
      const m = makeMessage(-(state.prepended - i));
      m.id = -(state.prepended - i);
      m.received_at = 1700000000 - (state.prepended - i);
      m.sender_timestamp = m.received_at;
      return m;
    });
    return [...older, ...base];
  }, [state.count, state.longEvery, state.prepended]);

  (window as unknown as Record<string, unknown>).__setHarness = (next: Partial<HarnessState>) =>
    setState((prev) => ({ ...prev, ...next }));
  (window as unknown as Record<string, unknown>).__messages = messages;

  return (
    <div style={{ height: '600px', width: '900px', display: 'flex', flexDirection: 'column' }}>
      <MessageList
        messages={messages}
        contacts={[]}
        loading={false}
        hasOlderMessages={state.hasOlderMessages}
        loadingOlder={state.loadingOlder}
        targetMessageId={state.targetMessageId}
        unreadMarkerLastReadAt={state.unreadMarkerLastReadAt}
        radioName="TestNode"
      />
    </div>
  );
}

const params = new URLSearchParams(location.search);

// Churn recorder. Installed before the first render so it captures the initial
// mount, which is where a large history does its flickering.
{
  const churn = { rowEvents: 0, windows: new Set<string>(), frames: 0 };
  (window as unknown as Record<string, unknown>).__churn = churn;
  const obs = new MutationObserver((recs) => {
    for (const r of recs) churn.rowEvents += r.addedNodes.length + r.removedNodes.length;
  });
  obs.observe(document.getElementById('root')!, { childList: true, subtree: true });
  const t0 = performance.now();
  const sample = () => {
    churn.frames++;
    const ids = [...document.querySelectorAll('[data-message-id]')].map((e) =>
      e.getAttribute('data-message-id')
    );
    if (ids.length) churn.windows.add(ids[0] + ':' + ids[ids.length - 1]);
    if (performance.now() - t0 < 4000) requestAnimationFrame(sample);
    else obs.disconnect();
  };
  requestAnimationFrame(sample);
}

// ?strict=0 isolates StrictMode's double-mount (dev-only) from real behavior.
const useStrict = params.get('strict') !== '0';
createRoot(document.getElementById('root')!).render(
  useStrict ? (
    <StrictMode>
      <Harness />
    </StrictMode>
  ) : (
    <Harness />
  )
);
