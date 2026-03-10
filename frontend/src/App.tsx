import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  startTransition,
  lazy,
  Suspense,
} from 'react';
import { api } from './api';
import { takePrefetchOrFetch } from './prefetch';
import { useWebSocket } from './useWebSocket';
import {
  useUnreadCounts,
  useConversationMessages,
  useRadioControl,
  useAppSettings,
  useConversationRouter,
  useContactsAndChannels,
  useConversationActions,
  useRealtimeAppState,
} from './hooks';
import { StatusBar } from './components/StatusBar';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { MessageList } from './components/MessageList';
import { MessageInput, type MessageInputHandle } from './components/MessageInput';
import { NewMessageModal } from './components/NewMessageModal';
import {
  SETTINGS_SECTION_LABELS,
  SETTINGS_SECTION_ORDER,
  type SettingsSection,
} from './components/settings/settingsConstants';
import { RawPacketList } from './components/RawPacketList';
import { ContactInfoPane } from './components/ContactInfoPane';
import { ChannelInfoPane } from './components/ChannelInfoPane';
import { CONTACT_TYPE_REPEATER } from './types';

// Lazy-load heavy components to reduce initial bundle
const RepeaterDashboard = lazy(() =>
  import('./components/RepeaterDashboard').then((m) => ({ default: m.RepeaterDashboard }))
);
const MapView = lazy(() => import('./components/MapView').then((m) => ({ default: m.MapView })));
const VisualizerView = lazy(() =>
  import('./components/VisualizerView').then((m) => ({ default: m.VisualizerView }))
);
const SettingsModal = lazy(() =>
  import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const CrackerPanel = lazy(() =>
  import('./components/CrackerPanel').then((m) => ({ default: m.CrackerPanel }))
);
const SearchView = lazy(() =>
  import('./components/SearchView').then((m) => ({ default: m.SearchView }))
);
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './components/ui/sheet';
import { Toaster } from './components/ui/sonner';
import { messageContainsMention } from './utils/messageParser';
import { getLocalLabel, getContrastTextColor } from './utils/localLabel';
import { cn } from '@/lib/utils';
import type { Conversation, RawPacket } from './types';

export function App() {
  const messageInputRef = useRef<MessageInputHandle>(null);
  const [rawPackets, setRawPackets] = useState<RawPacket[]>([]);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('radio');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCracker, setShowCracker] = useState(false);
  const [crackerRunning, setCrackerRunning] = useState(false);
  const [localLabel, setLocalLabel] = useState(getLocalLabel);
  const [targetMessageId, setTargetMessageId] = useState<number | null>(null);

  // Defer CrackerPanel mount until first opened (lazy-loaded, but keep mounted after for state)
  const crackerMounted = useRef(false);
  if (showCracker) crackerMounted.current = true;

  // Shared refs between useConversationRouter and useContactsAndChannels
  const pendingDeleteFallbackRef = useRef(false);
  const hasSetDefaultConversation = useRef(false);

  // Stable ref bridge: useContactsAndChannels needs setActiveConversation from
  // useConversationRouter, but useConversationRouter needs channels/contacts from
  // useContactsAndChannels. We break the cycle with a ref-based indirection.
  const setActiveConversationRef = useRef<(conv: Conversation | null) => void>(() => {});

  // --- Extracted hooks ---

  const {
    health,
    setHealth,
    config,
    prevHealthRef,
    fetchConfig,
    handleSaveConfig,
    handleSetPrivateKey,
    handleReboot,
    handleAdvertise,
    handleHealthRefresh,
  } = useRadioControl();

  const {
    appSettings,
    favorites,
    fetchAppSettings,
    handleSaveAppSettings,
    handleSortOrderChange,
    handleToggleFavorite,
    handleToggleBlockedKey,
    handleToggleBlockedName,
  } = useAppSettings();

  // Keep user's name in ref for mention detection in WebSocket callback
  const myNameRef = useRef<string | null>(null);
  useEffect(() => {
    myNameRef.current = config?.name ?? null;
  }, [config?.name]);

  // Keep block lists in refs for WS callback filtering
  const blockedKeysRef = useRef<string[]>([]);
  const blockedNamesRef = useRef<string[]>([]);
  useEffect(() => {
    blockedKeysRef.current = appSettings?.blocked_keys ?? [];
    blockedNamesRef.current = appSettings?.blocked_names ?? [];
  }, [appSettings?.blocked_keys, appSettings?.blocked_names]);

  // Check if a message mentions the user
  const checkMention = useCallback(
    (text: string): boolean => messageContainsMention(text, myNameRef.current),
    []
  );

  // useContactsAndChannels is called first — it uses the ref bridge for setActiveConversation
  const {
    contacts,
    contactsLoaded,
    channels,
    undecryptedCount,
    setContacts,
    setContactsLoaded,
    setChannels,
    fetchAllContacts,
    fetchUndecryptedCount,
    handleCreateContact,
    handleCreateChannel,
    handleCreateHashtagChannel,
    handleDeleteChannel,
    handleDeleteContact,
  } = useContactsAndChannels({
    setActiveConversation: (conv) => setActiveConversationRef.current(conv),
    pendingDeleteFallbackRef,
    hasSetDefaultConversation,
  });

  // useConversationRouter is called second — it receives channels/contacts as inputs
  const {
    activeConversation,
    setActiveConversation,
    activeConversationRef,
    handleSelectConversation,
  } = useConversationRouter({
    channels,
    contacts,
    contactsLoaded,
    setSidebarOpen,
    pendingDeleteFallbackRef,
    hasSetDefaultConversation,
  });

  // Wire up the ref bridge so useContactsAndChannels handlers reach the real setter
  setActiveConversationRef.current = setActiveConversation;

  // Keep SearchView mounted after first open to preserve search state
  const searchMounted = useRef(false);
  if (activeConversation?.type === 'search') searchMounted.current = true;

  // Custom hooks for conversation-specific functionality
  const {
    messages,
    messagesLoading,
    loadingOlder,
    hasOlderMessages,
    hasNewerMessages,
    loadingNewer,
    hasNewerMessagesRef,
    fetchOlderMessages,
    fetchNewerMessages,
    jumpToBottom,
    addMessageIfNew,
    updateMessageAck,
    triggerReconcile,
  } = useConversationMessages(activeConversation, targetMessageId);

  const {
    unreadCounts,
    mentions,
    lastMessageTimes,
    incrementUnread,
    markAllRead,
    trackNewMessage,
    refreshUnreads,
  } = useUnreadCounts(channels, contacts, activeConversation);

  // Determine if active contact is a repeater (used for routing to dashboard)
  const activeContactIsRepeater = useMemo(() => {
    if (!activeConversation || activeConversation.type !== 'contact') return false;
    const contact = contacts.find((c) => c.public_key === activeConversation.id);
    return contact?.type === CONTACT_TYPE_REPEATER;
  }, [activeConversation, contacts]);

  const wsHandlers = useRealtimeAppState({
    prevHealthRef,
    setHealth,
    fetchConfig,
    setRawPackets,
    triggerReconcile,
    refreshUnreads,
    setChannels,
    fetchAllContacts,
    setContacts,
    blockedKeysRef,
    blockedNamesRef,
    activeConversationRef,
    hasNewerMessagesRef,
    addMessageIfNew,
    trackNewMessage,
    incrementUnread,
    checkMention,
    pendingDeleteFallbackRef,
    setActiveConversation,
    updateMessageAck,
  });
  const {
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
  } = useConversationActions({
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
  });

  // Connect to WebSocket
  useWebSocket(wsHandlers);

  // Initial fetch for config, settings, and data
  useEffect(() => {
    fetchConfig();
    fetchAppSettings();
    fetchUndecryptedCount();

    // Fetch contacts and channels via REST (parallel, faster than WS serial push)
    takePrefetchOrFetch('channels', api.getChannels).then(setChannels).catch(console.error);
    fetchAllContacts()
      .then((data) => {
        setContacts(data);
        setContactsLoaded(true);
      })
      .catch((err) => {
        console.error(err);
        setContactsLoaded(true);
      });
  }, [
    fetchConfig,
    fetchAppSettings,
    fetchUndecryptedCount,
    fetchAllContacts,
    setChannels,
    setContacts,
    setContactsLoaded,
  ]);

  const handleCloseSettingsView = useCallback(() => {
    startTransition(() => setShowSettings(false));
    setSidebarOpen(false);
  }, []);

  const handleToggleSettingsView = useCallback(() => {
    startTransition(() => {
      setShowSettings((prev) => !prev);
    });
    setSidebarOpen(false);
  }, []);

  const handleNewMessage = useCallback(() => {
    setShowNewMessage(true);
    setSidebarOpen(false);
  }, []);

  const handleToggleCracker = useCallback(() => {
    setShowCracker((prev) => !prev);
  }, []);

  // Sidebar content (shared between desktop and mobile)
  const sidebarContent = (
    <Sidebar
      contacts={contacts}
      channels={channels}
      activeConversation={activeConversation}
      onSelectConversation={handleSelectConversationWithTargetReset}
      onNewMessage={handleNewMessage}
      lastMessageTimes={lastMessageTimes}
      unreadCounts={unreadCounts}
      mentions={mentions}
      showCracker={showCracker}
      crackerRunning={crackerRunning}
      onToggleCracker={handleToggleCracker}
      onMarkAllRead={markAllRead}
      favorites={favorites}
      sortOrder={appSettings?.sidebar_sort_order ?? 'recent'}
      onSortOrderChange={handleSortOrderChange}
    />
  );

  const settingsSidebarContent = (
    <nav
      className="sidebar w-60 h-full min-h-0 overflow-hidden bg-card border-r border-border flex flex-col"
      aria-label="Settings"
    >
      <div className="flex justify-between items-center px-3 py-2.5 border-b border-border">
        <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Settings
        </h2>
        <button
          type="button"
          onClick={handleCloseSettingsView}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-status-connected/15 border border-status-connected/30 text-status-connected hover:bg-status-connected/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Back to conversations"
          aria-label="Back to conversations"
        >
          &larr; Back to Chat
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto py-1 [contain:layout_paint]">
        {SETTINGS_SECTION_ORDER.map((section) => (
          <button
            key={section}
            type="button"
            className={cn(
              'w-full px-3 py-2 text-left text-[13px] border-l-2 border-transparent hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              settingsSection === section && 'bg-accent border-l-primary'
            )}
            aria-current={settingsSection === section ? 'true' : undefined}
            onClick={() => setSettingsSection(section)}
          >
            {SETTINGS_SECTION_LABELS[section]}
          </button>
        ))}
      </div>
    </nav>
  );

  const activeSidebarContent = showSettings ? settingsSidebarContent : sidebarContent;

  return (
    <div className="flex flex-col h-full">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-primary focus:text-primary-foreground"
      >
        Skip to content
      </a>
      {localLabel.text && (
        <div
          style={{
            backgroundColor: localLabel.color,
            color: getContrastTextColor(localLabel.color),
          }}
          className="px-4 py-1 text-center text-sm font-medium"
        >
          {localLabel.text}
        </div>
      )}
      <StatusBar
        health={health}
        config={config}
        settingsMode={showSettings}
        onSettingsClick={handleToggleSettingsView}
        onMenuClick={showSettings ? undefined : () => setSidebarOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar - hidden on mobile */}
        <div className="hidden md:block min-h-0 overflow-hidden">{activeSidebarContent}</div>

        {/* Mobile sidebar - Sheet that slides in */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[280px] p-0 flex flex-col" hideCloseButton>
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>Sidebar navigation</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">{activeSidebarContent}</div>
          </SheetContent>
        </Sheet>

        <main id="main-content" className="flex-1 flex flex-col bg-background min-w-0">
          <div
            className={cn(
              'flex-1 flex flex-col min-h-0',
              (showSettings || activeConversation?.type === 'search') && 'hidden'
            )}
          >
            {activeConversation ? (
              activeConversation.type === 'map' ? (
                <>
                  <h2 className="flex justify-between items-center px-4 py-2.5 border-b border-border font-semibold text-base">
                    Node Map
                  </h2>
                  <div className="flex-1 overflow-hidden">
                    <Suspense
                      fallback={
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                          Loading map...
                        </div>
                      }
                    >
                      <MapView contacts={contacts} focusedKey={activeConversation.mapFocusKey} />
                    </Suspense>
                  </div>
                </>
              ) : activeConversation.type === 'visualizer' ? (
                <Suspense
                  fallback={
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      Loading visualizer...
                    </div>
                  }
                >
                  <VisualizerView packets={rawPackets} contacts={contacts} config={config} />
                </Suspense>
              ) : activeConversation.type === 'raw' ? (
                <>
                  <h2 className="flex justify-between items-center px-4 py-2.5 border-b border-border font-semibold text-base">
                    Raw Packet Feed
                  </h2>
                  <div className="flex-1 overflow-hidden">
                    <RawPacketList packets={rawPackets} />
                  </div>
                </>
              ) : activeConversation.type === 'search' ? null : activeContactIsRepeater ? (
                <Suspense
                  fallback={
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      Loading dashboard...
                    </div>
                  }
                >
                  <RepeaterDashboard
                    key={activeConversation.id}
                    conversation={activeConversation}
                    contacts={contacts}
                    favorites={favorites}
                    radioLat={config?.lat ?? null}
                    radioLon={config?.lon ?? null}
                    radioName={config?.name ?? null}
                    onTrace={handleTrace}
                    onToggleFavorite={handleToggleFavorite}
                    onDeleteContact={handleDeleteContact}
                  />
                </Suspense>
              ) : (
                <>
                  <ChatHeader
                    conversation={activeConversation}
                    contacts={contacts}
                    channels={channels}
                    config={config}
                    favorites={favorites}
                    onTrace={handleTrace}
                    onToggleFavorite={handleToggleFavorite}
                    onSetChannelFloodScopeOverride={handleSetChannelFloodScopeOverride}
                    onDeleteChannel={handleDeleteChannel}
                    onDeleteContact={handleDeleteContact}
                    onOpenContactInfo={handleOpenContactInfo}
                    onOpenChannelInfo={handleOpenChannelInfo}
                  />
                  <MessageList
                    key={activeConversation.id}
                    messages={messages}
                    contacts={contacts}
                    loading={messagesLoading}
                    loadingOlder={loadingOlder}
                    hasOlderMessages={hasOlderMessages}
                    onSenderClick={
                      activeConversation.type === 'channel' ? handleSenderClick : undefined
                    }
                    onLoadOlder={fetchOlderMessages}
                    onResendChannelMessage={
                      activeConversation.type === 'channel' ? handleResendChannelMessage : undefined
                    }
                    radioName={config?.name}
                    config={config}
                    onOpenContactInfo={handleOpenContactInfo}
                    targetMessageId={targetMessageId}
                    onTargetReached={() => setTargetMessageId(null)}
                    hasNewerMessages={hasNewerMessages}
                    loadingNewer={loadingNewer}
                    onLoadNewer={fetchNewerMessages}
                    onJumpToBottom={jumpToBottom}
                  />
                  <MessageInput
                    ref={messageInputRef}
                    onSend={handleSendMessage}
                    disabled={!health?.radio_connected}
                    conversationType={activeConversation.type}
                    senderName={config?.name}
                    placeholder={
                      !health?.radio_connected
                        ? 'Radio not connected'
                        : `Message ${activeConversation.name}...`
                    }
                  />
                </>
              )
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a conversation or start a new one
              </div>
            )}
          </div>

          {searchMounted.current && (
            <div
              className={cn(
                'flex-1 flex flex-col min-h-0',
                (activeConversation?.type !== 'search' || showSettings) && 'hidden'
              )}
            >
              <Suspense
                fallback={
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    Loading search...
                  </div>
                }
              >
                <SearchView
                  contacts={contacts}
                  channels={channels}
                  onNavigateToMessage={handleNavigateToMessage}
                />
              </Suspense>
            </div>
          )}

          {showSettings && (
            <div className="flex-1 flex flex-col min-h-0">
              <h2 className="flex justify-between items-center px-4 py-2.5 border-b border-border font-semibold text-base">
                <span>Radio & Settings</span>
                <span className="text-sm text-muted-foreground hidden md:inline">
                  {SETTINGS_SECTION_LABELS[settingsSection]}
                </span>
              </h2>
              <div className="flex-1 min-h-0 overflow-hidden">
                <Suspense
                  fallback={
                    <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
                      Loading settings...
                    </div>
                  }
                >
                  <SettingsModal
                    open={showSettings}
                    pageMode
                    externalSidebarNav
                    desktopSection={settingsSection}
                    config={config}
                    health={health}
                    appSettings={appSettings}
                    onClose={handleCloseSettingsView}
                    onSave={handleSaveConfig}
                    onSaveAppSettings={handleSaveAppSettings}
                    onSetPrivateKey={handleSetPrivateKey}
                    onReboot={handleReboot}
                    onAdvertise={handleAdvertise}
                    onHealthRefresh={handleHealthRefresh}
                    onRefreshAppSettings={fetchAppSettings}
                    onLocalLabelChange={setLocalLabel}
                    blockedKeys={appSettings?.blocked_keys}
                    blockedNames={appSettings?.blocked_names}
                    onToggleBlockedKey={handleBlockKey}
                    onToggleBlockedName={handleBlockName}
                  />
                </Suspense>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Global Cracker Panel - deferred until first opened, then kept mounted for state */}
      <div
        ref={(el) => {
          // Focus the panel when it becomes visible
          if (showCracker && el) {
            const focusable = el.querySelector<HTMLElement>('input, button:not([disabled])');
            if (focusable) setTimeout(() => focusable.focus(), 210);
          }
        }}
        className={cn(
          'border-t border-border bg-background transition-all duration-200 overflow-hidden',
          showCracker ? 'h-[275px]' : 'h-0'
        )}
      >
        {crackerMounted.current && (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading cracker...
              </div>
            }
          >
            <CrackerPanel
              packets={rawPackets}
              channels={channels}
              visible={showCracker}
              onChannelCreate={async (name, key) => {
                const created = await api.createChannel(name, key);
                const data = await api.getChannels();
                setChannels(data);
                await api.decryptHistoricalPackets({
                  key_type: 'channel',
                  channel_key: created.key,
                });
                fetchUndecryptedCount();
              }}
              onRunningChange={setCrackerRunning}
            />
          </Suspense>
        )}
      </div>

      <NewMessageModal
        open={showNewMessage}
        contacts={contacts}
        undecryptedCount={undecryptedCount}
        onClose={() => setShowNewMessage(false)}
        onSelectConversation={(conv) => {
          handleSelectConversationWithTargetReset(conv);
          setShowNewMessage(false);
        }}
        onCreateContact={handleCreateContact}
        onCreateChannel={handleCreateChannel}
        onCreateHashtagChannel={handleCreateHashtagChannel}
      />

      <ContactInfoPane
        contactKey={infoPaneContactKey}
        fromChannel={infoPaneFromChannel}
        onClose={handleCloseContactInfo}
        contacts={contacts}
        config={config}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        onNavigateToChannel={handleNavigateToChannel}
        blockedKeys={appSettings?.blocked_keys}
        blockedNames={appSettings?.blocked_names}
        onToggleBlockedKey={handleBlockKey}
        onToggleBlockedName={handleBlockName}
      />

      <ChannelInfoPane
        channelKey={infoPaneChannelKey}
        onClose={handleCloseChannelInfo}
        channels={channels}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
      />

      <Toaster position="top-right" />
    </div>
  );
}
