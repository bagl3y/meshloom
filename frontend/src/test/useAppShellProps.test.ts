import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useAppShellProps } from '../hooks/useAppShellProps';
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

const mocks = vi.hoisted(() => ({
  api: {
    createChannel: vi.fn(),
    getChannels: vi.fn(),
    decryptHistoricalPackets: vi.fn(),
  },
}));

vi.mock('../api', () => ({
  api: mocks.api,
}));

const publicChannel: Channel = {
  key: '8B3387E9C5CDEA6AC9E5EDBAA115CD72',
  name: 'Public',
  is_hashtag: false,
  on_radio: false,
  last_read_at: null,
};

const config: RadioConfig = {
  public_key: 'aa'.repeat(32),
  name: 'TestNode',
  lat: 0,
  lon: 0,
  tx_power: 17,
  max_tx_power: 22,
  radio: { freq: 910.525, bw: 62.5, sf: 7, cr: 5 },
  path_hash_mode: 0,
  path_hash_mode_supported: false,
};

const health: HealthStatus = {
  status: 'connected',
  radio_connected: true,
  radio_initializing: false,
  connection_info: null,
  database_size_mb: 1,
  oldest_undecrypted_timestamp: null,
  fanout_statuses: {},
  bots_disabled: false,
};

const appSettings: AppSettings = {
  max_radio_contacts: 200,
  favorites: [],
  auto_decrypt_dm_on_advert: false,
  sidebar_sort_order: 'recent',
  last_message_times: {},
  preferences_migrated: true,
  advert_interval: 0,
  last_advert_time: 0,
  flood_scope: '',
  blocked_keys: [],
  blocked_names: [],
};

function createArgs(overrides: Partial<Parameters<typeof useAppShellProps>[0]> = {}) {
  const activeConversation: Conversation = {
    type: 'channel',
    id: publicChannel.key,
    name: publicChannel.name,
  };
  const contacts: Contact[] = [];
  const channels: Channel[] = [publicChannel];
  const rawPackets: RawPacket[] = [];
  const favorites: Favorite[] = [];
  const messages: Message[] = [];

  return {
    contacts,
    channels,
    rawPackets,
    undecryptedCount: 0,
    activeConversation,
    config,
    health,
    favorites,
    appSettings,
    unreadCounts: {},
    mentions: {},
    lastMessageTimes: {},
    showCracker: false,
    crackerRunning: false,
    messageInputRef: { current: null },
    targetMessageId: null,
    infoPaneContactKey: null,
    infoPaneFromChannel: false,
    infoPaneChannelKey: null,
    messages,
    messagesLoading: false,
    loadingOlder: false,
    hasOlderMessages: false,
    hasNewerMessages: false,
    loadingNewer: false,
    handleOpenNewMessage: vi.fn(),
    handleToggleCracker: vi.fn(),
    markAllRead: vi.fn(async () => {}),
    handleSortOrderChange: vi.fn(async () => {}),
    handleSelectConversationWithTargetReset: vi.fn(),
    handleNavigateToMessage: vi.fn(),
    handleSaveConfig: vi.fn(async () => {}),
    handleSaveAppSettings: vi.fn(async () => {}),
    handleSetPrivateKey: vi.fn(async () => {}),
    handleReboot: vi.fn(async () => {}),
    handleAdvertise: vi.fn(async () => {}),
    handleHealthRefresh: vi.fn(async () => {}),
    fetchAppSettings: vi.fn(async () => {}),
    setChannels: vi.fn(),
    fetchUndecryptedCount: vi.fn(async () => {}),
    handleCreateContact: vi.fn(async () => {}),
    handleCreateChannel: vi.fn(async () => {}),
    handleCreateHashtagChannel: vi.fn(async () => {}),
    handleDeleteContact: vi.fn(async () => {}),
    handleDeleteChannel: vi.fn(async () => {}),
    handleToggleFavorite: vi.fn(async () => {}),
    handleSetChannelFloodScopeOverride: vi.fn(async () => {}),
    handleOpenContactInfo: vi.fn(),
    handleOpenChannelInfo: vi.fn(),
    handleCloseContactInfo: vi.fn(),
    handleCloseChannelInfo: vi.fn(),
    handleSenderClick: vi.fn(),
    handleResendChannelMessage: vi.fn(async () => {}),
    handleTrace: vi.fn(async () => {}),
    handleSendMessage: vi.fn(async () => {}),
    fetchOlderMessages: vi.fn(async () => {}),
    fetchNewerMessages: vi.fn(async () => {}),
    jumpToBottom: vi.fn(),
    setTargetMessageId: vi.fn(),
    handleNavigateToChannel: vi.fn(),
    handleBlockKey: vi.fn(async () => {}),
    handleBlockName: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('useAppShellProps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a cracked channel, refreshes channels, decrypts history, and refreshes undecrypted count', async () => {
    mocks.api.createChannel.mockResolvedValue({
      key: '11'.repeat(16),
      name: 'Found',
      is_hashtag: false,
    });
    mocks.api.getChannels.mockResolvedValue([
      publicChannel,
      { ...publicChannel, key: '11'.repeat(16), name: 'Found' },
    ]);
    mocks.api.decryptHistoricalPackets.mockResolvedValue({ decrypted_count: 4 });

    const args = createArgs();
    const { result } = renderHook(() => useAppShellProps(args));

    await act(async () => {
      await result.current.crackerProps.onChannelCreate('Found', '11'.repeat(16));
    });

    expect(mocks.api.createChannel).toHaveBeenCalledWith('Found', '11'.repeat(16));
    expect(mocks.api.getChannels).toHaveBeenCalledTimes(1);
    expect(args.setChannels).toHaveBeenCalledWith([
      publicChannel,
      { ...publicChannel, key: '11'.repeat(16), name: 'Found' },
    ]);
    expect(mocks.api.decryptHistoricalPackets).toHaveBeenCalledWith({
      key_type: 'channel',
      channel_key: '11'.repeat(16),
    });
    expect(args.fetchUndecryptedCount).toHaveBeenCalledTimes(1);
  });
});
