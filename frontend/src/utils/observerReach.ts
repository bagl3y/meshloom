import type { Message } from '../types';

export const OUTGOING_REACH_DELAY_MS = 20_000;

export function isObserverReachEligible(msg: Message): boolean {
  if (!msg.packet_hash) return false;
  if (msg.type === 'CHAN') return msg.observer_reach_eligible !== false;
  return msg.observer_reach_eligible === true;
}

export function isOutgoingReachReady(msg: Message, nowMs: number = Date.now()): boolean {
  if (!msg.outgoing) return true;
  return nowMs - msg.received_at * 1000 >= OUTGOING_REACH_DELAY_MS;
}
