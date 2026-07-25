import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConversationPane } from '../components/ConversationPane';
import {
  clearRawPackets,
  getRawPacketStatsSession,
  getRawPackets,
  recordRawPacket,
  resetRawPacketStore,
  useRawPackets,
} from '../stores/rawPacketStore';
import type {
  Channel,
  Contact,
  Conversation,
  HealthStatus,
  Message,
  RadioConfig,
  RawPacket,
} from '../types';
import type { RawPacketStatsSessionState } from '../utils/rawPacketStats';

const mocks = vi.hoisted(() => ({
  messageList: vi.fn(() => <div data-testid="message-list" />),
}));

vi.mock('../components/MessageList', () => ({
  MessageList: mocks.messageList,
}));

vi.mock('../components/ChatHeader', () => ({
  ChatHeader: () => <div data-testid="chat-header" />,
}));

function createPacket(overrides: Partial<RawPacket> = {}): RawPacket {
  return {
    id: 1,
    observation_id: 1,
    timestamp: 1700000000,
    data: 'aabb',
    payload_type: 'GROUP_TEXT',
    snr: 7.5,
    rssi: -80,
    decrypted: false,
    decrypted_info: null,
    ...overrides,
  };
}

const channel: Channel = {
  key: '8B3387E9C5CDEA6AC9E5EDBAA115CD72',
  name: 'Public',
  is_hashtag: false,
  on_radio: false,
  last_read_at: null,
  favorite: false,
  muted: false,
};

const config: RadioConfig = {
  public_key: 'aa'.repeat(32),
  name: 'Radio',
  lat: 1,
  lon: 2,
  tx_power: 17,
  max_tx_power: 22,
  radio: { freq: 910.525, bw: 62.5, sf: 7, cr: 5 },
  path_hash_mode: 0,
  path_hash_mode_supported: true,
};

const health: HealthStatus = {
  status: 'ok',
  radio_connected: true,
  radio_initializing: false,
  connection_info: 'serial',
  database_size_mb: 1,
  oldest_undecrypted_timestamp: null,
  fanout_statuses: {},
  bots_disabled: false,
};

const message: Message = {
  id: 1,
  type: 'CHAN',
  conversation_key: channel.key,
  text: 'hello',
  sender_timestamp: 1700000000,
  received_at: 1700000001,
  paths: null,
  txt_type: 0,
  signature: null,
  sender_key: null,
  outgoing: false,
  acked: 0,
  sender_name: null,
};

const rawPacketStatsSession: RawPacketStatsSessionState = {
  sessionStartedAt: 1_700_000_000_000,
  totalObservedPackets: 0,
  trimmedObservationCount: 0,
  observations: [],
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function chatPaneProps(): any {
  return {
    activeConversation: { type: 'channel', id: channel.key, name: channel.name } as Conversation,
    contacts: [] as Contact[],
    channels: [channel],
    rawPacketStatsSession,
    config,
    health,
    notificationsSupported: true,
    notificationsEnabled: false,
    notificationsPermission: 'granted' as const,
    messages: [message],
    messagesLoading: false,
    loadingOlder: false,
    hasOlderMessages: false,
    unreadMarkerLastReadAt: undefined,
    targetMessageId: null,
    hasNewerMessages: false,
    loadingNewer: false,
    messageInputRef: { current: null },
    onTrace: vi.fn(async () => {}),
    onRunTracePath: vi.fn(async () => ({ path_len: 0, timeout_seconds: 5, nodes: [] })),
    onPathDiscovery: vi.fn(async () => {
      throw new Error('unused');
    }),
    onToggleFavorite: vi.fn(async () => {}),
    onToggleMute: vi.fn(async () => {}),
    onDeleteContact: vi.fn(async () => {}),
    onDeleteChannel: vi.fn(async () => {}),
    onSetChannelFloodScopeOverride: vi.fn(async () => {}),
    onSelectConversation: vi.fn(),
    onOpenContactInfo: vi.fn(),
    onOpenChannelInfo: vi.fn(),
    onSenderClick: vi.fn(),
    onLoadOlder: vi.fn(async () => {}),
    onResendChannelMessage: vi.fn(async () => {}),
    onTargetReached: vi.fn(),
    onLoadNewer: vi.fn(async () => {}),
    onJumpToBottom: vi.fn(),
    onDismissUnreadMarker: vi.fn(),
    onSendMessage: vi.fn(async () => {}),
    onToggleNotifications: vi.fn(),
    trackedTelemetryRepeaters: [],
    onToggleTrackedTelemetry: vi.fn(async () => {}),
    repeaterAutoLoginKey: null,
    onClearRepeaterAutoLogin: vi.fn(),
  };
}

describe('rawPacketStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRawPacketStore();
  });

  it('appends packets and counts them in the session stats', () => {
    recordRawPacket(createPacket({ id: 1, observation_id: 1 }));
    recordRawPacket(createPacket({ id: 2, observation_id: 2 }));

    expect(getRawPackets()).toHaveLength(2);
    expect(getRawPacketStatsSession().totalObservedPackets).toBe(2);
  });

  it('ignores a repeat of the same observation', () => {
    recordRawPacket(createPacket({ id: 1, observation_id: 9 }));
    recordRawPacket(createPacket({ id: 1, observation_id: 9 }));

    expect(getRawPackets()).toHaveLength(1);
    expect(getRawPacketStatsSession().totalObservedPackets).toBe(1);
  });

  it('caps the buffer at the requested size, keeping the newest packets', () => {
    for (let i = 1; i <= 5; i++) {
      recordRawPacket(createPacket({ id: i, observation_id: i }), 3);
    }

    expect(getRawPackets().map((p) => p.id)).toEqual([3, 4, 5]);
  });

  it('keeps session stats across a reconnect clear', () => {
    recordRawPacket(createPacket({ id: 1, observation_id: 1 }));
    clearRawPackets();

    expect(getRawPackets()).toEqual([]);
    expect(getRawPacketStatsSession().totalObservedPackets).toBe(1);
  });

  it('notifies subscribed views when a packet arrives', () => {
    function PacketCount() {
      return <span data-testid="count">{useRawPackets().length}</span>;
    }
    render(<PacketCount />);
    expect(screen.getByTestId('count').textContent).toBe('0');

    act(() => recordRawPacket(createPacket({ id: 1, observation_id: 1 })));

    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  /**
   * The reason this store exists: overheard traffic used to live in App state, so every
   * packet re-rendered the whole message list. That cost scales with history length and
   * made typing in a busy channel crawl.
   */
  it('does not re-render the chat message list when packets arrive', () => {
    render(<ConversationPane {...chatPaneProps()} />);
    expect(screen.getByTestId('message-list')).toBeInTheDocument();

    const rendersAfterMount = mocks.messageList.mock.calls.length;
    act(() => {
      for (let i = 1; i <= 25; i++) {
        recordRawPacket(createPacket({ id: i, observation_id: i }));
      }
    });

    expect(getRawPackets()).toHaveLength(25);
    expect(mocks.messageList.mock.calls.length).toBe(rendersAfterMount);
  });
});
