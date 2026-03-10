import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { toast } from '../components/ui/sonner';
import { api, isAbortError } from '../api';
import * as messageCache from '../messageCache';
import type { Conversation, Message } from '../types';

const MESSAGE_PAGE_SIZE = 200;

interface UseConversationTimelineArgs {
  activeConversation: Conversation | null;
  targetMessageId?: number | null;
  applyPendingAck: (msg: Message) => Message;
  getMessageContentKey: (msg: Message) => string;
  seenMessageContentRef: MutableRefObject<Set<string>>;
}

interface UseConversationTimelineResult {
  messages: Message[];
  messagesRef: MutableRefObject<Message[]>;
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
  triggerReconcile: () => void;
}

function isMessageConversation(conversation: Conversation | null): conversation is Conversation {
  return !!conversation && !['raw', 'map', 'visualizer', 'search'].includes(conversation.type);
}

export function useConversationTimeline({
  activeConversation,
  targetMessageId,
  applyPendingAck,
  getMessageContentKey,
  seenMessageContentRef,
}: UseConversationTimelineArgs): UseConversationTimelineResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [hasNewerMessages, setHasNewerMessages] = useState(false);
  const [loadingNewer, setLoadingNewer] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchingConversationIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const hasOlderMessagesRef = useRef(false);
  const hasNewerMessagesRef = useRef(false);
  const prevConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    hasOlderMessagesRef.current = hasOlderMessages;
  }, [hasOlderMessages]);

  useEffect(() => {
    hasNewerMessagesRef.current = hasNewerMessages;
  }, [hasNewerMessages]);

  const syncSeenContent = useCallback(
    (nextMessages: Message[]) => {
      seenMessageContentRef.current.clear();
      for (const msg of nextMessages) {
        seenMessageContentRef.current.add(getMessageContentKey(msg));
      }
    },
    [getMessageContentKey, seenMessageContentRef]
  );

  const fetchLatestMessages = useCallback(
    async (showLoading = false, signal?: AbortSignal) => {
      if (!isMessageConversation(activeConversation)) {
        setMessages([]);
        setHasOlderMessages(false);
        return;
      }

      const conversationId = activeConversation.id;

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
        setMessages(messagesWithPendingAck);
        syncSeenContent(messagesWithPendingAck);
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
    (conversation: Conversation, signal: AbortSignal) => {
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

          const dataWithPendingAck = data.map((msg) => applyPendingAck(msg));
          const merged = messageCache.reconcile(messagesRef.current, dataWithPendingAck);
          if (!merged) return;

          setMessages(merged);
          syncSeenContent(merged);
          if (dataWithPendingAck.length >= MESSAGE_PAGE_SIZE) {
            setHasOlderMessages(true);
          }
        })
        .catch((err) => {
          if (isAbortError(err)) return;
          console.debug('Background reconciliation failed:', err);
        });
    },
    [applyPendingAck, syncSeenContent]
  );

  const fetchOlderMessages = useCallback(async () => {
    if (!isMessageConversation(activeConversation) || loadingOlder || !hasOlderMessages) return;

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

    setLoadingOlder(true);
    try {
      const data = await api.getMessages({
        type: activeConversation.type === 'channel' ? 'CHAN' : 'PRIV',
        conversation_key: conversationId,
        limit: MESSAGE_PAGE_SIZE,
        before: oldestMessage.received_at,
        before_id: oldestMessage.id,
      });

      if (fetchingConversationIdRef.current !== conversationId) return;

      const dataWithPendingAck = data.map((msg) => applyPendingAck(msg));

      if (dataWithPendingAck.length > 0) {
        setMessages((prev) => [...prev, ...dataWithPendingAck]);
        for (const msg of dataWithPendingAck) {
          seenMessageContentRef.current.add(getMessageContentKey(msg));
        }
      }
      setHasOlderMessages(dataWithPendingAck.length >= MESSAGE_PAGE_SIZE);
    } catch (err) {
      console.error('Failed to fetch older messages:', err);
      toast.error('Failed to load older messages', {
        description: err instanceof Error ? err.message : 'Check your connection',
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [
    activeConversation,
    applyPendingAck,
    getMessageContentKey,
    hasOlderMessages,
    loadingOlder,
    messages,
    seenMessageContentRef,
  ]);

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
    try {
      const data = await api.getMessages({
        type: activeConversation.type === 'channel' ? 'CHAN' : 'PRIV',
        conversation_key: conversationId,
        limit: MESSAGE_PAGE_SIZE,
        after: newestMessage.received_at,
        after_id: newestMessage.id,
      });

      if (fetchingConversationIdRef.current !== conversationId) return;

      const dataWithPendingAck = data.map((msg) => applyPendingAck(msg));
      const newMessages = dataWithPendingAck.filter(
        (msg) => !seenMessageContentRef.current.has(getMessageContentKey(msg))
      );

      if (newMessages.length > 0) {
        setMessages((prev) => [...prev, ...newMessages]);
        for (const msg of newMessages) {
          seenMessageContentRef.current.add(getMessageContentKey(msg));
        }
      }
      setHasNewerMessages(dataWithPendingAck.length >= MESSAGE_PAGE_SIZE);
    } catch (err) {
      console.error('Failed to fetch newer messages:', err);
      toast.error('Failed to load newer messages', {
        description: err instanceof Error ? err.message : 'Check your connection',
      });
    } finally {
      setLoadingNewer(false);
    }
  }, [
    activeConversation,
    applyPendingAck,
    getMessageContentKey,
    hasNewerMessages,
    loadingNewer,
    messages,
    seenMessageContentRef,
  ]);

  const jumpToBottom = useCallback(() => {
    if (!activeConversation) return;
    setHasNewerMessages(false);
    messageCache.remove(activeConversation.id);
    fetchLatestMessages(true);
  }, [activeConversation, fetchLatestMessages]);

  const triggerReconcile = useCallback(() => {
    if (!isMessageConversation(activeConversation)) return;
    const controller = new AbortController();
    reconcileFromBackend(activeConversation, controller.signal);
  }, [activeConversation, reconcileFromBackend]);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const prevId = prevConversationIdRef.current;
    const newId = activeConversation?.id ?? null;
    const conversationChanged = prevId !== newId;
    fetchingConversationIdRef.current = newId;
    prevConversationIdRef.current = newId;

    if (!conversationChanged && !targetMessageId) {
      return;
    }

    setLoadingOlder(false);
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
        seenContent: new Set(seenMessageContentRef.current),
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
      api
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
        seenMessageContentRef.current = new Set(cached.seenContent);
        setHasOlderMessages(cached.hasOlderMessages);
        setMessagesLoading(false);
        reconcileFromBackend(activeConversation, controller.signal);
      } else {
        fetchLatestMessages(true, controller.signal);
      }
    }

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation?.id, activeConversation?.type, targetMessageId]);

  return {
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
  };
}
