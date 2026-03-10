import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import type { SearchNavigateTarget } from '../components/SearchView';
import type { Channel, Conversation } from '../types';

interface UseConversationNavigationArgs {
  channels: Channel[];
  handleSelectConversation: (conv: Conversation) => void;
}

interface UseConversationNavigationResult {
  targetMessageId: number | null;
  setTargetMessageId: Dispatch<SetStateAction<number | null>>;
  infoPaneContactKey: string | null;
  infoPaneFromChannel: boolean;
  infoPaneChannelKey: string | null;
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

export function useConversationNavigation({
  channels,
  handleSelectConversation,
}: UseConversationNavigationArgs): UseConversationNavigationResult {
  const [targetMessageId, setTargetMessageId] = useState<number | null>(null);
  const [infoPaneContactKey, setInfoPaneContactKey] = useState<string | null>(null);
  const [infoPaneFromChannel, setInfoPaneFromChannel] = useState(false);
  const [infoPaneChannelKey, setInfoPaneChannelKey] = useState<string | null>(null);

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
    [handleSelectConversation]
  );

  const handleNavigateToChannel = useCallback(
    (channelKey: string) => {
      const channel = channels.find((item) => item.key === channelKey);
      if (!channel) {
        return;
      }

      handleSelectConversationWithTargetReset({
        type: 'channel',
        id: channel.key,
        name: channel.name,
      });
      setInfoPaneContactKey(null);
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
    [handleSelectConversationWithTargetReset]
  );

  return {
    targetMessageId,
    setTargetMessageId,
    infoPaneContactKey,
    infoPaneFromChannel,
    infoPaneChannelKey,
    handleOpenContactInfo,
    handleCloseContactInfo,
    handleOpenChannelInfo,
    handleCloseChannelInfo,
    handleSelectConversationWithTargetReset,
    handleNavigateToChannel,
    handleNavigateToMessage,
  };
}
