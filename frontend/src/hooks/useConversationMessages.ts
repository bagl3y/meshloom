import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { useConversationTimeline } from './useConversationTimeline';
import type { Conversation, Message, MessagePath } from '../types';

const MAX_PENDING_ACKS = 500;

interface PendingAckUpdate {
  ackCount: number;
  paths?: MessagePath[];
}

export function mergePendingAck(
  existing: PendingAckUpdate | undefined,
  ackCount: number,
  paths?: MessagePath[]
): PendingAckUpdate {
  if (!existing) {
    return {
      ackCount,
      ...(paths !== undefined && { paths }),
    };
  }

  if (ackCount > existing.ackCount) {
    return {
      ackCount,
      ...(paths !== undefined && { paths }),
      ...(paths === undefined && existing.paths !== undefined && { paths: existing.paths }),
    };
  }

  if (ackCount < existing.ackCount) {
    return existing;
  }

  if (paths === undefined) {
    return existing;
  }

  const existingPathCount = existing.paths?.length ?? -1;
  if (paths.length >= existingPathCount) {
    return { ackCount, paths };
  }

  return existing;
}

// Generate a key for deduplicating messages by content
export function getMessageContentKey(msg: Message): string {
  // When sender_timestamp exists, dedup by content (catches radio-path duplicates with different IDs).
  // When null, include msg.id so each message gets a unique key — avoids silently dropping
  // different messages that share the same text and received_at second.
  const ts = msg.sender_timestamp ?? `r${msg.received_at}-${msg.id}`;
  return `${msg.type}-${msg.conversation_key}-${msg.text}-${ts}`;
}

interface UseConversationMessagesResult {
  messages: Message[];
  messagesLoading: boolean;
  loadingOlder: boolean;
  hasOlderMessages: boolean;
  hasNewerMessages: boolean;
  loadingNewer: boolean;
  hasNewerMessagesRef: MutableRefObject<boolean>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  fetchOlderMessages: () => Promise<void>;
  fetchNewerMessages: () => Promise<void>;
  jumpToBottom: () => void;
  addMessageIfNew: (msg: Message) => boolean;
  updateMessageAck: (messageId: number, ackCount: number, paths?: MessagePath[]) => void;
  triggerReconcile: () => void;
}

export function useConversationMessages(
  activeConversation: Conversation | null,
  targetMessageId?: number | null
): UseConversationMessagesResult {
  // Track seen message content for deduplication
  const seenMessageContent = useRef<Set<string>>(new Set());

  // ACK events can arrive before the corresponding message event/response.
  // Buffer latest ACK state by message_id and apply when the message arrives.
  const pendingAcksRef = useRef<Map<number, PendingAckUpdate>>(new Map());

  const setPendingAck = useCallback(
    (messageId: number, ackCount: number, paths?: MessagePath[]) => {
      const existing = pendingAcksRef.current.get(messageId);
      const merged = mergePendingAck(existing, ackCount, paths);

      // Update insertion order so most recent updates remain in the buffer longest.
      pendingAcksRef.current.delete(messageId);
      pendingAcksRef.current.set(messageId, merged);

      if (pendingAcksRef.current.size > MAX_PENDING_ACKS) {
        const oldestMessageId = pendingAcksRef.current.keys().next().value as number | undefined;
        if (oldestMessageId !== undefined) {
          pendingAcksRef.current.delete(oldestMessageId);
        }
      }
    },
    []
  );

  const applyPendingAck = useCallback((msg: Message): Message => {
    const pending = pendingAcksRef.current.get(msg.id);
    if (!pending) return msg;

    pendingAcksRef.current.delete(msg.id);

    return {
      ...msg,
      acked: Math.max(msg.acked, pending.ackCount),
      ...(pending.paths !== undefined && { paths: pending.paths }),
    };
  }, []);

  const {
    messages,
    messagesRef,
    messagesLoading,
    loadingOlder,
    hasOlderMessages,
    hasNewerMessages,
    loadingNewer,
    hasNewerMessagesRef,
    setMessages,
    fetchOlderMessages,
    fetchNewerMessages,
    jumpToBottom,
    triggerReconcile,
  } = useConversationTimeline({
    activeConversation,
    targetMessageId,
    applyPendingAck,
    getMessageContentKey,
    seenMessageContentRef: seenMessageContent,
  });

  // Add a message if it's new (deduplication)
  // Returns true if the message was added, false if it was a duplicate
  const addMessageIfNew = useCallback(
    (msg: Message): boolean => {
      const msgWithPendingAck = applyPendingAck(msg);
      const contentKey = getMessageContentKey(msgWithPendingAck);
      if (seenMessageContent.current.has(contentKey)) {
        console.debug('Duplicate message content ignored:', contentKey.slice(0, 50));
        return false;
      }
      seenMessageContent.current.add(contentKey);

      // Limit set size to prevent memory issues — rebuild from current messages
      // so visible messages always remain in the dedup set (insertion-order slicing
      // could evict keys for still-displayed messages, allowing echo duplicates).
      if (seenMessageContent.current.size > 1000) {
        seenMessageContent.current = new Set(
          messagesRef.current.map((m) => getMessageContentKey(m))
        );
        // Re-add the just-inserted key in case it's a new message not yet in state
        seenMessageContent.current.add(contentKey);
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === msgWithPendingAck.id)) {
          return prev;
        }
        return [...prev, msgWithPendingAck];
      });

      return true;
    },
    [applyPendingAck, messagesRef, setMessages]
  );

  // Update a message's ack count and paths
  const updateMessageAck = useCallback(
    (messageId: number, ackCount: number, paths?: MessagePath[]) => {
      const hasMessageLoaded = messagesRef.current.some((m) => m.id === messageId);
      if (!hasMessageLoaded) {
        setPendingAck(messageId, ackCount, paths);
        return;
      }

      // Message is loaded now, so any prior pending ACK for it is stale.
      pendingAcksRef.current.delete(messageId);

      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === messageId);
        if (idx >= 0) {
          const current = prev[idx];
          const nextAck = Math.max(current.acked, ackCount);
          const nextPaths =
            paths !== undefined && paths.length >= (current.paths?.length ?? 0)
              ? paths
              : current.paths;

          const updated = [...prev];
          updated[idx] = {
            ...current,
            acked: nextAck,
            ...(paths !== undefined && { paths: nextPaths }),
          };
          return updated;
        }
        setPendingAck(messageId, ackCount, paths);
        return prev;
      });
    },
    [messagesRef, setMessages, setPendingAck]
  );

  return {
    messages,
    messagesLoading,
    loadingOlder,
    hasOlderMessages,
    hasNewerMessages,
    loadingNewer,
    hasNewerMessagesRef,
    setMessages,
    fetchOlderMessages,
    fetchNewerMessages,
    jumpToBottom,
    addMessageIfNew,
    updateMessageAck,
    triggerReconcile,
  };
}
