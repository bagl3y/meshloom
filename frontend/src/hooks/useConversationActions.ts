import {
  useCallback,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from 'react';
import { api } from '../api';
import * as messageCache from '../messageCache';
import { toast } from '../components/ui/sonner';
import type { MessageInputHandle } from '../components/MessageInput';
import type { SearchNavigateTarget } from '../components/SearchView';
import type { Channel, Conversation, Message } from '../types';

interface UseConversationActionsArgs {
  activeConversation: Conversation | null;
  activeConversationRef: MutableRefObject<Conversation | null>;
  setTargetMessageId: Dispatch<SetStateAction<number | null>>;
  channels: Channel[];
  setChannels: React.Dispatch<React.SetStateAction<Channel[]>>;
  addMessageIfNew: (msg: Message) => boolean;
  jumpToBottom: () => void;
  handleToggleBlockedKey: (key: string) => Promise<void>;
  handleToggleBlockedName: (name: string) => Promise<void>;
  handleSelectConversation: (conv: Conversation) => void;
  messageInputRef: RefObject<MessageInputHandle | null>;
}

interface UseConversationActionsResult {
  infoPaneContactKey: string | null;
  infoPaneFromChannel: boolean;
  infoPaneChannelKey: string | null;
  handleSendMessage: (text: string) => Promise<void>;
  handleResendChannelMessage: (messageId: number, newTimestamp?: boolean) => Promise<void>;
  handleSetChannelFloodScopeOverride: (
    channelKey: string,
    floodScopeOverride: string
  ) => Promise<void>;
  handleSenderClick: (sender: string) => void;
  handleTrace: () => Promise<void>;
  handleBlockKey: (key: string) => Promise<void>;
  handleBlockName: (name: string) => Promise<void>;
  handleOpenContactInfo: (publicKey: string, fromChannel?: boolean) => void;
  handleCloseContactInfo: () => void;
  handleOpenChannelInfo: (channelKey: string) => void;
  handleCloseChannelInfo: () => void;
  handleSelectConversationWithTargetReset: (
    conv: Conversation,
    options?: { preserveTarget?: boolean }
  ) => void;
  handleNavigateToChannel: (channelKey: string) => void;
  handleNavigateToMessage: (target: SearchNavigateTarget) => void;
}

export function useConversationActions({
  activeConversation,
  activeConversationRef,
  setTargetMessageId,
  channels,
  setChannels,
  addMessageIfNew,
  jumpToBottom,
  handleToggleBlockedKey,
  handleToggleBlockedName,
  handleSelectConversation,
  messageInputRef,
}: UseConversationActionsArgs): UseConversationActionsResult {
  const [infoPaneContactKey, setInfoPaneContactKey] = useState<string | null>(null);
  const [infoPaneFromChannel, setInfoPaneFromChannel] = useState(false);
  const [infoPaneChannelKey, setInfoPaneChannelKey] = useState<string | null>(null);

  const mergeChannelIntoList = useCallback(
    (updated: Channel) => {
      setChannels((prev) => {
        const existingIndex = prev.findIndex((channel) => channel.key === updated.key);
        if (existingIndex === -1) {
          return [...prev, updated].sort((a, b) => a.name.localeCompare(b.name));
        }
        const next = [...prev];
        next[existingIndex] = updated;
        return next;
      });
    },
    [setChannels]
  );

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!activeConversation) return;

      const conversationId = activeConversation.id;
      const sent =
        activeConversation.type === 'channel'
          ? await api.sendChannelMessage(activeConversation.id, text)
          : await api.sendDirectMessage(activeConversation.id, text);

      if (activeConversationRef.current?.id === conversationId) {
        addMessageIfNew(sent);
      }
    },
    [activeConversation, activeConversationRef, addMessageIfNew]
  );

  const handleResendChannelMessage = useCallback(
    async (messageId: number, newTimestamp?: boolean) => {
      try {
        await api.resendChannelMessage(messageId, newTimestamp);
        toast.success(newTimestamp ? 'Message resent with new timestamp' : 'Message resent');
      } catch (err) {
        toast.error('Failed to resend', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    []
  );

  const handleSetChannelFloodScopeOverride = useCallback(
    async (channelKey: string, floodScopeOverride: string) => {
      try {
        const updated = await api.setChannelFloodScopeOverride(channelKey, floodScopeOverride);
        mergeChannelIntoList(updated);
        toast.success(
          updated.flood_scope_override ? 'Regional override saved' : 'Regional override cleared'
        );
      } catch (err) {
        toast.error('Failed to update regional override', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [mergeChannelIntoList]
  );

  const handleSenderClick = useCallback(
    (sender: string) => {
      messageInputRef.current?.appendText(`@[${sender}] `);
    },
    [messageInputRef]
  );

  const handleTrace = useCallback(async () => {
    if (!activeConversation || activeConversation.type !== 'contact') return;
    toast('Trace started...');
    try {
      const result = await api.requestTrace(activeConversation.id);
      const parts: string[] = [];
      if (result.remote_snr !== null) parts.push(`Remote SNR: ${result.remote_snr.toFixed(1)} dB`);
      if (result.local_snr !== null) parts.push(`Local SNR: ${result.local_snr.toFixed(1)} dB`);
      const detail = parts.join(', ');
      toast.success(detail ? `Trace complete! ${detail}` : 'Trace complete!');
    } catch (err) {
      toast.error('Trace failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [activeConversation]);

  const handleBlockKey = useCallback(
    async (key: string) => {
      await handleToggleBlockedKey(key);
      messageCache.clear();
      jumpToBottom();
    },
    [handleToggleBlockedKey, jumpToBottom]
  );

  const handleBlockName = useCallback(
    async (name: string) => {
      await handleToggleBlockedName(name);
      messageCache.clear();
      jumpToBottom();
    },
    [handleToggleBlockedName, jumpToBottom]
  );

  const handleOpenContactInfo = useCallback((publicKey: string, fromChannel?: boolean) => {
    setInfoPaneContactKey(publicKey);
    setInfoPaneFromChannel(fromChannel ?? false);
  }, []);

  const handleCloseContactInfo = useCallback(() => {
    setInfoPaneContactKey(null);
  }, []);

  const handleOpenChannelInfo = useCallback((channelKey: string) => {
    setInfoPaneChannelKey(channelKey);
  }, []);

  const handleCloseChannelInfo = useCallback(() => {
    setInfoPaneChannelKey(null);
  }, []);

  const handleSelectConversationWithTargetReset = useCallback(
    (conv: Conversation, options?: { preserveTarget?: boolean }) => {
      if (conv.type !== 'search' && !options?.preserveTarget) {
        setTargetMessageId(null);
      }
      handleSelectConversation(conv);
    },
    [handleSelectConversation, setTargetMessageId]
  );

  const handleNavigateToChannel = useCallback(
    (channelKey: string) => {
      const channel = channels.find((c) => c.key === channelKey);
      if (channel) {
        handleSelectConversationWithTargetReset({
          type: 'channel',
          id: channel.key,
          name: channel.name,
        });
        setInfoPaneContactKey(null);
      }
    },
    [channels, handleSelectConversationWithTargetReset]
  );

  const handleNavigateToMessage = useCallback(
    (target: SearchNavigateTarget) => {
      const convType = target.type === 'CHAN' ? 'channel' : 'contact';
      setTargetMessageId(target.id);
      handleSelectConversationWithTargetReset(
        {
          type: convType,
          id: target.conversation_key,
          name: target.conversation_name,
        },
        { preserveTarget: true }
      );
    },
    [handleSelectConversationWithTargetReset, setTargetMessageId]
  );

  return {
    infoPaneContactKey,
    infoPaneFromChannel,
    infoPaneChannelKey,
    handleSendMessage,
    handleResendChannelMessage,
    handleSetChannelFloodScopeOverride,
    handleSenderClick,
    handleTrace,
    handleBlockKey,
    handleBlockName,
    handleOpenContactInfo,
    handleCloseContactInfo,
    handleOpenChannelInfo,
    handleCloseChannelInfo,
    handleSelectConversationWithTargetReset,
    handleNavigateToChannel,
    handleNavigateToMessage,
  };
}
