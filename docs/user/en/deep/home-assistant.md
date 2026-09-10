---
title: Home Assistant
description: MQTT Discovery, devices, automations, and the topics that break.
level: deep
order: 17
---

Meshloom publishes mesh data to Home Assistant through MQTT Discovery. Devices and entities appear automatically. No custom component or HACS repository is required.

## Requirements

- Home Assistant with the [MQTT integration](https://www.home-assistant.io/integrations/mqtt/) configured
- An MQTT broker reachable by both HA and Meshloom
- Meshloom connected to a radio

## Setup

1. In Meshloom, open **Settings > Integrations > Add > Home Assistant MQTT Discovery**.
2. Enter the broker host and port.
3. Add credentials and TLS settings if needed.
4. Select contacts for GPS tracking and repeaters for telemetry.
5. Set the message event scope.
6. Save and enable.

Devices appear under **Settings > Devices & services > MQTT**.

## MeshCore IDs and HA IDs

Meshloom uses the first 12 lowercase hexadecimal characters of a public key:

- public key: `ae92577bae6c4f1d...`
- `node_id`: `ae92577bae6c`
- state topic: `meshcore/ae92577bae6c/gps`

HA entity IDs are generated from device and entity names, not `node_id`. The integration UI shows them under `What gets created in Home Assistant` and `Published topic summary`.

## What gets created in Home Assistant

### Local radio

| Entity | Type | Description |
|--------|------|-------------|
| `binary_sensor.<radio>_connected` | Connectivity | Radio online/offline |
| `sensor.<radio>_noise_floor` | Signal strength | Noise floor in dBm |

### Repeaters

One device per selected repeater, updated by automatic telemetry (about every 8 hours) or manual dashboard fetch:

| Entity | Unit | Description |
|--------|------|-------------|
| `sensor.<repeater>_battery_voltage` | V | Battery level |
| `sensor.<repeater>_noise_floor` | dBm | Local noise floor |
| `sensor.<repeater>_last_rssi` | dBm | Last received power |
| `sensor.<repeater>_last_snr` | dB | Last signal-to-noise ratio |
| `sensor.<repeater>_packets_received` | count | Received packets |
| `sensor.<repeater>_packets_sent` | count | Sent packets |
| `sensor.<repeater>_uptime` | s | Time since reboot |

### Contacts

| Entity | Description |
|--------|-------------|
| `device_tracker.<contact>` | GPS position, with `latitude`, `longitude`, and optional `altitude` |
| `sensor.<contact>_lpp_<type>_ch<n>` | Automatically detected CayenneLPP reading |

### Message event entity

`event.<radio>_messages` fires for each message allowed by the configured scope.

| Attribute | Example | Description |
|----------|---------|-------------|
| `event_type` | `message_received` | Always `message_received` |
| `sender_name` | `Alice` | Display name |
| `sender_key` | `aabbccdd...` | Sender public key |
| `text` | `hello` | Message body |
| `message_type` | `PRIV` or `CHAN` | DM or channel |
| `channel_name` | `#general` | Channel name, or `null` for DM |
| `conversation_key` | `aabbccdd...` | Contact or channel key |
| `outgoing` | `false` | Whether you sent it |

## Representative automations

### Low repeater battery

```yaml
automation:
  - alias: "Repeater battery low"
    trigger:
      - platform: numeric_state
        entity_id: sensor.hilltop_battery_voltage
        below: 3.8
    action:
      - service: notify.mobile_app_your_phone
        data:
          title: "Repeater Battery Low"
          message: >-
            {{ state_attr('sensor.hilltop_battery_voltage', 'friendly_name') }}
            is at {{ states('sensor.hilltop_battery_voltage') }}V
```

### Radio offline for five minutes

```yaml
automation:
  - alias: "Radio offline"
    trigger:
      - platform: state
        entity_id: binary_sensor.myradio_connected
        to: "off"
        for: "00:05:00"
    action:
      - service: notify.mobile_app_your_phone
        data:
          title: "MeshCore Radio Offline"
          message: "Radio has been disconnected for 5 minutes"
```

### Message in a specific channel

Set scope to **Only listed channels** and select the channel, or filter all events:

```yaml
automation:
  - alias: "Emergency channel alert"
    trigger:
      - platform: state
        entity_id: event.myradio_messages
    condition:
      - condition: template
        value_template: >-
          {{ trigger.to_state.attributes.channel_name == '#emergency' }}
    action:
      - service: notify.mobile_app_your_phone
        data:
          title: "Message in #emergency"
          message: >-
            {{ trigger.to_state.attributes.sender_name }}:
            {{ trigger.to_state.attributes.text }}
```

## Troubleshooting

If no device appears, check that HA MQTT is connected, Meshloom shows a green status, and both use the same broker. Inspect discovery:

```text
mosquitto_sub -h <broker> -t 'homeassistant/#' -v
```

Stale or duplicate devices can be removed with retained empty payloads:

```text
mosquitto_pub -h <broker> -t 'homeassistant/binary_sensor/meshcore_unknown/connected/config' -r -n
mosquitto_pub -h <broker> -t 'homeassistant/sensor/meshcore_unknown/noise_floor/config' -r -n
```

Telemetry entities remain `Unknown` until telemetry is collected. Contact trackers remain unknown until a GPS advert or telemetry report arrives. Health entities expire after 120 seconds. Disabling or deleting the integration publishes empty retained discovery messages so HA removes its entities.

## MQTT topic reference

| Topic | Content | Frequency |
|-------|---------|-----------|
| `meshcore/{node_id}/health` | `{"connected": bool, "noise_floor_dbm": int}` | 60 s |
| `meshcore/{node_id}/telemetry` | `{"battery_volts": float, ...}` | ~8 h or manual |
| `meshcore/{node_id}/gps` | `{"latitude": float, "longitude": float, ...}` | each advert |
| `meshcore/{node_id}/events/message` | `{"event_type": "message_received", ...}` | each message |

Discovery topics:

| Pattern | Entity type |
|---------|-------------|
| `homeassistant/binary_sensor/meshcore_<node_id>/connected/config` | Radio connectivity |
| `homeassistant/sensor/meshcore_<node_id>/noise_floor/config` | Noise floor |
| `homeassistant/sensor/meshcore_<node_id>/battery_voltage/config` | Repeater battery |
| `homeassistant/sensor/meshcore_<node_id>/*/config` | Other repeater sensors |
| `homeassistant/device_tracker/meshcore_<node_id>/config` | Contact GPS tracker |
| `homeassistant/event/meshcore_<node_id>/messages/config` | Message event entity |
