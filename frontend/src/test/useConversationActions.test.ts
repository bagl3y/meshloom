import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useConversationActions } from '../hooks/useConversationActions';
import type { Channel, Conversation, Message } from '../types';

const mocks = vi.hoisted(() => ({
  api: {
    requestTrace: vi.fn(),
    resendChannelMessage: vi.fn(),
    sendChannelMessage: vi.fn(),
    sendDirectMessage: vi.fn(),
    setChannelFloodScopeOverride: vi.fn(),
  },
  messageCache: {
    clear: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../api', () => ({
  api: mocks.api,
}));

vi.mock('../messageCache', () => mocks.messageCache);

vi.mock('../components/ui/sonner', () => ({
  toast: mocks.toast,
}));

const publicChannel: Channel = {
  key: '8B3387E9C5CDEA6AC9E5EDBAA115CD72',
  name: 'Public',
  is_hashtag: false,
  on_radio: false,
  last_read_at: null,
};

const sentMessage: Message = {
  id: 42,
  type: 'CHAN',
  conversation_key: publicChannel.key,
  text: 'hello mesh',
  sender_timestamp: 1700000000,
  received_at: 1700000001,
  paths: null,
  txt_type: 0,
  signature: null,
  sender_key: null,
  outgoing: true,
  acked: 0,
  sender_name: 'Radio',
};

function createArgs(overrides: Partial<Parameters<typeof useConversationActions>[0]> = {}) {
  const activeConversation: Conversation = {
    type: 'channel',
    id: publicChannel.key,
    name: publicChannel.name,
  };

  return {
    activeConversation,
    activeConversationRef: { current: activeConversation },
    setTargetMessageId: vi.fn(),
    channels: [publicChannel],
    setChannels: vi.fn(),
    addMessageIfNew: vi.fn(() => true),
    jumpToBottom: vi.fn(),
    handleToggleBlockedKey: vi.fn(async () => {}),
    handleToggleBlockedName: vi.fn(async () => {}),
    handleSelectConversation: vi.fn(),
    messageInputRef: { current: { appendText: vi.fn() } },
    ...overrides,
  };
}

describe('useConversationActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appends a sent message when the user is still in the same conversation', async () => {
    mocks.api.sendChannelMessage.mockResolvedValue(sentMessage);
    const args = createArgs();

    const { result } = renderHook(() => useConversationActions(args));

    await act(async () => {
      await result.current.handleSendMessage(sentMessage.text);
    });

    expect(mocks.api.sendChannelMessage).toHaveBeenCalledWith(publicChannel.key, sentMessage.text);
    expect(args.addMessageIfNew).toHaveBeenCalledWith(sentMessage);
  });

  it('does not append a sent message after the active conversation changes', async () => {
    let resolveSend: ((message: Message) => void) | null = null;
    mocks.api.sendChannelMessage.mockImplementation(
      () =>
        new Promise<Message>((resolve) => {
          resolveSend = resolve;
        })
    );

    const args = createArgs();
    const { result } = renderHook(() => useConversationActions(args));

    await act(async () => {
      const sendPromise = result.current.handleSendMessage(sentMessage.text);
      args.activeConversationRef.current = {
        type: 'contact',
        id: 'aa'.repeat(32),
        name: 'Alice',
      };
      resolveSend?.(sentMessage);
      await sendPromise;
    });

    expect(args.addMessageIfNew).not.toHaveBeenCalled();
  });

  it('resets the jump target when switching to a normal conversation', () => {
    const args = createArgs();
    const { result } = renderHook(() => useConversationActions(args));

    act(() => {
      result.current.handleSelectConversationWithTargetReset({
        type: 'contact',
        id: 'bb'.repeat(32),
        name: 'Bob',
      });
    });

    expect(args.setTargetMessageId).toHaveBeenCalledWith(null);
    expect(args.handleSelectConversation).toHaveBeenCalledWith({
      type: 'contact',
      id: 'bb'.repeat(32),
      name: 'Bob',
    });
  });

  it('navigates search results into the target conversation and preserves the jump target', () => {
    const args = createArgs();
    const { result } = renderHook(() => useConversationActions(args));

    act(() => {
      result.current.handleNavigateToMessage({
        id: 321,
        type: 'CHAN',
        conversation_key: publicChannel.key,
        conversation_name: publicChannel.name,
      });
    });

    expect(args.setTargetMessageId).toHaveBeenCalledWith(321);
    expect(args.handleSelectConversation).toHaveBeenCalledWith({
      type: 'channel',
      id: publicChannel.key,
      name: publicChannel.name,
    });
  });

  it('clears cached messages and jumps to the latest page after blocking a key', async () => {
    const args = createArgs();
    const { result } = renderHook(() => useConversationActions(args));

    await act(async () => {
      await result.current.handleBlockKey('cc'.repeat(32));
    });

    expect(args.handleToggleBlockedKey).toHaveBeenCalledWith('cc'.repeat(32));
    expect(mocks.messageCache.clear).toHaveBeenCalledTimes(1);
    expect(args.jumpToBottom).toHaveBeenCalledTimes(1);
  });
});
