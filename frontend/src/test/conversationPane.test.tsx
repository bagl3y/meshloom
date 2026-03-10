import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConversationPane } from '../components/ConversationPane';
import type {
  Channel,
  Contact,
  Conversation,
  Favorite,
  HealthStatus,
  Message,
  RadioConfig,
} from '../types';

vi.mock('../components/ChatHeader', () => ({
  ChatHeader: () => <div data-testid="chat-header" />,
}));

vi.mock('../components/MessageList', () => ({
  MessageList: () => <div data-testid="message-list" />,
}));

vi.mock('../components/MessageInput', () => ({
  MessageInput: React.forwardRef((_props, ref) => {
    React.useImperativeHandle(ref, () => ({ appendText: vi.fn() }));
    return <div data-testid="message-input" />;
  }),
}));

vi.mock('../components/RawPacketList', () => ({
  RawPacketList: () => <div data-testid="raw-packet-list" />,
}));

vi.mock('../components/RepeaterDashboard', () => ({
  RepeaterDashboard: () => <div data-testid="repeater-dashboard" />,
}));

vi.mock('../components/MapView', () => ({
  MapView: () => <div data-testid="map-view" />,
}));

vi.mock('../components/VisualizerView', () => ({
  VisualizerView: () => <div data-testid="visualizer-view" />,
}));

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

const channel: Channel = {
  key: '8B3387E9C5CDEA6AC9E5EDBAA115CD72',
  name: 'Public',
  is_hashtag: false,
  on_radio: false,
  last_read_at: null,
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

function createProps(overrides: Partial<React.ComponentProps<typeof ConversationPane>> = {}) {
  return {
    activeConversation: null as Conversation | null,
    contacts: [] as Contact[],
    channels: [channel],
    rawPackets: [],
    config,
    health,
    favorites: [] as Favorite[],
    messages: [message],
    messagesLoading: false,
    loadingOlder: false,
    hasOlderMessages: false,
    targetMessageId: null,
    hasNewerMessages: false,
    loadingNewer: false,
    messageInputRef: { current: null },
    onTrace: vi.fn(async () => {}),
    onToggleFavorite: vi.fn(async () => {}),
    onDeleteContact: vi.fn(async () => {}),
    onDeleteChannel: vi.fn(async () => {}),
    onSetChannelFloodScopeOverride: vi.fn(async () => {}),
    onOpenContactInfo: vi.fn(),
    onOpenChannelInfo: vi.fn(),
    onSenderClick: vi.fn(),
    onLoadOlder: vi.fn(async () => {}),
    onResendChannelMessage: vi.fn(async () => {}),
    onTargetReached: vi.fn(),
    onLoadNewer: vi.fn(async () => {}),
    onJumpToBottom: vi.fn(),
    onSendMessage: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('ConversationPane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty state when no conversation is active', () => {
    render(<ConversationPane {...createProps()} />);

    expect(screen.getByText('Select a conversation or start a new one')).toBeInTheDocument();
  });

  it('renders repeater dashboard instead of chat chrome for repeater contacts', async () => {
    render(
      <ConversationPane
        {...createProps({
          activeConversation: {
            type: 'contact',
            id: 'bb'.repeat(32),
            name: 'Repeater',
          },
          contacts: [
            {
              public_key: 'bb'.repeat(32),
              name: 'Repeater',
              type: 2,
              flags: 0,
              last_path: null,
              last_path_len: 0,
              out_path_hash_mode: 0,
              last_advert: null,
              lat: null,
              lon: null,
              last_seen: null,
              on_radio: false,
              last_contacted: null,
              last_read_at: null,
              first_seen: null,
            },
          ],
        })}
      />
    );

    expect(await screen.findByTestId('repeater-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('message-list')).not.toBeInTheDocument();
  });

  it('renders chat chrome for normal channel conversations', async () => {
    render(
      <ConversationPane
        {...createProps({
          activeConversation: {
            type: 'channel',
            id: channel.key,
            name: channel.name,
          },
        })}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('chat-header')).toBeInTheDocument();
      expect(screen.getByTestId('message-list')).toBeInTheDocument();
      expect(screen.getByTestId('message-input')).toBeInTheDocument();
    });
  });
});
