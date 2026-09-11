---
title: Transports radio
description: USB série, TCP, ou Bluetooth — configurés dans l’interface.
level: deep
order: 11
---

Meshloom parle à la radio par un seul canal à la fois. C’est ce qu’on appelle le transport. Trois sont possibles : série (USB), TCP, et BLE (Bluetooth Low Energy). Le choix se fait dans l’interface web. Il est stocké dans `app_settings`, pas dans des variables d’environnement.

Tant qu’aucun transport n’est défini, la radio reste en pause.

## Colonnes de réglage

| Colonne | Défaut | Rôle |
|---------|--------|------|
| `radio_transport` | *(non défini / en pause)* | `serial`, `tcp` ou `ble` |
| `radio_serial_port` | vide | Port série ; vide = auto-détection |
| `radio_serial_baudrate` | `115200` | Débit série |
| `radio_tcp_host` | vide | Hôte TCP de la radio |
| `radio_tcp_port` | `5000` | Port TCP |
| `radio_ble_address` | vide | Adresse BLE de la radio |
| `radio_ble_pin` | vide | Code PIN BLE, obligatoire avec BLE |

Ne définissez pas `MESHCORE_SERIAL_PORT`, `MESHCORE_TCP_HOST` ni `MESHCORE_BLE_ADDRESS` pour choisir un transport.

## Série (USB)

Le cas normal. La radio est branchée sur la machine qui fait tourner Meshloom. Choisissez le série dans l’interface et laissez le port vide pour l’auto-détection, ou saisissez un chemin comme `/dev/ttyUSB0` ou `COM8`.

Le port série n’est pas partageable. Un seul processus le tient. Si un autre client MeshCore, une console série ou une deuxième instance de Meshloom est déjà dessus, la connexion échoue en boucle. Le serveur détecte ce cas particulier : les lignes répétées `Serial Connection started` de la bibliothèque `meshcore` sont regroupées et remontées en `WARNING` avec la mention d’une possible contention du port par un autre processus. Si vous voyez ça, cherchez qui d’autre tient la radio.

En Docker, mappez le périphérique pour que le conteneur le voie. Le transport lui-même se choisit toujours dans l’interface :

```yaml
devices:
  - /dev/serial/by-id/your-meshcore-radio:/dev/meshcore-radio
```

Un chemin `by-id` contenant des `:` ne peut pas être écrit tel quel dans Compose. Dans ce cas, passez par un alias sans `:` côté hôte.

## TCP

La radio est joignable sur le réseau, par exemple un nœud exposé par une passerelle ou un firmware compagnon en TCP. Choisissez TCP dans l’interface et saisissez l’hôte et le port. Pour poser un firmware companion USB, répéteur ou room server depuis le navigateur, voir le [flasher](/flasher/).

Le TCP a une conséquence concrète sur les envois de salon. Meshloom ne suppose pas avoir l’accès exclusif au périphérique sur ce transport, donc il ne réutilise pas le cache local de slots de salon : chaque envoi de salon repasse par `set_channel(...)` avant émission. C’est plus lent qu’en série ou en BLE, et c’est voulu. Voir [Radio, contacts et salons](/docs/deep/radio/).

## BLE

Le transport le plus capricieux des trois. L’interface exige une adresse et un PIN.

Deux points à connaître avant de s’engager :

- En Docker, BLE demande presque toujours des modifications manuelles du Compose : passthrough du périphérique Bluetooth, mode privilégié, réseau hôte, ou d’autres ajustements propres à l’hôte.
- Sur une liaison BLE avec beaucoup de contacts, l’énumération initiale de la table de contacts de la radio peut expirer. Meshloom tente quand même de charger favoris et contacts récents, au mieux, mais sans photo complète de ce qui est déjà sur la radio certains ajouts seront redondants ou échoueront. `MESHCORE_LOAD_WITH_AUTOEVICT=true` existe pour ce cas précis, décrit dans [Radio, contacts et salons](/docs/deep/radio/).

## Ce que propose l’installeur

Le one-liner Linux n’écrit plus le transport dans les fichiers d’environnement systemd ou Compose. L’installation systemd native configure la radio dans l’interface après le démarrage. Docker peut encore demander USB ou réseau, uniquement pour émettre un mapping `devices:` Compose pour l’USB. Détails dans [Autres chemins d’installation](/docs/deep/install-paths/).

## Reconnexion

Une fois connecté, un moniteur vérifie l’état de la liaison toutes les cinq secondes et tente de reconnecter tout seul. Deux endpoints existent pour la main humaine :

- `POST /api/radio/reconnect` force une tentative de reconnexion.
- `POST /api/radio/disconnect` coupe la liaison et met en pause les tentatives automatiques.

Après une reconnexion, Meshloom rejoue sa séquence d’installation post-connexion : enregistrement des gestionnaires d’événements, export de la clé privée en mémoire, synchronisation d’horloge, synchronisation contacts et salons. Cette séquence est bornée par un délai. Si elle traîne trop, le backend journalise l’échec et pousse un message dans l’interface demandant de redémarrer la radio puis le serveur.

Si la séquence échoue franchement, le moniteur la retente toutes les cinq secondes, indéfiniment. C’est délibéré : la radio peut être en train de redémarrer ou de sortir de veille, et l’installation se terminera d’elle-même quand elle répondra.
