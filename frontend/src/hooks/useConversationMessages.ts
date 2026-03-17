import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '../components/ui/sonner';
import { api, isAbortError } from '../api';
import * as messageCache from '../messageCache';
import type { Conversation, Message, MessagePath } from '../types';
import { getMessageContentKey } from '../utils/messageIdentity';

const MAX_PENDING_ACKS = 500;
const MESSAGE_PAGE_SIZE = 200;

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

interface UseConversationMessagesResult {
  messages: Message[];
  messagesLoading: boolean;
  loadingOlder: boolean;
  hasOlderMessages: boolean;
  hasNewerMessages: boolean;
  loadingNewer: boolean;
  fetchOlderMessages: () => Promise<void>;
  fetchNewerMessages: () => Promise<void>;
  jumpToBottom: () => void;
  reloadCurrentConversation: () => void;
  observeMessage: (msg: Message) => { added: boolean; activeConversation: boolean };
  receiveMessageAck: (messageId: number, ackCount: number, paths?: MessagePath[]) => void;
  reconcileOnReconnect: () => void;
  renameConversationMessages: (oldId: string, newId: string) => void;
  removeConversationMessages: (conversationId: string) => void;
  clearConversationMessages: () => void;
}

function isMessageConversation(conversation: Conversation | null): conversation is Conversation {
  return !!conversation && !['raw', 'map', 'visualizer', 'search'].includes(conversation.type);
}

function isActiveConversationMessage(
  activeConversation: Conversation | null,
  msg: Message
): boolean {
  if (!activeConversation) return false;
  if (msg.type === 'CHAN' && activeConversation.type === 'channel') {
    return msg.conversation_key === activeConversation.id;
  }
  if (msg.type === 'PRIV' && activeConversation.type === 'contact') {
    return msg.conversation_key === activeConversation.id;
  }
  return false;
}

function appendUniqueMessages(current: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return current;

  const seenIds = new Set(current.map((msg) => msg.id));
  const seenContent = new Set(current.map((msg) => getMessageContentKey(msg)));
  const additions: Message[] = [];

  for (const msg of incoming) {
    const contentKey = getMessageContentKey(msg);
    if (seenIds.has(msg.id) || seenContent.has(contentKey)) {
      continue;
    }
    seenIds.add(msg.id);
    seenContent.add(contentKey);
    additions.push(msg);
  }

  if (additions.length === 0) {
    return current;
  }

  return [...current, ...additions];
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [hasNewerMessages, setHasNewerMessages] = useState(false);
  const [loadingNewer, setLoadingNewer] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const olderAbortControllerRef = useRef<AbortController | null>(null);
  const newerAbortControllerRef = useRef<AbortController | null>(null);
  const fetchingConversationIdRef = useRef<string | null>(null);
  const latestReconcileRequestIdRef = useRef(0);
  const pendingReconnectReconcileRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const loadingOlderRef = useRef(false);
  const hasOlderMessagesRef = useRef(false);
  const hasNewerMessagesRef = useRef(false);
  const prevConversationIdRef = useRef<string | null>(null);
  const prevReloadVersionRef = useRef(0);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    loadingOlderRef.current = loadingOlder;
  }, [loadingOlder]);

  useEffect(() => {
    hasOlderMessagesRef.current = hasOlderMessages;
  }, [hasOlderMessages]);

  useEffect(() => {
    hasNewerMessagesRef.current = hasNewerMessages;
  }, [hasNewerMessages]);

  const syncSeenContent = useCallback(
    (nextMessages: Message[]) => {
      seenMessageContent.current.clear();
      for (const msg of nextMessages) {
        seenMessageContent.current.add(getMessageContentKey(msg));
      }
    },
    [seenMessageContent]
  );

  const fetchLatestMessages = useCallback(
    async (showLoading = false, signal?: AbortSignal) => {
      if (!isMessageConversation(activeConversation)) {
        setMessages([]);
        setHasOlderMessages(false);
        return;
      }

      const conversationId = activeConversation.id;
      pendingReconnectReconcileRef.current = false;

      if (showLoading) {
        setMessagesLoading(true);
        setMessages([]);
      }

      try {
        const data = await api.getMessages(
          {
            type: activeConversation.type === 'channel' ? 'CHAN' : 'PRIV',
            conversation_key: activeConversation.id,
            limit: MESSAGE_PAGE_SIZE,
          },
          signal
        );

        if (fetchingConversationIdRef.current !== conversationId) {
          return;
        }

        const messagesWithPendingAck = data.map((msg) => applyPendingAck(msg));
        const merged = messageCache.reconcile(messagesRef.current, messagesWithPendingAck);
        const nextMessages = merged ?? messagesRef.current;
        if (merged) {
          setMessages(merged);
        }
        syncSeenContent(nextMessages);
        setHasOlderMessages(messagesWithPendingAck.length >= MESSAGE_PAGE_SIZE);
      } catch (err) {
        if (isAbortError(err)) {
          return;
        }
        console.error('Failed to fetch messages:', err);
        toast.error('Failed to load messages', {
          description: err instanceof Error ? err.message : 'Check your connection',
        });
      } finally {
        if (showLoading) {
          setMessagesLoading(false);
        }
      }
    },
    [activeConversation, applyPendingAck, syncSeenContent]
  );

  const reconcileFromBackend = useCallback(
    (conversation: Conversation, signal: AbortSignal, requestId: number) => {
      const conversationId = conversation.id;
      api
        .getMessages(
          {
            type: conversation.type === 'channel' ? 'CHAN' : 'PRIV',
            conversation_key: conversationId,
            limit: MESSAGE_PAGE_SIZE,
          },
          signal
        )
        .then((data) => {
          if (fetchingConversationIdRef.current !== conversationId) return;
          if (latestReconcileRequestIdRef.current !== requestId) return;

          const dataWithPendingAck = data.map((msg) => applyPendingAck(msg));
          setHasOlderMessages(dataWithPendingAck.length >= MESSAGE_PAGE_SIZE);
          const merged = messageCache.reconcile(messagesRef.current, dataWithPendingAck);
          if (!merged) return;

          setMessages(merged);
          syncSeenContent(merged);
        })
        .catch((err) => {
          if (isAbortError(err)) return;
          console.debug('Background reconciliation failed:', err);
        });
    },
    [applyPendingAck, syncSeenContent]
  );

  const fetchOlderMessages = useCallback(async () => {
    if (
      !isMessageConversation(activeConversation) ||
      loadingOlderRef.current ||
      !hasOlderMessagesRef.current
    ) {
      return;
    }

    const conversationId = activeConversation.id;
    const oldestMessage = messages.reduce(
      (oldest, msg) => {
        if (!oldest) return msg;
        if (msg.received_at < oldest.received_at) return msg;
        if (msg.received_at === oldest.received_at && msg.id < oldest.id) return msg;
        return oldest;
      },
      null as Message | null
    );
    if (!oldestMessage) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const controller = new AbortController();
    olderAbortControllerRef.current = controller;
    try {
      const data = await api.getMessages(
        {
          type: activeConversation.type === 'channel' ? 'CHAN' : 'PRIV',
          conversation_key: conversationId,
          limit: MESSAGE_PAGE_SIZE,
          before: oldestMessage.received_at,
          before_id: oldestMessage.id,
        },
        controller.signal
      );

      if (fetchingConversationIdRef.current !== conversationId) return;

      const dataWithPendingAck = data.map((msg) => applyPendingAck(msg));

      if (dataWithPendingAck.length > 0) {
        let nextMessages: Message[] | null = null;
        setMessages((prev) => {
          const merged = appendUniqueMessages(prev, dataWithPendingAck);
          if (merged !== prev) {
            nextMessages = merged;
          }
          return merged;
        });
        if (nextMessages) {
          messagesRef.current = nextMessages;
          syncSeenContent(nextMessages);
        }
      }
      setHasOlderMessages(dataWithPendingAck.length >= MESSAGE_PAGE_SIZE);
    } catch (err) {
      if (isAbortError(err)) {
        return;
      }
      console.error('Failed to fetch older messages:', err);
      toast.error('Failed to load older messages', {
        description: err instanceof Error ? err.message : 'Check your connection',
      });
    } finally {
      if (olderAbortControllerRef.current === controller) {
        olderAbortControllerRef.current = null;
      }
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [activeConversation, applyPendingAck, messages, syncSeenContent]);

  const fetchNewerMessages = useCallback(async () => {
    if (!isMessageConversation(activeConversation) || loadingNewer || !hasNewerMessages) return;

    const conversationId = activeConversation.id;
    const newestMessage = messages.reduce(
      (newest, msg) => {
        if (!newest) return msg;
        if (msg.received_at > newest.received_at) return msg;
        if (msg.received_at === newest.received_at && msg.id > newest.id) return msg;
        return newest;
      },
      null as Message | null
    );
    if (!newestMessage) return;

    setLoadingNewer(true);
    const controller = new AbortController();
    newerAbortControllerRef.current = controller;
    try {
      const data = await api.getMessages(
        {
          type: activeConversation.type === 'channel' ? 'CHAN' : 'PRIV',
          conversation_key: conversationId,
          limit: MESSAGE_PAGE_SIZE,
          after: newestMessage.received_at,
          after_id: newestMessage.id,
        },
        controller.signal
      );

      if (fetchingConversationIdRef.current !== conversationId) return;

      const dataWithPendingAck = data.map((msg) => applyPendingAck(msg));
      const newMessages = dataWithPendingAck.filter(
        (msg) => !seenMessageContent.current.has(getMessageContentKey(msg))
      );

      if (newMessages.length > 0) {
        setMessages((prev) => [...prev, ...newMessages]);
        for (const msg of newMessages) {
          seenMessageContent.current.add(getMessageContentKey(msg));
        }
      }
      const stillHasNewerMessages = dataWithPendingAck.length >= MESSAGE_PAGE_SIZE;
      setHasNewerMessages(stillHasNewerMessages);
      if (!stillHasNewerMessages && pendingReconnectReconcileRef.current) {
        pendingReconnectReconcileRef.current = false;
        const requestId = latestReconcileRequestIdRef.current + 1;
        latestReconcileRequestIdRef.current = requestId;
        const reconcileController = new AbortController();
        reconcileFromBackend(activeConversation, reconcileController.signal, requestId);
      }
    } catch (err) {
      if (isAbortError(err)) {
        return;
      }
      console.error('Failed to fetch newer messages:', err);
      toast.error('Failed to load newer messages', {
        description: err instanceof Error ? err.message : 'Check your connection',
      });
    } finally {
      if (newerAbortControllerRef.current === controller) {
        newerAbortControllerRef.current = null;
      }
      setLoadingNewer(false);
    }
  }, [
    activeConversation,
    applyPendingAck,
    hasNewerMessages,
    loadingNewer,
    messages,
    reconcileFromBackend,
  ]);

  const jumpToBottom = useCallback(() => {
    if (!activeConversation) return;
    setHasNewerMessages(false);
    messageCache.remove(activeConversation.id);
    void fetchLatestMessages(true);
  }, [activeConversation, fetchLatestMessages]);

  const reloadCurrentConversation = useCallback(() => {
    if (!isMessageConversation(activeConversation)) return;
    setHasNewerMessages(false);
    messageCache.remove(activeConversation.id);
    setReloadVersion((current) => current + 1);
  }, [activeConversation]);

  const reconcileOnReconnect = useCallback(() => {
    if (!isMessageConversation(activeConversation)) {
      return;
    }

    if (hasNewerMessagesRef.current) {
      pendingReconnectReconcileRef.current = true;
      return;
    }

    pendingReconnectReconcileRef.current = false;
    const controller = new AbortController();
    const requestId = latestReconcileRequestIdRef.current + 1;
    latestReconcileRequestIdRef.current = requestId;
    reconcileFromBackend(activeConversation, controller.signal, requestId);
  }, [activeConversation, reconcileFromBackend]);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (olderAbortControllerRef.current) {
      olderAbortControllerRef.current.abort();
      olderAbortControllerRef.current = null;
    }
    if (newerAbortControllerRef.current) {
      newerAbortControllerRef.current.abort();
      newerAbortControllerRef.current = null;
    }

    const prevId = prevConversationIdRef.current;
    const newId = activeConversation?.id ?? null;
    const conversationChanged = prevId !== newId;
    const reloadRequested = prevReloadVersionRef.current !== reloadVersion;
    fetchingConversationIdRef.current = newId;
    prevConversationIdRef.current = newId;
    prevReloadVersionRef.current = reloadVersion;
    latestReconcileRequestIdRef.current = 0;
    pendingReconnectReconcileRef.current = false;

    // Preserve around-loaded context on the same conversation when search clears targetMessageId.
    if (!conversationChanged && !targetMessageId && !reloadRequested) {
      return;
    }

    setLoadingOlder(false);
    loadingOlderRef.current = false;
    setLoadingNewer(false);
    if (conversationChanged) {
      setHasNewerMessages(false);
    }

    if (
      conversationChanged &&
      prevId &&
      messagesRef.current.length > 0 &&
      !hasNewerMessagesRef.current
    ) {
      messageCache.set(prevId, {
        messages: messagesRef.current,
        hasOlderMessages: hasOlderMessagesRef.current,
      });
    }

    if (!isMessageConversation(activeConversation)) {
      setMessages([]);
      setHasOlderMessages(false);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (targetMessageId) {
      setMessagesLoading(true);
      setMessages([]);
      const msgType = activeConversation.type === 'channel' ? 'CHAN' : 'PRIV';
      void api
        .getMessagesAround(
          targetMessageId,
          msgType as 'PRIV' | 'CHAN',
          activeConversation.id,
          controller.signal
        )
        .then((response) => {
          if (fetchingConversationIdRef.current !== activeConversation.id) return;
          const withAcks = response.messages.map((msg) => applyPendingAck(msg));
          setMessages(withAcks);
          syncSeenContent(withAcks);
          setHasOlderMessages(response.has_older);
          setHasNewerMessages(response.has_newer);
        })
        .catch((err) => {
          if (isAbortError(err)) return;
          console.error('Failed to fetch messages around target:', err);
          toast.error('Failed to jump to message');
        })
        .finally(() => {
          setMessagesLoading(false);
        });
    } else {
      const cached = messageCache.get(activeConversation.id);
      if (cached) {
        setMessages(cached.messages);
        seenMessageContent.current = new Set(
          cached.messages.map((message) => getMessageContentKey(message))
        );
        setHasOlderMessages(cached.hasOlderMessages);
        setMessagesLoading(false);
        const requestId = latestReconcileRequestIdRef.current + 1;
        latestReconcileRequestIdRef.current = requestId;
        reconcileFromBackend(activeConversation, controller.signal, requestId);
      } else {
        void fetchLatestMessages(true, controller.signal);
      }
    }

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation?.id, activeConversation?.type, targetMessageId, reloadVersion]);

  // Add a message to the active conversation if it is new.
  const appendActiveMessageIfNew = useCallback(
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

  const receiveMessageAck = useCallback(
    (messageId: number, ackCount: number, paths?: MessagePath[]) => {
      updateMessageAck(messageId, ackCount, paths);
      messageCache.updateAck(messageId, ackCount, paths);
    },
    [updateMessageAck]
  );

  const observeMessage = useCallback(
    (msg: Message): { added: boolean; activeConversation: boolean } => {
      const msgWithPendingAck = applyPendingAck(msg);
      const activeConversationMessage = isActiveConversationMessage(
        activeConversation,
        msgWithPendingAck
      );

      if (activeConversationMessage) {
        if (hasNewerMessagesRef.current) {
          return { added: false, activeConversation: true };
        }

        return {
          added: appendActiveMessageIfNew(msgWithPendingAck),
          activeConversation: true,
        };
      }

      return {
        added: messageCache.addMessage(msgWithPendingAck.conversation_key, msgWithPendingAck),
        activeConversation: false,
      };
    },
    [activeConversation, appendActiveMessageIfNew, applyPendingAck, hasNewerMessagesRef]
  );

  const renameConversationMessages = useCallback((oldId: string, newId: string) => {
    messageCache.rename(oldId, newId);
  }, []);

  const removeConversationMessages = useCallback((conversationId: string) => {
    messageCache.remove(conversationId);
  }, []);

  const clearConversationMessages = useCallback(() => {
    messageCache.clear();
  }, []);

  return {
    messages,
    messagesLoading,
    loadingOlder,
    hasOlderMessages,
    hasNewerMessages,
    loadingNewer,
    fetchOlderMessages,
    fetchNewerMessages,
    jumpToBottom,
    reloadCurrentConversation,
    observeMessage,
    receiveMessageAck,
    reconcileOnReconnect,
    renameConversationMessages,
    removeConversationMessages,
    clearConversationMessages,
  };
}
