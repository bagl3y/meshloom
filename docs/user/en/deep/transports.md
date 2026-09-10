---
title: Radio transports
description: USB serial, TCP, or Bluetooth — only one at a time.
level: deep
order: 11
---

Meshloom talks to one radio through one transport at a time: serial (USB), TCP, or BLE. Select it with environment variables, not in the UI.

## One transport variable

| Variable | Default | Role |
|----------|---------|------|
| `MESHCORE_SERIAL_PORT` | auto-detect | Radio serial port |
| `MESHCORE_SERIAL_BAUDRATE` | `115200` | Serial speed |
| `MESHCORE_TCP_HOST` | *(empty)* | Radio TCP host |
| `MESHCORE_TCP_PORT` | `5000` | TCP port |
| `MESHCORE_BLE_ADDRESS` | *(empty)* | Radio BLE address |
| `MESHCORE_BLE_PIN` | *(empty)* | BLE PIN, required with `MESHCORE_BLE_ADDRESS` |

Only one of `MESHCORE_SERIAL_PORT`, `MESHCORE_TCP_HOST`, and `MESHCORE_BLE_ADDRESS` may be set. Two means startup fails with `Only one transport may be configured at a time.` With none set, Meshloom auto-detects a serial radio. BLE without `MESHCORE_BLE_PIN` also fails: `MESHCORE_BLE_PIN is required when MESHCORE_BLE_ADDRESS is set.`

## Serial (USB)

For the usual setup, the radio is plugged into the machine running Meshloom. To force a port:

```bash
MESHCORE_SERIAL_PORT=/dev/ttyUSB0 uv run uvicorn app.main:app --reload
```

On Windows PowerShell:

```powershell
uv sync
$env:MESHCORE_SERIAL_PORT="COM8"
uv run uvicorn app.main:app --reload
```

Serial ports are exclusive. Another MeshCore client, serial console, or Meshloom instance causes repeated connection failures. Meshloom groups repeated `Serial Connection started` lines from `meshcore` and logs a `WARNING` about possible port contention.

In Docker, use a stable device path:

```yaml
devices:
  - /dev/serial/by-id/your-meshcore-radio:/dev/meshcore-radio
environment:
  MESHCORE_SERIAL_PORT: /dev/meshcore-radio
```

If a `by-id` path contains `:`, use a host-side alias without the colon.

## TCP

Use TCP when the radio is reachable over the network. To flash USB companion, repeater, or room-server firmware from the browser, see the [flasher](/en/flasher/).

```yaml
environment:
  MESHCORE_TCP_HOST: 192.168.1.100
  MESHCORE_TCP_PORT: 5000
```

Meshloom does not assume exclusive device access over TCP. It therefore calls `set_channel(...)` before every channel send instead of reusing its local slot cache. See [Radio, contacts, and channels](/en/docs/deep/radio/).

## BLE

`MESHCORE_BLE_ADDRESS` and `MESHCORE_BLE_PIN` are both required. BLE in Docker usually needs manual Compose changes: Bluetooth passthrough, privileged mode, host networking, or host-specific adjustments. With many contacts, initial radio-table enumeration can time out; Meshloom still loads favorites and recent contacts as best it can. `MESHCORE_LOAD_WITH_AUTOEVICT=true` is available for this case.

## What the installer offers

The Linux one-liner offers automatic USB detection, a manually entered USB path, TCP, or BLE. The selected transport is written to `/etc/meshloom/meshloom.env`; running the installer again changes it without reinstalling. See [Other install paths](/en/docs/deep/install-paths/).

## Reconnection

After connecting, a monitor checks the link every five seconds and reconnects automatically. `POST /api/radio/reconnect` forces a try; `POST /api/radio/disconnect` closes the link and pauses automatic attempts.

Reconnect runs post-connect setup again: event handlers, in-memory private-key export, clock sync, and contact/channel sync. The sequence is time-bounded. A timeout logs an error and asks you to restart the radio and server. A hard setup failure is retried every five seconds indefinitely.
