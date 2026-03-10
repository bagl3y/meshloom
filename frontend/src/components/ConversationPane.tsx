import { lazy, Suspense, useMemo, type Ref } from 'react';

import { ChatHeader } from './ChatHeader';
import { MessageInput, type MessageInputHandle } from './MessageInput';
import { MessageList } from './MessageList';
import { RawPacketList } from './RawPacketList';
import type {
  Channel,
  Contact,
  Conversation,
  Favorite,
  HealthStatus,
  Message,
  RawPacket,
  RadioConfig,
} from '../types';
import { CONTACT_TYPE_REPEATER } from '../types';

const RepeaterDashboard = lazy(() =>
  import('./RepeaterDashboard').then((m) => ({ default: m.RepeaterDashboard }))
);
const MapView = lazy(() => import('./MapView').then((m) => ({ default: m.MapView })));
const VisualizerView = lazy(() =>
  import('./VisualizerView').then((m) => ({ default: m.VisualizerView }))
);

interface ConversationPaneProps {
  activeConversation: Conversation | null;
  contacts: Contact[];
  channels: Channel[];
  rawPackets: RawPacket[];
  config: RadioConfig | null;
  health: HealthStatus | null;
  favorites: Favorite[];
  messages: Message[];
  messagesLoading: boolean;
  loadingOlder: boolean;
  hasOlderMessages: boolean;
  targetMessageId: number | null;
  hasNewerMessages: boolean;
  loadingNewer: boolean;
  messageInputRef: Ref<MessageInputHandle>;
  onTrace: () => Promise<void>;
  onToggleFavorite: (type: 'channel' | 'contact', id: string) => Promise<void>;
  onDeleteContact: (publicKey: string) => Promise<void>;
  onDeleteChannel: (key: string) => Promise<void>;
  onSetChannelFloodScopeOverride: (channelKey: string, floodScopeOverride: string) => Promise<void>;
  onOpenContactInfo: (publicKey: string, fromChannel?: boolean) => void;
  onOpenChannelInfo: (channelKey: string) => void;
  onSenderClick: (sender: string) => void;
  onLoadOlder: () => Promise<void>;
  onResendChannelMessage: (messageId: number, newTimestamp?: boolean) => Promise<void>;
  onTargetReached: () => void;
  onLoadNewer: () => Promise<void>;
  onJumpToBottom: () => void;
  onSendMessage: (text: string) => Promise<void>;
}

function LoadingPane({ label }: { label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">{label}</div>
  );
}

export function ConversationPane({
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
  onTrace,
  onToggleFavorite,
  onDeleteContact,
  onDeleteChannel,
  onSetChannelFloodScopeOverride,
  onOpenContactInfo,
  onOpenChannelInfo,
  onSenderClick,
  onLoadOlder,
  onResendChannelMessage,
  onTargetReached,
  onLoadNewer,
  onJumpToBottom,
  onSendMessage,
}: ConversationPaneProps) {
  const activeContactIsRepeater = useMemo(() => {
    if (!activeConversation || activeConversation.type !== 'contact') return false;
    const contact = contacts.find((candidate) => candidate.public_key === activeConversation.id);
    return contact?.type === CONTACT_TYPE_REPEATER;
  }, [activeConversation, contacts]);

  if (!activeConversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a conversation or start a new one
      </div>
    );
  }

  if (activeConversation.type === 'map') {
    return (
      <>
        <h2 className="flex justify-between items-center px-4 py-2.5 border-b border-border font-semibold text-base">
          Node Map
        </h2>
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<LoadingPane label="Loading map..." />}>
            <MapView contacts={contacts} focusedKey={activeConversation.mapFocusKey} />
          </Suspense>
        </div>
      </>
    );
  }

  if (activeConversation.type === 'visualizer') {
    return (
      <Suspense fallback={<LoadingPane label="Loading visualizer..." />}>
        <VisualizerView packets={rawPackets} contacts={contacts} config={config} />
      </Suspense>
    );
  }

  if (activeConversation.type === 'raw') {
    return (
      <>
        <h2 className="flex justify-between items-center px-4 py-2.5 border-b border-border font-semibold text-base">
          Raw Packet Feed
        </h2>
        <div className="flex-1 overflow-hidden">
          <RawPacketList packets={rawPackets} />
        </div>
      </>
    );
  }

  if (activeConversation.type === 'search') {
    return null;
  }

  if (activeContactIsRepeater) {
    return (
      <Suspense fallback={<LoadingPane label="Loading dashboard..." />}>
        <RepeaterDashboard
          key={activeConversation.id}
          conversation={activeConversation}
          contacts={contacts}
          favorites={favorites}
          radioLat={config?.lat ?? null}
          radioLon={config?.lon ?? null}
          radioName={config?.name ?? null}
          onTrace={onTrace}
          onToggleFavorite={onToggleFavorite}
          onDeleteContact={onDeleteContact}
        />
      </Suspense>
    );
  }

  return (
    <>
      <ChatHeader
        conversation={activeConversation}
        contacts={contacts}
        channels={channels}
        config={config}
        favorites={favorites}
        onTrace={onTrace}
        onToggleFavorite={onToggleFavorite}
        onSetChannelFloodScopeOverride={onSetChannelFloodScopeOverride}
        onDeleteChannel={onDeleteChannel}
        onDeleteContact={onDeleteContact}
        onOpenContactInfo={onOpenContactInfo}
        onOpenChannelInfo={onOpenChannelInfo}
      />
      <MessageList
        key={activeConversation.id}
        messages={messages}
        contacts={contacts}
        loading={messagesLoading}
        loadingOlder={loadingOlder}
        hasOlderMessages={hasOlderMessages}
        onSenderClick={activeConversation.type === 'channel' ? onSenderClick : undefined}
        onLoadOlder={onLoadOlder}
        onResendChannelMessage={
          activeConversation.type === 'channel' ? onResendChannelMessage : undefined
        }
        radioName={config?.name}
        config={config}
        onOpenContactInfo={onOpenContactInfo}
        targetMessageId={targetMessageId}
        onTargetReached={onTargetReached}
        hasNewerMessages={hasNewerMessages}
        loadingNewer={loadingNewer}
        onLoadNewer={onLoadNewer}
        onJumpToBottom={onJumpToBottom}
      />
      <MessageInput
        ref={messageInputRef}
        onSend={onSendMessage}
        disabled={!health?.radio_connected}
        conversationType={activeConversation.type}
        senderName={config?.name}
        placeholder={
          !health?.radio_connected ? 'Radio not connected' : `Message ${activeConversation.name}...`
        }
      />
    </>
  );
}
