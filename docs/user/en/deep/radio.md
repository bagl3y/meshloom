---
title: Radio, contacts, and channels
description: What Meshloom loads onto the radio, flood scope, and hop width.
level: deep
order: 15
---

Meshloom manages the radio’s contacts and channels. The server keeps more state than the radio can hold and loads a working set onto the node.

## Why load contacts

The radio can automatically ACK incoming direct messages when the sender is in its contact table. Meshloom enumerates the table, loads favorites first, targets about 80% of `max_radio_contacts`, and performs a full offload/reload around 95% occupancy.

## When the table is full

BLE enumeration can time out, and adverts or another client can fill the table. You can empty it with another MeshCore client, lower the target, enable autoevict, or ignore the warning. **Messaging is not affected; automatic ACKs may be.**

`MESHCORE_LOAD_WITH_AUTOEVICT=true` enables `AUTO_ADD_OVERWRITE_OLDEST`, skips removal during reconciliation, and permits blind loading when enumeration fails. Loaded contacts are not marked as radio favorites and can later be evicted.

## Channels and slots

The slot count comes from `DEVICE_INFO.max_channels`. Startup clears radio channel slots, then sends use a local LRU cache. TCP always calls `set_channel(...)`; `MESHCORE_FORCE_CHANNEL_SLOT_RECONFIGURE=true` disables reuse on every transport and adds about 500 ms per send.

## The hourly audit

By default Meshloom audits once an hour for messages left on the radio and mismatches between its channel-slot cache and the radio. A mismatch produces an error and resets the send cache. `MESHCORE_ENABLE_MESSAGE_POLL_FALLBACK=true` changes the audit to every 10 seconds.

## Hop width: `path_hash_mode`

| Value | Width per hop |
|--------|---------------|
| `0` | 1 byte |
| `1` | 2 bytes |
| `2` | 3 bytes |

`GET /api/radio/config` exposes the current mode and `path_hash_mode_supported`; `PATCH /api/radio/config` changes it only when supported. `path_len` is always a hop count, never a byte count. A channel can define `path_hash_mode_override`, applied only for that send.

## Regional flood scope

`flood_scope` is the global database setting. `flood_scope_override` temporarily changes it for one channel send. Incoming scoped packets carry a keyed transport MAC, not a stable region ID. Meshloom tests candidates in `known_regions`; an unknown candidate remains scoped but unnamed. `POST /api/radio/discover-regions` discovers flood-allowed region names from nearby repeaters.

## Direct-message routing

Priority is:

1. explicit `route_override_*`
2. learned direct route
3. flood

Learned routes come from radio contact sync and path discovery. Advert paths are informational only; ACKs describe delivery, not topology. A DM sends immediately, then may retry twice when an ACK code is expected, using the radio’s `suggested_timeout`. The final retry uses flood even with an override.

## Adverts and private key

`advert_interval` is in seconds; `0` disables periodic adverts. Manual adverts use `POST /api/radio/advertise` with `mode` `flood` or `zero_hop`. Location is deliberately only off or “include node location”.

At connection, Meshloom exports the radio private key into memory only. It never writes it to disk. This enables server-side DM decryption and historical recovery. API export is disabled by default; see [Security](/en/docs/deep/security/).
