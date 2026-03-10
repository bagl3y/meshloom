# Frontend AGENTS.md

This document is the frontend working guide for agents and developers.
Keep it aligned with `frontend/src` source code.

## Stack

- React 18 + TypeScript
- Vite
- Vitest + Testing Library
- shadcn/ui primitives
- Tailwind utility classes + local CSS (`index.css`, `styles.css`)
- Sonner (toasts)
- Leaflet / react-leaflet (map)
- `@michaelhart/meshcore-decoder` installed via npm alias to `meshcore-decoder-multibyte-patch`
- `meshcore-hashtag-cracker` + `nosleep.js` (channel cracker)
- Multibyte-aware decoder build published as `meshcore-decoder-multibyte-patch`

## Frontend Map

```text
frontend/src/
├── main.tsx                # React entry point (StrictMode, root render)
├── App.tsx                 # Data/orchestration entry that wires hooks into AppShell
├── api.ts                  # Typed REST client
├── types.ts                # Shared TS contracts
├── useWebSocket.ts         # WS lifecycle + event dispatch
├── wsEvents.ts             # Typed WS event parsing / discriminated union
├── messageCache.ts         # Conversation-scoped cache
├── prefetch.ts             # Consumes prefetched API promises started in index.html
├── index.css               # Global styles/utilities
├── styles.css              # Additional global app styles
├── themes.css              # Color theme definitions
├── lib/
│   └── utils.ts            # cn() — clsx + tailwind-merge helper
├── hooks/
│   ├── index.ts            # Central re-export of all hooks
│   ├── useConversationActions.ts   # Send/resend/trace/block conversation actions
│   ├── useConversationNavigation.ts # Search target, selection reset, and info-pane navigation state
│   ├── useConversationMessages.ts  # Dedup/update helpers over the conversation timeline
│   ├── useConversationTimeline.ts  # Fetch, cache restore, jump-target loading, pagination, reconcile
│   ├── useUnreadCounts.ts          # Unread counters, mentions, recent-sort timestamps
│   ├── useRealtimeAppState.ts      # WebSocket event application and reconnect recovery
│   ├── useAppShell.ts              # App-shell view state (settings/sidebar/modals/cracker)
│   ├── useAppShellProps.ts         # AppShell child prop assembly + cracker create/decrypt flow
│   ├── useRepeaterDashboard.ts      # Repeater dashboard state (login, panes, console, retries)
│   ├── useRadioControl.ts          # Radio health/config state, reconnection
│   ├── useAppSettings.ts           # Settings, favorites, preferences migration
│   ├── useConversationRouter.ts    # URL hash → active conversation routing
│   └── useContactsAndChannels.ts   # Contact/channel loading, creation, deletion
├── components/
│   ├── AppShell.tsx            # App-shell layout: status, sidebar, search/settings panes, cracker, modals
│   ├── ConversationPane.tsx    # Active conversation surface selection (map/raw/repeater/chat/empty)
│   └── ...
├── utils/
│   ├── urlHash.ts              # Hash parsing and encoding
│   ├── conversationState.ts    # State keys, in-memory + localStorage helpers
│   ├── favorites.ts            # LocalStorage migration for favorites
│   ├── messageParser.ts        # Message text → rendered segments
│   ├── pathUtils.ts            # Distance/validation helpers for paths + map
│   ├── pubkey.ts               # getContactDisplayName (12-char prefix fallback)
│   ├── contactAvatar.ts        # Avatar color derivation from public key
│   ├── rawPacketIdentity.ts    # observation_id vs id dedup helpers
│   ├── visualizerUtils.ts      # 3D visualizer node types, colors, particles
│   ├── visualizerSettings.ts   # LocalStorage persistence for visualizer options
│   ├── a11y.ts                 # Keyboard accessibility helper
│   ├── lastViewedConversation.ts   # localStorage for last-viewed conversation
│   ├── contactMerge.ts            # Merge WS contact updates into list
│   ├── localLabel.ts              # Local label (text + color) in localStorage
│   ├── radioPresets.ts            # LoRa radio preset configurations
│   └── theme.ts                   # Theme switching helpers
├── components/
│   ├── StatusBar.tsx
│   ├── Sidebar.tsx
│   ├── ChatHeader.tsx          # Conversation header (trace, favorite, delete)
│   ├── MessageList.tsx
│   ├── MessageInput.tsx
│   ├── NewMessageModal.tsx
│   ├── SearchView.tsx          # Full-text message search pane
│   ├── SettingsModal.tsx       # Layout shell — delegates to settings/ sections
│   ├── RawPacketList.tsx
│   ├── MapView.tsx
│   ├── VisualizerView.tsx
│   ├── PacketVisualizer3D.tsx
│   ├── PathModal.tsx
│   ├── PathRouteMap.tsx
│   ├── CrackerPanel.tsx
│   ├── BotCodeEditor.tsx
│   ├── ContactAvatar.tsx
│   ├── ContactInfoPane.tsx     # Contact detail sheet (stats, name history, paths)
│   ├── ContactStatusInfo.tsx   # Contact status info component
│   ├── RepeaterDashboard.tsx   # Layout shell — delegates to repeater/ panes
│   ├── RepeaterLogin.tsx       # Repeater login form (password + guest)
│   ├── ChannelInfoPane.tsx     # Channel detail sheet (stats, top senders)
│   ├── NeighborsMiniMap.tsx    # Leaflet mini-map for repeater neighbor locations
│   ├── settings/
│   │   ├── settingsConstants.ts          # Settings section type, ordering, labels
│   │   ├── SettingsRadioSection.tsx      # Name, keys, advert interval, max contacts, radio preset, freq/bw/sf/cr, txPower, lat/lon, reboot
│   │   ├── SettingsLocalSection.tsx      # Browser-local settings: theme, local label, reopen last conversation
│   │   ├── SettingsFanoutSection.tsx     # Fanout integrations: MQTT, bots, config CRUD
│   │   ├── SettingsDatabaseSection.tsx   # DB size, cleanup, auto-decrypt, local label
│   │   ├── SettingsStatisticsSection.tsx # Read-only mesh network stats
│   │   ├── SettingsAboutSection.tsx     # Version, author, license, links
│   │   └── ThemeSelector.tsx           # Color theme picker
│   ├── repeater/
│   │   ├── repeaterPaneShared.tsx        # Shared: RepeaterPane, KvRow, format helpers
│   │   ├── RepeaterTelemetryPane.tsx    # Battery, airtime, packet counts
│   │   ├── RepeaterNeighborsPane.tsx    # Neighbor table + lazy mini-map
│   │   ├── RepeaterAclPane.tsx          # Permission table
│   │   ├── RepeaterRadioSettingsPane.tsx # Radio settings + advert intervals
│   │   ├── RepeaterLppTelemetryPane.tsx # CayenneLPP sensor data
│   │   ├── RepeaterOwnerInfoPane.tsx    # Owner info + guest password
│   │   ├── RepeaterActionsPane.tsx      # Send Advert, Sync Clock, Reboot
│   │   └── RepeaterConsolePane.tsx      # CLI console with history
│   └── ui/                     # shadcn/ui primitives
├── types/
│   ├── d3-force-3d.d.ts       # Type declarations for d3-force-3d
│   └── globals.d.ts           # Global type declarations (__APP_VERSION__, __COMMIT_HASH__)
└── test/
    ├── setup.ts
    ├── fixtures/websocket_events.json
    ├── api.test.ts
    ├── appFavorites.test.tsx
    ├── appStartupHash.test.tsx
    ├── contactAvatar.test.ts
    ├── integration.test.ts
    ├── messageCache.test.ts
    ├── messageParser.test.ts
    ├── pathUtils.test.ts
    ├── prefetch.test.ts
    ├── radioPresets.test.ts
    ├── rawPacketIdentity.test.ts
    ├── repeaterDashboard.test.tsx
    ├── repeaterFormatters.test.ts
    ├── repeaterLogin.test.tsx
    ├── repeaterMessageParsing.test.ts
    ├── localLabel.test.ts
    ├── messageInput.test.tsx
    ├── newMessageModal.test.tsx
    ├── settingsModal.test.tsx
    ├── sidebar.test.tsx
    ├── unreadCounts.test.ts
    ├── urlHash.test.ts
    ├── appSearchJump.test.tsx
    ├── channelInfoKeyVisibility.test.tsx
    ├── chatHeaderKeyVisibility.test.tsx
    ├── searchView.test.tsx
    ├── useConversationMessages.test.ts
    ├── useConversationMessages.race.test.ts
    ├── useConversationNavigation.test.ts
    ├── useAppShellProps.test.ts
    ├── useAppShell.test.ts
    ├── useRepeaterDashboard.test.ts
    ├── useContactsAndChannels.test.ts
    ├── useRealtimeAppState.test.ts
    ├── useUnreadCounts.test.ts
    ├── useWebSocket.dispatch.test.ts
    ├── useWebSocket.lifecycle.test.ts
    └── wsEvents.test.ts

```

## Architecture Notes

### State ownership

`App.tsx` is now a thin composition entrypoint over the hook layer. `AppShell.tsx` owns shell layout/composition:
- local label banner
- status bar
- desktop/mobile sidebar container
- search/settings surface switching
- global cracker mount/focus behavior
- new-message modal and info panes

High-level state is delegated to hooks:
- `useAppShell`: app-shell view state (settings section, sidebar, cracker, new-message modal)
- `useRadioControl`: radio health/config state, reconnect/reboot polling
- `useAppSettings`: settings CRUD, favorites, preferences migration
- `useContactsAndChannels`: contact/channel lists, creation, deletion
- `useConversationRouter`: URL hash → active conversation routing
- `useConversationNavigation`: search target, conversation selection reset, and info-pane state
- `useConversationActions`: send/resend/trace/block handlers and channel override updates
- `useAppShellProps`: assembles the prop bundles passed into `AppShell` children, including the cracker-created-channel historical decrypt flow
- `useConversationMessages`: dedup/update helpers and pending ACK buffering
- `useConversationTimeline`: conversation switch loading, cache restore, jump-target loading, pagination, reconcile
- `useUnreadCounts`: unread counters, mention tracking, recent-sort timestamps
- `useRealtimeAppState`: typed WS event application, reconnect recovery, cache/unread coordination
- `useRepeaterDashboard`: repeater dashboard state (login, pane data/retries, console, actions)

`ConversationPane.tsx` owns the main active-conversation surface branching:
- empty state
- map view
- visualizer
- raw packet feed
- repeater dashboard
- normal chat chrome (`ChatHeader` + `MessageList` + `MessageInput`)

### Initial load + realtime

- Initial data: REST fetches (`api.ts`) for config/settings/channels/contacts/unreads.
- WebSocket: realtime deltas/events.
- On reconnect, the app refetches channels and contacts, refreshes unread counts, and reconciles the active conversation to recover disconnect-window drift.
- On WS connect, backend sends `health` only; contacts/channels still come from REST.

### New Message modal

`NewMessageModal` resets form state on close. The component instance persists across open/close cycles for smooth animations.

### Message behavior

- Outgoing sends are added to UI after the send API returns (not pre-send optimistic insertion), then persisted server-side.
- Backend also emits WS `message` for outgoing sends so other clients stay in sync.
- ACK/repeat updates arrive as `message_acked` events.
- Outgoing channel messages show a 30-second resend control; resend calls `POST /api/messages/channel/{message_id}/resend`.

### Visualizer behavior

- `VisualizerView.tsx` hosts `PacketVisualizer3D.tsx` (desktop split-pane and mobile tabs).
- `PacketVisualizer3D` uses persistent Three.js geometries for links/highlights/particles and updates typed-array buffers in-place per frame.
- Packet repeat aggregation keys prefer decoder `messageHash` (path-insensitive), with hash fallback for malformed packets.
- Raw-packet decoding in `RawPacketList.tsx` and `visualizerUtils.ts` relies on the multibyte-aware decoder fork; keep frontend packet parsing aligned with backend `path_utils.py`.
- Raw packet events carry both:
  - `id`: backend storage row identity (payload-level dedup)
  - `observation_id`: realtime per-arrival identity (session fidelity)
- Packet feed/visualizer render keys and dedup logic should use `observation_id` (fallback to `id` only for older payloads).

### Radio settings behavior

- `SettingsRadioSection.tsx` surfaces `path_hash_mode` only when `config.path_hash_mode_supported` is true.
- Frontend `path_len` fields are hop counts, not raw byte lengths; multibyte path rendering must use the accompanying metadata before splitting hop identifiers.

## WebSocket (`useWebSocket.ts`)

- Auto reconnect (3s) with cleanup guard on unmount.
- Heartbeat ping every 30s.
- Incoming JSON is parsed through `wsEvents.ts`, which returns a typed discriminated union for known events and a centralized `unknown` fallback.
- Event handlers: `health`, `message`, `contact`, `raw_packet`, `message_acked`, `contact_deleted`, `channel_deleted`, `error`, `success`, `pong` (ignored).
- For `raw_packet` events, use `observation_id` as event identity; `id` is a storage reference and may repeat.

## URL Hash Navigation (`utils/urlHash.ts`)

Supported routes:
- `#raw`
- `#map`
- `#map/focus/{pubkey_or_prefix}`
- `#visualizer`
- `#search`
- `#channel/{channelKey}`
- `#channel/{channelKey}/{label}`
- `#contact/{publicKey}`
- `#contact/{publicKey}/{label}`

Legacy name-based hashes are still accepted for compatibility.

## Conversation State Keys (`utils/conversationState.ts`)

`getStateKey(type, id)` produces:
- channels: `channel-{channelKey}`
- contacts: `contact-{publicKey}`

Use full contact public key here (not 12-char prefix).

`conversationState.ts` keeps an in-memory cache and localStorage helpers used for migration/compatibility.
Canonical persistence for unread and sort metadata is server-side (`app_settings` + read-state endpoints).

## Utilities

### `utils/pubkey.ts`

Current public export:
- `getContactDisplayName(name, pubkey)`

It falls back to a 12-char prefix when `name` is missing.

### `utils/pathUtils.ts`

Distance/validation helpers used by path + map UI.

### `utils/favorites.ts`

LocalStorage migration helpers for favorites; canonical favorites are server-side.

## Types and Contracts (`types.ts`)

`AppSettings` currently includes:
- `max_radio_contacts`
- `favorites`
- `auto_decrypt_dm_on_advert`
- `sidebar_sort_order`
- `last_message_times`
- `preferences_migrated`
- `advert_interval`
- `last_advert_time`
- `flood_scope`
- `blocked_keys`, `blocked_names`

Note: MQTT, bot, and community MQTT settings were migrated to the `fanout_configs` table (managed via `/api/fanout`). They are no longer part of `AppSettings`.

`HealthStatus` includes `fanout_statuses: Record<string, FanoutStatusEntry>` mapping config IDs to `{name, type, status}`. Also includes `bots_disabled: boolean`.

`FanoutConfig` represents a single fanout integration: `{id, type, name, enabled, config, scope, sort_order, created_at}`.

`RawPacket.decrypted_info` includes `channel_key` and `contact_key` for MQTT topic routing.

## Contact Info Pane

Clicking a contact's avatar in `ChatHeader` or `MessageList` opens a `ContactInfoPane` sheet (right drawer) showing comprehensive contact details fetched from `GET /api/contacts/{key}/detail`:

- Header: avatar, name, public key, type badge, on-radio badge
- Info grid: last seen, first heard, last contacted, distance, hops
- GPS location (clickable → map)
- Favorite toggle
- Name history ("Also Known As") — shown only when the contact has used multiple names
- Message stats: DM count, channel message count
- Most active rooms (clickable → navigate to channel)
- Advert observation rate
- Nearest repeaters (resolved from first-hop path prefixes)
- Recent advert paths

State: `useConversationNavigation` controls open/close via `infoPaneContactKey`. Live contact data from WebSocket updates is preferred over the initial detail snapshot.

## Channel Info Pane

Clicking a channel name in `ChatHeader` opens a `ChannelInfoPane` sheet (right drawer) showing channel details fetched from `GET /api/channels/{key}/detail`:

- Header: channel name, key (clickable copy), type badge (hashtag/private key), on-radio badge
- Favorite toggle
- Message activity: time-windowed counts (1h, 24h, 48h, 7d, all time) + unique senders
- First message date
- Top senders in last 24h (name + count)

State: `useConversationNavigation` controls open/close via `infoPaneChannelKey`. Live channel data from the `channels` array is preferred over the initial detail snapshot.

## Repeater Dashboard

For repeater contacts (`type=2`), `ConversationPane.tsx` renders `RepeaterDashboard` instead of the normal chat UI (ChatHeader + MessageList + MessageInput).

**Login**: `RepeaterLogin` component — password or guest login via `POST /api/contacts/{key}/repeater/login`.

**Dashboard panes** (after login): Telemetry, Neighbors, ACL, Radio Settings, Advert Intervals, Owner Info — each fetched via granular `POST /api/contacts/{key}/repeater/{pane}` endpoints. Panes retry up to 3 times client-side. "Load All" fetches all panes serially (parallel would queue behind the radio lock).

**Actions pane**: Send Advert, Sync Clock, Reboot — all send CLI commands via `POST /api/contacts/{key}/command`.

**Console pane**: Full CLI access via the same command endpoint. History is ephemeral (not persisted to DB).

All state is managed by `useRepeaterDashboard` hook. State resets on conversation change.

## Message Search Pane

The `SearchView` component (`components/SearchView.tsx`) provides full-text search across all DMs and channel messages. Key behaviors:

- **State**: `targetMessageId` is shared between `useConversationNavigation` and `useConversationMessages`. When a search result is clicked, `handleNavigateToMessage` sets the target ID and switches to the target conversation.
- **Same-conversation clear**: when `targetMessageId` is cleared after the target is reached, the hook preserves the around-loaded mid-history view instead of replacing it with the latest page.
- **Persistence**: `SearchView` stays mounted after first open using the same `hidden` class pattern as `CrackerPanel`, preserving search state when navigating to results.
- **Jump-to-message**: `useConversationTimeline` handles optional `targetMessageId` by calling `api.getMessagesAround()` instead of the normal latest-page fetch, loading context around the target message. `MessageList` scrolls to the target via `data-message-id` attribute and applies a `message-highlight` CSS animation.
- **Bidirectional pagination**: After jumping mid-history, `hasNewerMessages` enables forward pagination via `fetchNewerMessages`. The scroll-to-bottom button calls `jumpToBottom` (re-fetches latest page) instead of just scrolling.
- **WS message suppression**: When `hasNewerMessages` is true, incoming WS messages for the active conversation are not added to the message list (the user is viewing historical context, not the latest page).

## Styling

UI styling is mostly utility-class driven (Tailwind-style classes in JSX) plus shared globals in `index.css` and `styles.css`.
Do not rely on old class-only layout assumptions.

## Security Posture (intentional)

- No authentication UI.
- Frontend assumes trusted network usage.
- Bot editor intentionally allows arbitrary backend bot code configuration.

## Testing

Run all quality checks (backend + frontend) from the repo root:

```bash
./scripts/all_quality.sh
```

Or run frontend checks individually:

```bash
cd frontend
npm run test:run
npm run build
```

When touching cross-layer contracts, also run backend tests from repo root:

```bash
PYTHONPATH=. uv run pytest tests/ -v
```

## Errata & Known Non-Issues

### RawPacketList always scrolls to bottom

`RawPacketList` unconditionally scrolls to the latest packet on every update. This is intentional — the packet feed is a live status display, not an interactive log meant for lingering or long-term analysis. Users watching it want to see the newest packet, not hold a scroll position.

## Editing Checklist

1. If API/WS payloads change, update `types.ts`, handlers, and tests.
2. If URL/hash behavior changes, update `utils/urlHash.ts` tests.
3. If read/unread semantics change, update `useUnreadCounts` tests.
4. Keep this file concise; prefer source links over speculative detail.
