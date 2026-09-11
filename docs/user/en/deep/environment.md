---
title: Variables and settings
description: What lives in the environment, what lives in the database.
level: deep
order: 14
---

Meshloom has two configuration surfaces.

The **environment** covers what must be known before startup: database location, bots, authentication, and diagnostic switches. Changing it requires a restart. **Runtime settings** live in `app_settings` and are changed through the UI or `GET` / `PATCH /api/settings`. Radio transport is a runtime setting, not an environment variable. See [Radio transports](/en/docs/deep/transports/).

## Where variables go

| Installation | Location |
|--------------|----------|
| systemd package | `/etc/meshloom/meshloom.env` |
| Docker | Compose `environment:` or `.env` |
| Checkout | shell environment running `uv run uvicorn` |

## Radio connection

Radio transport is configured in the web interface and stored on `app_settings`:

| Column | Default | Description |
|--------|---------|-------------|
| `radio_transport` | *(unset / paused)* | `serial`, `tcp`, or `ble` |
| `radio_serial_port` | empty | Serial port; empty means auto-detect |
| `radio_serial_baudrate` | `115200` | Serial speed |
| `radio_tcp_host` | empty | Radio TCP host |
| `radio_tcp_port` | `5000` | TCP port |
| `radio_ble_address` | empty | Radio BLE address |
| `radio_ble_pin` | empty | BLE PIN, required with BLE |

Until `radio_transport` is set, the radio stays paused. Do not set `MESHCORE_SERIAL_PORT`, `MESHCORE_TCP_HOST`, or `MESHCORE_BLE_ADDRESS` to choose a transport.

## Server and data

| Variable | Default | Description |
|----------|---------|-------------|
| `MESHCORE_DATABASE_PATH` | `data/meshcore.db` | SQLite database path |
| `MESHCORE_LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `MESHCORE_VAPID_SUBJECT` | `mailto:noreply@meshcore.local` | VAPID token subject |

For Apple devices, `MESHCORE_VAPID_SUBJECT` must be a real `mailto:` or `https:` value. APNs rejects the `.local` default with `403 BadJwtToken`.

## Security

| Variable | Default | Description |
|----------|---------|-------------|
| `MESHCORE_DISABLE_BOTS` | `false` | Disables bots at startup |
| `MESHCORE_BASIC_AUTH_USERNAME` | *(empty)* | HTTP Basic username |
| `MESHCORE_BASIC_AUTH_PASSWORD` | *(empty)* | HTTP Basic password |
| `MESHCORE_ENABLE_LOCAL_PRIVATE_KEY_EXPORT` | `false` | Enables `GET /api/radio/private-key` |

The two Basic Auth variables must be set together. See [Security](/en/docs/deep/security/).

## Diagnostics and escape hatches

| Variable | Default | Description |
|----------|---------|-------------|
| `MESHCORE_ENABLE_MESSAGE_POLL_FALLBACK` | `false` | Changes the hourly radio audit to `get_msg()` polling every 10 seconds |
| `MESHCORE_FORCE_CHANNEL_SLOT_RECONFIGURE` | `false` | Forces `set_channel(...)` before every channel send |
| `MESHCORE_LOAD_WITH_AUTOEVICT` | `false` | Lets the radio evict old contacts while loading |
| `MESHCORE_SKIP_POST_CONNECT_SYNC` | `false` | Skips contact/channel sync, startup advert, and periodic loops |
| `__CLOWNTOWN_DO_CLOCK_WRAPAROUND` | `false` | Experimental 32-bit clock wraparound |

The message poll task always exists; the fallback variable changes its frequency. Force slot reconfiguration adds about 500 ms to channel sends. Skip-post-connect is for diagnostics: handlers, key export, clock sync, and automatic message fetching still run.

## Runtime settings in the database

These live in `app_settings` and are controlled through the UI or `PATCH /api/settings`:

- `radio_transport`, `radio_serial_port`, `radio_serial_baudrate`, `radio_tcp_host`, `radio_tcp_port`, `radio_ble_address`, `radio_ble_pin`
- `max_radio_contacts`
- `auto_decrypt_dm_on_advert`
- `advert_interval`, `last_advert_time`
- `flood_scope`, `known_regions`
- `blocked_keys`, `blocked_names`, `discovery_blocked_types`
- `tracked_telemetry_repeaters`, `tracked_telemetry_contacts`, `telemetry_interval_hours`
- `auto_resend_channel`
- `last_message_times`
- `push_conversations`, `vapid_private_key`, `vapid_public_key`

MQTT, bots, webhooks, Apprise, and SQS live in `fanout_configs`, not `app_settings`. See [Fanout](/en/docs/deep/fanout/) and [Radio, contacts, and channels](/en/docs/deep/radio/).
