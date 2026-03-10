import { describe, expect, it } from 'vitest';

import { parseWsEvent } from '../wsEvents';

describe('wsEvents', () => {
  it('parses contact_deleted events', () => {
    const event = parseWsEvent(
      JSON.stringify({ type: 'contact_deleted', data: { public_key: 'aa' } })
    );

    expect(event).toEqual({
      type: 'contact_deleted',
      data: { public_key: 'aa' },
    });
  });

  it('parses channel_deleted events', () => {
    const event = parseWsEvent(JSON.stringify({ type: 'channel_deleted', data: { key: 'bb' } }));

    expect(event).toEqual({
      type: 'channel_deleted',
      data: { key: 'bb' },
    });
  });

  it('returns unknown events with rawType preserved', () => {
    const event = parseWsEvent(JSON.stringify({ type: 'mystery', data: { ok: true } }));

    expect(event).toEqual({
      type: 'unknown',
      rawType: 'mystery',
      data: { ok: true },
    });
  });

  it('rejects invalid envelopes', () => {
    expect(() => parseWsEvent(JSON.stringify({ data: {} }))).toThrow(
      'Invalid WebSocket event envelope'
    );
  });
});
