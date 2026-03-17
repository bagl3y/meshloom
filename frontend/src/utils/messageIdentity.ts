import type { Message } from '../types';

// Content identity matches the frontend's message-level dedup contract.
export function getMessageContentKey(msg: Message): string {
  // When sender_timestamp exists, dedup by content (catches radio-path duplicates with different IDs).
  // When null, include msg.id so each message gets a unique key — avoids silently dropping
  // different messages that share the same text and received_at second.
  const ts = msg.sender_timestamp ?? `r${msg.received_at}-${msg.id}`;
  return `${msg.type}-${msg.conversation_key}-${msg.text}-${ts}`;
}
