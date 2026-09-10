---
title: Push notifications
description: Notifications even when the tab is closed. HTTPS required.
level: deep
order: 18
---

Web push can notify a browser about an incoming message while its tab is closed. It is separate from [fanout](/en/docs/deep/fanout/): each browser has its own endpoint and delivery state.

## Two requirements

**HTTPS.** A service worker requires a secure context. A self-signed certificate is enough; see [HTTPS](/en/docs/deep/https/).

**Outbound Internet from the server.** Push services are external: Google FCM, Mozilla autopush, or APNs. This is the only Meshloom feature that needs Internet egress.

## VAPID keys

The P-256 key pair is generated at first startup and stored in `app_settings`. The public key is exposed through `GET /api/push/vapid-public-key`.

The token subject comes from `MESHCORE_VAPID_SUBJECT`, defaulting to `mailto:noreply@meshcore.local`. APNs rejects `.local` with `403 BadJwtToken`; for Apple devices set a real address:

```text
MESHCORE_VAPID_SUBJECT=mailto:you@example.com
```

## Browser subscriptions and global conversations

A browser subscription is stored in `push_subscriptions` with its endpoint, device label, and delivery state. The conversation list is stored once in `app_settings.push_conversations`. Enabling a conversation on one phone enables it for every subscribed browser.

In a conversation header, the push bell appears on secure contexts. The first click subscribes the browser and enables the conversation; later clicks toggle it. **Settings > Local** lists devices with test and delete actions.

## Endpoints

| Method | Endpoint | Effect |
|---------|----------|-------|
| GET | `/api/push/vapid-public-key` | Public key for `PushManager.subscribe()` |
| POST | `/api/push/subscribe` | Register or update a subscription |
| GET | `/api/push/subscriptions` | List subscriptions |
| PATCH | `/api/push/subscriptions/{id}` | Change label or filters |
| DELETE | `/api/push/subscriptions/{id}` | Delete a subscription |
| POST | `/api/push/subscriptions/{id}/test` | Send a test notification |
| GET | `/api/push/conversations` | List enabled conversations |
| POST | `/api/push/conversations/toggle` | Add or remove a conversation |

Subscriptions are unique by endpoint, so re-registering updates the existing row.

## Service worker and cleanup

`sw.js` displays incoming notifications and focuses or opens the correct conversation when one is clicked. Registration is attempted only on secure contexts. A `404` or `410` from a push service means the subscription is stale; Meshloom deletes it immediately.

## When nothing arrives

1. Check HTTPS or `localhost`.
2. Check browser and OS notification permission.
3. Send a test from **Settings > Local**.
4. Check `GET /api/push/conversations`.
5. On Apple, check `MESHCORE_VAPID_SUBJECT` and server logs for `403 BadJwtToken`.
6. Check outbound Internet access.

`DEBUG` logs include push-service responses. See [Troubleshooting](/en/docs/deep/troubleshooting/).
