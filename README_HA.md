# Home Assistant Integration

RemoteTerm can publish mesh network data to Home Assistant via MQTT Discovery. Devices and entities appear automatically in HA -- no custom component or HACS install needed.

## Prerequisites

- Home Assistant with the [MQTT integration](https://www.home-assistant.io/integrations/mqtt/) configured
- An MQTT broker (e.g. Mosquitto) accessible to both HA and RemoteTerm
- RemoteTerm running and connected to a radio

## Setup

1. In RemoteTerm, go to **Settings > Integrations > Add > Home Assistant MQTT Discovery**
2. Enter your MQTT broker host and port (same broker HA is connected to)
3. Optionally enter broker username/password and TLS settings
4. Select contacts for GPS tracking and repeaters for telemetry (see below)
5. Configure which messages should fire events (scope selector at the bottom)
6. Save and enable

Devices will appear in HA under **Settings > Devices & Services > MQTT** within a few seconds.

## What Gets Created

### Local Radio Device

Always created. Updates every 60 seconds.

| Entity | Type | Description |
|--------|------|-------------|
| `binary_sensor.meshcore_*_connected` | Connectivity | Radio online/offline |
| `sensor.meshcore_*_noise_floor` | Signal strength | Radio noise floor (dBm) |

### Repeater Devices

One device per tracked repeater (must have repeater opted). Updates when telemetry is collected (auto-collect cycle (~8 hours), or when you manually fetch from the repeater dashboard).

Repeaters must first be added to the auto-telemetry tracking list in RemoteTerm's Radio settings section. Only auto-tracked repeaters appear in the HA integration's repeater picker.

| Entity | Type | Unit | Description |
|--------|------|------|-------------|
| `sensor.meshcore_*_battery_voltage` | Voltage | V | Battery level |
| `sensor.meshcore_*_noise_floor` | Signal strength | dBm | Local noise floor |
| `sensor.meshcore_*_last_rssi` | Signal strength | dBm | Last received signal strength |
| `sensor.meshcore_*_last_snr` | -- | dB | Last signal-to-noise ratio |
| `sensor.meshcore_*_packets_received` | -- | count | Total packets received |
| `sensor.meshcore_*_packets_sent` | -- | count | Total packets sent |
| `sensor.meshcore_*_uptime` | Duration | s | Uptime since last reboot |

### Contact Device Trackers

One `device_tracker` per tracked contact. Updates passively whenever RemoteTerm hears an advertisement with GPS coordinates from that contact. No radio commands are sent -- it piggybacks on normal mesh traffic.

| Entity | Description |
|--------|-------------|
| `device_tracker.meshcore_*` | GPS position (latitude/longitude) |

### Message Event Entity

A single `event.meshcore_messages` entity that fires for each message matching your configured scope. Each event carries these attributes:

| Attribute | Example | Description |
|-----------|---------|-------------|
| `event_type` | `message_received` | Always `message_received` |
| `sender_name` | `Alice` | Display name of the sender |
| `sender_key` | `aabbccdd...` | Sender's public key |
| `text` | `hello` | Message body |
| `message_type` | `PRIV` or `CHAN` | Direct message or channel |
| `channel_name` | `#general` | Channel name (null for DMs) |
| `conversation_key` | `aabbccdd...` | Contact key (DM) or channel key |
| `outgoing` | `false` | Whether you sent this message |

## Entity Naming

Entity IDs use the first 12 characters of the node's public key as an identifier. For example, a contact with public key `ae92577bae6c...` gets entity ID `device_tracker.meshcore_ae92577bae6c`. You can rename entities in HA's UI without affecting the integration.

## Common Automations

### Low repeater battery alert

Notify when a tracked repeater's battery drops below a threshold.

**GUI:** Settings > Automations > Create > Numeric state trigger on `sensor.meshcore_*_battery_voltage`, below `3.8`, action: notification.

**YAML:**
```yaml
automation:
  - alias: "Repeater battery low"
    trigger:
      - platform: numeric_state
        entity_id: sensor.meshcore_aabbccddeeff_battery_voltage
        below: 3.8
    action:
      - service: notify.mobile_app_your_phone
        data:
          title: "Repeater Battery Low"
          message: >-
            {{ state_attr('sensor.meshcore_aabbccddeeff_battery_voltage', 'friendly_name') }}
            is at {{ states('sensor.meshcore_aabbccddeeff_battery_voltage') }}V
```

### Radio offline alert

Notify if the radio has been disconnected for more than 5 minutes.

**GUI:** Settings > Automations > Create > State trigger on `binary_sensor.meshcore_*_connected`, to `off`, for `00:05:00`, action: notification.

**YAML:**
```yaml
automation:
  - alias: "Radio offline"
    trigger:
      - platform: state
        entity_id: binary_sensor.meshcore_aabbccddeeff_connected
        to: "off"
        for: "00:05:00"
    action:
      - service: notify.mobile_app_your_phone
        data:
          title: "MeshCore Radio Offline"
          message: "Radio has been disconnected for 5 minutes"
```

### Alert on any message from a specific room

Trigger when a message arrives in a specific channel. Two approaches:

#### Option A: Scope filtering (fully GUI, no template)

If you only care about one room, configure the HA integration's message scope to "Only listed channels" and select that room. Then every event fire is from that room.

**GUI:** Settings > Automations > Create > State trigger on `event.meshcore_messages`, action: notification.

**YAML:**
```yaml
automation:
  - alias: "Emergency channel alert"
    trigger:
      - platform: state
        entity_id: event.meshcore_messages
    action:
      - service: notify.mobile_app_your_phone
        data:
          title: "Message in #emergency"
          message: >-
            {{ trigger.to_state.attributes.sender_name }}:
            {{ trigger.to_state.attributes.text }}
```

#### Option B: Template condition (multiple rooms, one integration)

Keep scope as "All messages" and filter in the automation. The trigger is GUI, but the condition uses a one-line template.

**GUI:** Settings > Automations > Create > State trigger on `event.meshcore_messages` > Add condition > Template > enter the template below.

**YAML:**
```yaml
automation:
  - alias: "Emergency channel alert"
    trigger:
      - platform: state
        entity_id: event.meshcore_messages
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

### Alert on DM from a specific contact

**YAML:**
```yaml
automation:
  - alias: "DM from Alice"
    trigger:
      - platform: state
        entity_id: event.meshcore_messages
    condition:
      - condition: template
        value_template: >-
          {{ trigger.to_state.attributes.message_type == 'PRIV'
             and trigger.to_state.attributes.sender_name == 'Alice' }}
    action:
      - service: notify.mobile_app_your_phone
        data:
          title: "DM from Alice"
          message: "{{ trigger.to_state.attributes.text }}"
```

### Alert on messages containing a keyword

**YAML:**
```yaml
automation:
  - alias: "Keyword alert"
    trigger:
      - platform: state
        entity_id: event.meshcore_messages
    condition:
      - condition: template
        value_template: >-
          {{ 'emergency' in trigger.to_state.attributes.text | lower }}
    action:
      - service: notify.mobile_app_your_phone
        data:
          title: "Emergency keyword detected"
          message: >-
            {{ trigger.to_state.attributes.sender_name }} in
            {{ trigger.to_state.attributes.channel_name or 'DM' }}:
            {{ trigger.to_state.attributes.text }}
```

### Track a contact on the HA map

No automation needed. Once a contact is selected for GPS tracking, their `device_tracker` entity automatically appears on the HA map. Go to **Settings > Dashboards > Map** (or add a Map card to any dashboard) and the tracked contact will show up when they advertise their GPS position.

### Dashboard card showing repeater battery

Add a sensor card to any dashboard:

```yaml
type: sensor
entity: sensor.meshcore_aabbccddeeff_battery_voltage
name: "Hilltop Repeater Battery"
```

Or an entities card for multiple repeaters:

```yaml
type: entities
title: "Repeater Status"
entities:
  - entity: sensor.meshcore_aabbccddeeff_battery_voltage
    name: "Hilltop"
  - entity: sensor.meshcore_ccdd11223344_battery_voltage
    name: "Valley"
  - entity: sensor.meshcore_eeff55667788_battery_voltage
    name: "Ridge"
```

## Troubleshooting

### Devices don't appear in HA

- Verify the MQTT integration is configured in HA (**Settings > Devices & Services > MQTT**) and shows "Connected"
- Verify RemoteTerm's HA integration shows "Connected" (green dot)
- Check that both HA and RemoteTerm are using the same MQTT broker
- Subscribe to discovery topics to verify messages are flowing:
  ```
  mosquitto_sub -h <broker> -t 'homeassistant/#' -v
  ```

### Stale or duplicate devices

If you see unexpected devices (e.g. a generic "MeshCore Radio" alongside your named radio), clear the stale retained messages:
```
mosquitto_pub -h <broker> -t 'homeassistant/binary_sensor/meshcore_unknown/connected/config' -r -n
mosquitto_pub -h <broker> -t 'homeassistant/sensor/meshcore_unknown/noise_floor/config' -r -n
```

### Repeater sensors show "Unknown" or "Unavailable"

Repeater telemetry only updates when collected. Trigger a manual fetch by opening the repeater's dashboard in RemoteTerm and clicking "Status", or wait for the next auto-collect cycle (~8 hours). Sensors show "Unknown" until the first telemetry reading arrives.

### Contact device tracker shows "Unknown"

The contact's GPS position only updates when RemoteTerm hears an advertisement from that node that includes GPS coordinates. If the contact's device doesn't broadcast GPS or hasn't advertised recently, the tracker will show as unknown.

### Entity is "Unavailable"

Radio health entities have a 120-second expiry. If RemoteTerm stops sending health updates (e.g. it's shut down or loses connection to the broker), HA marks the entities as unavailable after 2 minutes. Restart RemoteTerm or check the broker connection.

## Removing the Integration

Disabling or deleting the HA integration in RemoteTerm's settings publishes empty retained messages to all discovery topics, which removes the devices and entities from HA automatically.

## MQTT Topics Reference

State topics (where data is published):

| Topic | Content | Update frequency |
|-------|---------|-----------------|
| `meshcore/{node_id}/health` | `{"connected": bool, "noise_floor_dbm": int}` | Every 60s |
| `meshcore/{node_id}/telemetry` | `{"battery_volts": float, ...}` | ~8h or manual |
| `meshcore/{node_id}/gps` | `{"latitude": float, "longitude": float, ...}` | On advert |
| `meshcore/events/message` | `{"event_type": "message_received", ...}` | On message |

Discovery topics (entity registration, under `homeassistant/`):

| Pattern | Entity type |
|---------|------------|
| `homeassistant/binary_sensor/meshcore_*/connected/config` | Radio connectivity |
| `homeassistant/sensor/meshcore_*/noise_floor/config` | Noise floor sensor |
| `homeassistant/sensor/meshcore_*/battery_voltage/config` | Repeater battery |
| `homeassistant/sensor/meshcore_*/*/config` | Other repeater sensors |
| `homeassistant/device_tracker/meshcore_*/config` | Contact GPS tracker |
| `homeassistant/event/meshcore_messages/config` | Message event entity |

The `{node_id}` is always the first 12 characters of the node's public key, lowercased.
