---
title: Radio transports
description: USB serial, TCP, or Bluetooth — configured in the web UI.
level: deep
order: 11
---

Meshloom talks to one radio through one transport at a time: serial (USB), TCP, or BLE. Choose it in the web interface. The choice is stored on `app_settings`, not in environment variables.

Until a transport is set, the radio stays paused.

## Settings columns

| Column | Default | Role |
|--------|---------|------|
| `radio_transport` | *(unset / paused)* | `serial`, `tcp`, or `ble` |
| `radio_serial_port` | empty | Serial port; empty means auto-detect |
| `radio_serial_baudrate` | `115200` | Serial speed |
| `radio_tcp_host` | empty | Radio TCP host |
| `radio_tcp_port` | `5000` | TCP port |
| `radio_ble_address` | empty | Radio BLE address |
| `radio_ble_pin` | empty | BLE PIN, required with BLE |

Do not set `MESHCORE_SERIAL_PORT`, `MESHCORE_TCP_HOST`, or `MESHCORE_BLE_ADDRESS` to pick a transport.

## Serial (USB)

For the usual setup, the radio is plugged into the machine running Meshloom. Choose serial in the UI and leave the port empty for auto-detect, or enter a path such as `/dev/ttyUSB0` or `COM8`.

Serial ports are exclusive. Another MeshCore client, serial console, or Meshloom instance causes repeated connection failures. Meshloom groups repeated `Serial Connection started` lines from `meshcore` and logs a `WARNING` about possible port contention.

In Docker, map the device so the container can see it. Transport itself is still chosen in the UI:

```yaml
devices:
  - /dev/serial/by-id/your-meshcore-radio:/dev/meshcore-radio
```

If a `by-id` path contains `:`, use a host-side alias without the colon.

## TCP

Use TCP when the radio is reachable over the network. Choose TCP in the UI and enter the host and port. To flash USB companion, repeater, or room-server firmware from the browser, see the [flasher](/en/flasher/).

Meshloom does not assume exclusive device access over TCP. It therefore calls `set_channel(...)` before every channel send instead of reusing its local slot cache. See [Radio, contacts, and channels](/en/docs/deep/radio/).

## BLE

BLE needs both an address and a PIN in the UI. BLE in Docker usually needs manual Compose changes: Bluetooth passthrough, privileged mode, host networking, or host-specific adjustments. With many contacts, initial radio-table enumeration can time out; Meshloom still loads favorites and recent contacts as best it can. `MESHCORE_LOAD_WITH_AUTOEVICT=true` is available for this case.

## What the installer offers

The Linux one-liner does not write transport into systemd or Compose environment files. Native systemd installs configure the radio in the web UI after startup. Docker may still ask USB versus network, only to emit a Compose `devices:` mapping for USB. See [Other install paths](/en/docs/deep/install-paths/).

## Reconnection

After connecting, a monitor checks the link every five seconds and reconnects automatically. `POST /api/radio/reconnect` forces a try; `POST /api/radio/disconnect` closes the link and pauses automatic attempts.

Reconnect runs post-connect setup again: event handlers, in-memory private-key export, clock sync, and contact/channel sync. The sequence is time-bounded. A timeout logs an error and asks you to restart the radio and server. A hard setup failure is retried every five seconds indefinitely.
