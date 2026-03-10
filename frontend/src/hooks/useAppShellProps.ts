import { useCallback, type ComponentProps, type Dispatch, type SetStateAction } from 'react';

import { api } from '../api';
import { ChannelInfoPane } from '../components/ChannelInfoPane';
import { ContactInfoPane } from '../components/ContactInfoPane';
import { ConversationPane } from '../components/ConversationPane';
import { NewMessageModal } from '../components/NewMessageModal';
import { SearchView } from '../components/SearchView';
import { SettingsModal } from '../components/SettingsModal';
import { Sidebar } from '../components/Sidebar';
import { StatusBar } from '../components/StatusBar';
import { CrackerPanel } from '../components/CrackerPanel';
import type {
  AppSettings,
  Channel,
  Contact,
  Conversation,
  Favorite,
  HealthStatus,
  Message,
  RadioConfig,
  RawPacket,
} from '../types';

type StatusProps = Pick<ComponentProps<typeof StatusBar>, 'health' | 'config'>;
type SidebarProps = ComponentProps<typeof Sidebar>;
type ConversationPaneProps = ComponentProps<typeof ConversationPane>;
type SearchProps = ComponentProps<typeof SearchView>;
type SettingsProps = Omit<
  ComponentProps<typeof SettingsModal>,
  'open' | 'pageMode' | 'externalSidebarNav' | 'desktopSection' | 'onClose' | 'onLocalLabelChange'
>;
type CrackerProps = Omit<ComponentProps<typeof CrackerPanel>, 'visible' | 'onRunningChange'>;
type NewMessageModalProps = Omit<ComponentProps<typeof NewMessageModal>, 'open' | 'onClose'>;
type ContactInfoPaneProps = ComponentProps<typeof ContactInfoPane>;
type ChannelInfoPaneProps = ComponentProps<typeof ChannelInfoPane>;

interface UseAppShellPropsArgs {
  contacts: Contact[];
  channels: Channel[];
  rawPackets: RawPacket[];
  undecryptedCount: number;
  activeConversation: Conversation | null;
  config: RadioConfig | null;
  health: HealthStatus | null;
  favorites: Favorite[];
  appSettings: AppSettings | null;
  unreadCounts: Record<string, number>;
  mentions: Record<string, boolean>;
  lastMessageTimes: Record<string, number>;
  showCracker: boolean;
  crackerRunning: boolean;
  messageInputRef: ConversationPaneProps['messageInputRef'];
  targetMessageId: number | null;
  infoPaneContactKey: string | null;
  infoPaneFromChannel: boolean;
  infoPaneChannelKey: string | null;
  messages: Message[];
  messagesLoading: boolean;
  loadingOlder: boolean;
  hasOlderMessages: boolean;
  hasNewerMessages: boolean;
  loadingNewer: boolean;
  handleOpenNewMessage: () => void;
  handleToggleCracker: () => void;
  markAllRead: () => void;
  handleSortOrderChange: (sortOrder: 'recent' | 'alpha') => Promise<void>;
  handleSelectConversationWithTargetReset: (
    conv: Conversation,
    options?: { preserveTarget?: boolean }
  ) => void;
  handleNavigateToMessage: SearchProps['onNavigateToMessage'];
  handleSaveConfig: SettingsProps['onSave'];
  handleSaveAppSettings: SettingsProps['onSaveAppSettings'];
  handleSetPrivateKey: SettingsProps['onSetPrivateKey'];
  handleReboot: SettingsProps['onReboot'];
  handleAdvertise: SettingsProps['onAdvertise'];
  handleHealthRefresh: SettingsProps['onHealthRefresh'];
  fetchAppSettings: () => Promise<void>;
  setChannels: Dispatch<SetStateAction<Channel[]>>;
  fetchUndecryptedCount: () => Promise<void>;
  handleCreateContact: NewMessageModalProps['onCreateContact'];
  handleCreateChannel: NewMessageModalProps['onCreateChannel'];
  handleCreateHashtagChannel: NewMessageModalProps['onCreateHashtagChannel'];
  handleDeleteContact: ConversationPaneProps['onDeleteContact'];
  handleDeleteChannel: ConversationPaneProps['onDeleteChannel'];
  handleToggleFavorite: (type: 'channel' | 'contact', id: string) => Promise<void>;
  handleSetChannelFloodScopeOverride: ConversationPaneProps['onSetChannelFloodScopeOverride'];
  handleOpenContactInfo: ConversationPaneProps['onOpenContactInfo'];
  handleOpenChannelInfo: ConversationPaneProps['onOpenChannelInfo'];
  handleCloseContactInfo: () => void;
  handleCloseChannelInfo: () => void;
  handleSenderClick: NonNullable<ConversationPaneProps['onSenderClick']>;
  handleResendChannelMessage: NonNullable<ConversationPaneProps['onResendChannelMessage']>;
  handleTrace: ConversationPaneProps['onTrace'];
  handleSendMessage: ConversationPaneProps['onSendMessage'];
  fetchOlderMessages: ConversationPaneProps['onLoadOlder'];
  fetchNewerMessages: ConversationPaneProps['onLoadNewer'];
  jumpToBottom: ConversationPaneProps['onJumpToBottom'];
  setTargetMessageId: Dispatch<SetStateAction<number | null>>;
  handleNavigateToChannel: ContactInfoPaneProps['onNavigateToChannel'];
  handleBlockKey: NonNullable<ContactInfoPaneProps['onToggleBlockedKey']>;
  handleBlockName: NonNullable<ContactInfoPaneProps['onToggleBlockedName']>;
}

interface UseAppShellPropsResult {
  statusProps: StatusProps;
  sidebarProps: SidebarProps;
  conversationPaneProps: ConversationPaneProps;
  searchProps: SearchProps;
  settingsProps: SettingsProps;
  crackerProps: CrackerProps;
  newMessageModalProps: NewMessageModalProps;
  contactInfoPaneProps: ContactInfoPaneProps;
  channelInfoPaneProps: ChannelInfoPaneProps;
}

export function useAppShellProps({
  contacts,
  channels,
  rawPackets,
  undecryptedCount,
  activeConversation,
  config,
  health,
  favorites,
  appSettings,
  unreadCounts,
  mentions,
  lastMessageTimes,
  showCracker,
  crackerRunning,
  messageInputRef,
  targetMessageId,
  infoPaneContactKey,
  infoPaneFromChannel,
  infoPaneChannelKey,
  messages,
  messagesLoading,
  loadingOlder,
  hasOlderMessages,
  hasNewerMessages,
  loadingNewer,
  handleOpenNewMessage,
  handleToggleCracker,
  markAllRead,
  handleSortOrderChange,
  handleSelectConversationWithTargetReset,
  handleNavigateToMessage,
  handleSaveConfig,
  handleSaveAppSettings,
  handleSetPrivateKey,
  handleReboot,
  handleAdvertise,
  handleHealthRefresh,
  fetchAppSettings,
  setChannels,
  fetchUndecryptedCount,
  handleCreateContact,
  handleCreateChannel,
  handleCreateHashtagChannel,
  handleDeleteContact,
  handleDeleteChannel,
  handleToggleFavorite,
  handleSetChannelFloodScopeOverride,
  handleOpenContactInfo,
  handleOpenChannelInfo,
  handleCloseContactInfo,
  handleCloseChannelInfo,
  handleSenderClick,
  handleResendChannelMessage,
  handleTrace,
  handleSendMessage,
  fetchOlderMessages,
  fetchNewerMessages,
  jumpToBottom,
  setTargetMessageId,
  handleNavigateToChannel,
  handleBlockKey,
  handleBlockName,
}: UseAppShellPropsArgs): UseAppShellPropsResult {
  const handleCreateCrackedChannel = useCallback<CrackerProps['onChannelCreate']>(
    async (name, key) => {
      const created = await api.createChannel(name, key);
      const updatedChannels = await api.getChannels();
      setChannels(updatedChannels);
      await api.decryptHistoricalPackets({
        key_type: 'channel',
        channel_key: created.key,
      });
      await fetchUndecryptedCount();
    },
    [fetchUndecryptedCount, setChannels]
  );

  return {
    statusProps: { health, config },
    sidebarProps: {
      contacts,
      channels,
      activeConversation,
      onSelectConversation: handleSelectConversationWithTargetReset,
      onNewMessage: handleOpenNewMessage,
      lastMessageTimes,
      unreadCounts,
      mentions,
      showCracker,
      crackerRunning,
      onToggleCracker: handleToggleCracker,
      onMarkAllRead: () => {
        void markAllRead();
      },
      favorites,
      sortOrder: appSettings?.sidebar_sort_order ?? 'recent',
      onSortOrderChange: (sortOrder) => {
        void handleSortOrderChange(sortOrder);
      },
    },
    conversationPaneProps: {
      activeConversation,
      contacts,
      channels,
      rawPackets,
      config,
      health,
      favorites,
      messages,
      messagesLoading,
      loadingOlder,
      hasOlderMessages,
      targetMessageId,
      hasNewerMessages,
      loadingNewer,
      messageInputRef,
      onTrace: handleTrace,
      onToggleFavorite: handleToggleFavorite,
      onDeleteContact: handleDeleteContact,
      onDeleteChannel: handleDeleteChannel,
      onSetChannelFloodScopeOverride: handleSetChannelFloodScopeOverride,
      onOpenContactInfo: handleOpenContactInfo,
      onOpenChannelInfo: handleOpenChannelInfo,
      onSenderClick: handleSenderClick,
      onLoadOlder: fetchOlderMessages,
      onResendChannelMessage: handleResendChannelMessage,
      onTargetReached: () => setTargetMessageId(null),
      onLoadNewer: fetchNewerMessages,
      onJumpToBottom: jumpToBottom,
      onSendMessage: handleSendMessage,
    },
    searchProps: {
      contacts,
      channels,
      onNavigateToMessage: handleNavigateToMessage,
    },
    settingsProps: {
      config,
      health,
      appSettings,
      onSave: handleSaveConfig,
      onSaveAppSettings: handleSaveAppSettings,
      onSetPrivateKey: handleSetPrivateKey,
      onReboot: handleReboot,
      onAdvertise: handleAdvertise,
      onHealthRefresh: handleHealthRefresh,
      onRefreshAppSettings: fetchAppSettings,
      blockedKeys: appSettings?.blocked_keys,
      blockedNames: appSettings?.blocked_names,
      onToggleBlockedKey: handleBlockKey,
      onToggleBlockedName: handleBlockName,
    },
    crackerProps: {
      packets: rawPackets,
      channels,
      onChannelCreate: handleCreateCrackedChannel,
    },
    newMessageModalProps: {
      contacts,
      undecryptedCount,
      onSelectConversation: handleSelectConversationWithTargetReset,
      onCreateContact: handleCreateContact,
      onCreateChannel: handleCreateChannel,
      onCreateHashtagChannel: handleCreateHashtagChannel,
    },
    contactInfoPaneProps: {
      contactKey: infoPaneContactKey,
      fromChannel: infoPaneFromChannel,
      onClose: handleCloseContactInfo,
      contacts,
      config,
      favorites,
      onToggleFavorite: handleToggleFavorite,
      onNavigateToChannel: handleNavigateToChannel,
      blockedKeys: appSettings?.blocked_keys,
      blockedNames: appSettings?.blocked_names,
      onToggleBlockedKey: handleBlockKey,
      onToggleBlockedName: handleBlockName,
    },
    channelInfoPaneProps: {
      channelKey: infoPaneChannelKey,
      onClose: handleCloseChannelInfo,
      channels,
      favorites,
      onToggleFavorite: handleToggleFavorite,
    },
  };
}
