---
title: Push notifications
description: Notifications even when the tab is closed. HTTPS required.
level: deep
order: 18
---

Web push can notify a browser about an incoming message while its tab is closed. It is separate from [fanout](/en/docs/deep/fanout/): each browser has its own subscription, while the rules (defaults and exceptions) are shared by the whole install.

There are no in-tab desktop notifications. Web Push is the only notification surface.

## Two requirements

**HTTPS.** A service worker requires a secure context. A self-signed certificate is enough; see [HTTPS](/en/docs/deep/https/).

**Outbound Internet from the server.** Push services are external: Google FCM, Mozilla autopush, or APNs. This is the only Meshloom feature that needs Internet egress.

## VAPID keys

The P-256 key pair is generated at first startup and stored in `app_settings`. The public key is exposed through `GET /api/push/vapid-public-key`.

The token subject is edited in **Settings → Notifications** and stored as `app_settings.vapid_subject`. When that field is empty, Meshloom falls back to `MESHCORE_VAPID_SUBJECT` (default `mailto:noreply@meshcore.local`).

**Apple requires a real `mailto:` or `https:` contact.** APNs rejects a subject that is not a contact URI, and the `.local` default yields `403 BadJwtToken`. Set a real address in the UI, or as an environment fallback:

```text
MESHCORE_VAPID_SUBJECT=mailto:you@example.com
```

See [Apple's web push documentation](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers). Google FCM accepts the default, so the problem often appears only on the first Apple device.

## Browser subscriptions and global rules

A browser subscription is stored in `push_subscriptions` with its endpoint, device label, and delivery state. Defaults and per-conversation exceptions live once per instance (`push_defaults` and `push_conversation_overrides`). Enabling an exception on one phone applies it to every subscribed browser. Subscribing or unsubscribing only controls whether that browser receives them.

Migration imported the old opt-in list (`push_conversations`) as explicit `true` overrides. The five defaults themselves were turned ON for existing databases.

## What fires by default

Toggles live in **Settings → Notifications** (`#settings/notifications`). All start ON.

| Toggle | Effect |
|--------|--------|
| New contacts | First-seen companion (type 1) |
| Direct messages | Incoming `PRIV`, including room-server posts |
| Repeater advertisements | First-seen repeater (type 2) |
| Companion advertisements | First-seen companion (type 1) |
| Sensor advertisements | First-seen sensor (type 4) |

For a companion, **New contacts** or **Companion advertisements** is enough.

First-seen alerts fire only when a **new contact row** is inserted, after radio setup. An already-known node, a prefix promotion, an unknown node (type 0), or a room server (type 3) never trigger this alert. It is not a WebSocket event.

For channels, with no exception:

- Public and `#` (hashtag) channels are ON;
- private-key channels are OFF.

A per-conversation exception wins over those defaults.

**Mute circuit breaker.** The dedicated header button (bell-off) silences push for that channel, independently of defaults and exceptions. It is not the same control as the exception bell.

## In the interface

**Settings → Notifications**: subscribe this browser, list devices (test / unsubscribe), toggle defaults, remove exceptions, and edit the VAPID subject.

**Header bell** on a conversation (contacts, channels, and room servers — not the repeater dashboard). It is a simple toggle. First click with no subscription: the browser subscribes and does not invert the exception. Later clicks force that conversation ON or OFF. The bell appears only on a secure context.

## Endpoints

| Method | Endpoint | Effect |
|--------|----------|--------|
| GET | `/api/push/vapid-public-key` | Public key for `PushManager.subscribe()` |
| POST | `/api/push/subscribe` | Register or update a subscription |
| GET | `/api/push/subscriptions` | List subscriptions |
| PATCH | `/api/push/subscriptions/{id}` | Change label or language |
| DELETE | `/api/push/subscriptions/{id}` | Delete a subscription |
| POST | `/api/push/subscriptions/{id}/test` | Send a test notification |
| GET | `/api/push/preferences` | Defaults, exceptions, and VAPID subject |
| PATCH | `/api/push/preferences` | Update defaults and/or VAPID subject |
| PUT | `/api/push/preferences/conversations/{key}` | Set (`true` / `false`) or clear (`null`) an exception |

`GET` / `POST /api/push/conversations` no longer exist.

Subscriptions are unique by endpoint, so re-registering updates the existing row.

## Service worker and cleanup

`sw.js` displays incoming notifications and focuses or opens the correct conversation when one is clicked. Registration is attempted only on secure contexts. A `404` or `410` from a push service means the subscription is stale; Meshloom deletes it immediately.

## When nothing arrives

1. Check HTTPS or `localhost`.
2. Check browser and OS notification permission.
3. Send a test from **Settings → Notifications**.
4. Check defaults and exceptions via `GET /api/push/preferences`. A private-key channel stays silent without an ON exception. A muted channel stays silent even when push is enabled.
5. On Apple, check the VAPID subject in the UI (or `MESHCORE_VAPID_SUBJECT` if that field is empty) and server logs for `403 BadJwtToken`.
6. Check outbound Internet access.

`DEBUG` logs include push-service responses. See [Troubleshooting](/en/docs/deep/troubleshooting/).
