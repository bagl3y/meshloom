import { describe, expect, it } from 'vitest';

import type { Message } from '../types';
import { isObserverReachEligible } from '../utils/observerReach';

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    type: 'CHAN',
    conversation_key: 'C3B889530D4F02DB5662EA13C417F530',
    text: 'Alice: hello',
    sender_timestamp: 1700000000,
    received_at: 1700000001,
    paths: null,
    txt_type: 0,
    signature: null,
    sender_key: null,
    outgoing: false,
    acked: 0,
    sender_name: 'Alice',
    packet_hash: 'AABBCCDDEEFF0011',
    observer_reach_eligible: true,
    ...overrides,
  };
}

describe('isObserverReachEligible', () => {
  it('allows channel messages with a hash', () => {
    expect(isObserverReachEligible(message({ type: 'CHAN' }))).toBe(true);
  });

  it('rejects direct messages that were not flood', () => {
    expect(
      isObserverReachEligible(
        message({
          type: 'PRIV',
          observer_reach_eligible: false,
        })
      )
    ).toBe(false);
    expect(
      isObserverReachEligible(
        message({
          type: 'PRIV',
          observer_reach_eligible: null,
        })
      )
    ).toBe(false);
  });

  it('allows flood DMs with a hash', () => {
    expect(
      isObserverReachEligible(
        message({
          type: 'PRIV',
          observer_reach_eligible: true,
        })
      )
    ).toBe(true);
  });

  it('rejects messages without a hash', () => {
    expect(isObserverReachEligible(message({ packet_hash: null }))).toBe(false);
  });
});
