---
title: Home Assistant
description: MQTT Discovery, appareils créés, automatisations, et les sujets qui restent inconnus.
level: deep
order: 17
---

Meshloom publie les données du mesh vers Home Assistant par MQTT Discovery. Les appareils et entités apparaissent automatiquement. Il n’y a **pas** de composant personnalisé à installer, ni de dépôt HACS.

## Prérequis

- Home Assistant avec l’[intégration MQTT](https://www.home-assistant.io/integrations/mqtt/) configurée
- Un broker MQTT joignable par HA et par Meshloom, Mosquitto par exemple
- Meshloom connecté à une radio

## Mise en place

1. Dans Meshloom, aller dans **Réglages > Intégrations > Ajouter > Home Assistant MQTT Discovery**.
2. Saisir l’hôte et le port du broker, le même que celui de HA.
3. Optionnellement, identifiants et réglages TLS.
4. Sélectionner les contacts à suivre en GPS et les répéteurs à suivre en télémétrie.
5. Configurer la portée des messages qui déclenchent des événements, en bas du formulaire.
6. Enregistrer et activer.

Les appareils apparaissent dans HA sous **Paramètres > Appareils et services > MQTT** en quelques secondes.

## Comment les identifiants MeshCore deviennent des identifiants HA

Meshloom dérive un identifiant court et stable depuis la clé publique de chaque nœud :

- clé publique complète : `ae92577bae6c4f1d...`
- `node_id` : `ae92577bae6c`, soit les **12 premiers caractères hexadécimaux**, en minuscules
- sujet MQTT correspondant : `meshcore/ae92577bae6c/gps`

Ce `node_id` apparaît dans les sujets de découverte sous `homeassistant/...` et dans les sujets d’état sous votre préfixe, généralement `meshcore/...`.

Les **identifiants d’entité HA sont différents**. HA les génère depuis le nom de l’appareil et le nom de l’entité, pas depuis le `node_id`. Une radio nommée « MyRadio » produit `binary_sensor.myradio_connected` et `event.myradio_messages`. Un contact nommé « Alice » produit `device_tracker.alice`. Vos identifiants réels se lisent dans **Paramètres > Appareils et services > MQTT**, et vous pouvez les renommer dans HA sans casser l’intégration.

L’interface de l’intégration Meshloom affiche aussi ces identifiants, dans les blocs `What gets created in Home Assistant` et `Published topic summary`.

## Ce qui est créé

### Radio locale

Toujours créée. Mise à jour toutes les 60 secondes.

| Entité | Type | Description |
|--------|------|-------------|
| `binary_sensor.<radio>_connected` | Connectivité | Radio en ligne ou hors ligne |
| `sensor.<radio>_noise_floor` | Puissance de signal | Plancher de bruit en dBm |

### Répéteurs

Un appareil par répéteur suivi, sélectionné dans l’intégration HA. Mise à jour à chaque collecte de télémétrie : cycle automatique (environ 8 heures, réglable) ou récupération manuelle depuis le tableau de bord du répéteur.

**Un répéteur doit d’abord être ajouté à la liste de suivi de télémétrie automatique dans les paramètres radio de Meshloom.** Seuls les répéteurs suivis apparaissent dans le sélecteur de l’intégration HA.

| Entité | Unité | Description |
|--------|-------|-------------|
| `sensor.<répéteur>_battery_voltage` | V | Niveau de batterie |
| `sensor.<répéteur>_noise_floor` | dBm | Plancher de bruit local |
| `sensor.<répéteur>_last_rssi` | dBm | Dernière puissance reçue |
| `sensor.<répéteur>_last_snr` | dB | Dernier rapport signal/bruit |
| `sensor.<répéteur>_packets_received` | compte | Paquets reçus |
| `sensor.<répéteur>_packets_sent` | compte | Paquets envoyés |
| `sensor.<répéteur>_uptime` | s | Temps depuis le dernier redémarrage |

Si Meshloom a déjà un snapshot de télémétrie en cache pour ce répéteur, il le republie au démarrage. HA remplit les capteurs immédiatement au lieu d’attendre la prochaine collecte.

### Contacts

Un appareil HA par contact suivi, avec deux sortes d’entités possibles.

**Traceur GPS** — un `device_tracker`, alimenté par deux sources. Les **publicités** le mettent à jour passivement dès que Meshloom entend une publicité portant des coordonnées de ce contact ; aucune commande radio n’est émise, ça se greffe sur le trafic normal. La **télémétrie CayenneLPP** le met aussi à jour quand le contact rapporte une position et qu’il est suivi en collecte de télémétrie. Le GPS va toujours au traceur, jamais dans un capteur numérique.

**Capteurs CayenneLPP** — si le contact est suivi en télémétrie et rapporte des relevés LPP, un capteur numérique est créé par relevé, détecté automatiquement depuis les données.

| Entité | Description |
|--------|-------------|
| `device_tracker.<contact>` | Position GPS : attributs `latitude`, `longitude`, plus `altitude` quand un relevé en contient |
| `sensor.<contact>_lpp_<type>_ch<n>` | Relevé CayenneLPP détecté automatiquement, GPS exclu |

### Entité d’événement pour les messages

Une seule entité d’événement, rattachée à la radio : `event.<radio>_messages`. Elle se déclenche pour chaque message correspondant à la portée configurée.

| Attribut | Exemple | Description |
|----------|---------|-------------|
| `event_type` | `message_received` | Toujours `message_received` |
| `sender_name` | `Alice` | Nom affiché de l’expéditeur |
| `sender_key` | `aabbccdd...` | Clé publique de l’expéditeur |
| `text` | `hello` | Corps du message |
| `message_type` | `PRIV` ou `CHAN` | Message direct ou salon |
| `channel_name` | `#general` | Nom du salon, `null` pour un DM |
| `conversation_key` | `aabbccdd...` | Clé du contact (DM) ou du salon |
| `outgoing` | `false` | Si c’est vous qui avez envoyé |

## Ce qui apparaît quand

- Toujours : l’appareil radio locale et ses entités.
- À la sélection dans l’intégration : appareils de répéteurs suivis et traceurs de contacts suivis.
- Seulement après données : un traceur de contact a besoin d’une publicité avec GPS, ou d’un relevé GPS en télémétrie collectée. Les capteurs de répéteur ont besoin d’une télémétrie, avec rejeu du cache au démarrage quand il existe.
- L’entité d’événement de messages est créée dès que l’intégration est active sur une radio connectée.

## Quelques automatisations

### Batterie de répéteur basse

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

En interface : Paramètres > Automatisations > Créer > déclencheur d’état numérique sur le capteur, sous `3.8`, action notification.

### Radio hors ligne depuis 5 minutes

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

### Message dans un salon précis

Deux approches. La première ne demande aucun template : régler la portée des messages de l’intégration sur « Only listed channels » et sélectionner le salon. Chaque déclenchement vient alors de ce salon, et un simple déclencheur d’état sur `event.<radio>_messages` suffit.

La seconde garde la portée sur tous les messages et filtre dans l’automatisation :

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

### DM d’un contact précis

```yaml
automation:
  - alias: "DM from Alice"
    trigger:
      - platform: state
        entity_id: event.myradio_messages
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

### Suivre un contact sur la carte HA

Aucune automatisation. Une fois le contact sélectionné pour le suivi GPS, son `device_tracker` apparaît sur la carte HA dès qu’une position est publiée.

## Dépannage

**Aucun appareil n’apparaît.** Vérifier que l’intégration MQTT de HA est configurée et indique « Connecté ». Vérifier que l’intégration Meshloom affiche un point vert. Vérifier que les deux utilisent le même broker. Puis observer directement les sujets de découverte :

```text
mosquitto_sub -h <broker> -t 'homeassistant/#' -v
```

**Appareils périmés ou en double.** Par exemple une « MeshCore Radio » générique à côté de votre radio nommée. Il faut effacer les messages retenus en publiant un payload vide :

```text
mosquitto_pub -h <broker> -t 'homeassistant/binary_sensor/meshcore_unknown/connected/config' -r -n
mosquitto_pub -h <broker> -t 'homeassistant/sensor/meshcore_unknown/noise_floor/config' -r -n
```

**Capteurs de répéteur en « Unknown » ou « Unavailable ».** La télémétrie ne se met à jour qu’à la collecte. Forcer une récupération manuelle en ouvrant le tableau de bord du répéteur dans Meshloom et en cliquant « Status », ou attendre le cycle automatique. Si Meshloom a un cache, il le republie au démarrage ; si les capteurs restent inconnus, c’est généralement qu’aucune télémétrie n’a jamais été collectée pour ce répéteur.

**Traceur de contact en « Unknown ».** La position ne se met à jour que quand Meshloom entend une publicité de ce nœud contenant des coordonnées. Un nœud qui ne diffuse pas de GPS, ou qui n’a pas publié récemment, reste inconnu.

**Entité « Unavailable ».** Les entités de santé radio ont une expiration de 120 secondes. Si Meshloom cesse d’envoyer ses mises à jour — arrêt, ou perte du broker — HA les marque indisponibles au bout de deux minutes.

## Retirer l’intégration

Désactiver ou supprimer l’intégration dans Meshloom publie des messages retenus vides sur tous les sujets de découverte. HA retire les appareils et entités tout seul.

## Référence des sujets MQTT

Sujets d’état, où les données sont publiées :

| Sujet | Contenu | Fréquence |
|-------|---------|-----------|
| `meshcore/{node_id}/health` | `{"connected": bool, "noise_floor_dbm": int}` | 60 s |
| `meshcore/{node_id}/telemetry` | `{"battery_volts": float, ...}` | ~8 h ou manuel |
| `meshcore/{node_id}/gps` | `{"latitude": float, "longitude": float, ...}` | à chaque publicité |
| `meshcore/{node_id}/events/message` | `{"event_type": "message_received", ...}` | à chaque message |

Sujets de découverte, sous `homeassistant/` :

| Motif | Type d’entité |
|-------|---------------|
| `homeassistant/binary_sensor/meshcore_<node_id>/connected/config` | Connectivité radio |
| `homeassistant/sensor/meshcore_<node_id>/noise_floor/config` | Plancher de bruit |
| `homeassistant/sensor/meshcore_<node_id>/battery_voltage/config` | Batterie de répéteur |
| `homeassistant/sensor/meshcore_<node_id>/*/config` | Autres capteurs de répéteur |
| `homeassistant/device_tracker/meshcore_<node_id>/config` | Traceur GPS de contact |
| `homeassistant/event/meshcore_<node_id>/messages/config` | Entité d’événement messages |

Le `{node_id}` est toujours les 12 premiers caractères de la clé publique du nœud, en minuscules.
