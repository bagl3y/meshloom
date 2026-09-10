---
title: Transports radio
description: USB série, TCP, ou Bluetooth — un seul à la fois, et le serveur refuse de démarrer sinon.
level: deep
order: 11
---

Meshloom parle à la radio par un seul canal à la fois. C’est ce qu’on appelle le transport. Trois sont possibles : série (USB), TCP, et BLE (Bluetooth Low Energy). Le choix se fait par variable d’environnement, jamais dans l’interface.

## Une seule variable de transport

| Variable | Défaut | Rôle |
|----------|--------|------|
| `MESHCORE_SERIAL_PORT` | auto-détection | Port série de la radio |
| `MESHCORE_SERIAL_BAUDRATE` | `115200` | Débit série |
| `MESHCORE_TCP_HOST` | *(vide)* | Hôte TCP de la radio |
| `MESHCORE_TCP_PORT` | `5000` | Port TCP, avec `MESHCORE_TCP_HOST` |
| `MESHCORE_BLE_ADDRESS` | *(vide)* | Adresse BLE de la radio |
| `MESHCORE_BLE_PIN` | *(vide)* | Code PIN BLE, obligatoire avec `MESHCORE_BLE_ADDRESS` |

Une seule de `MESHCORE_SERIAL_PORT`, `MESHCORE_TCP_HOST` et `MESHCORE_BLE_ADDRESS` peut être définie. Deux d’un coup et le serveur refuse de démarrer, avec un message explicite : `Only one transport may be configured at a time.` Ce n’est pas un avertissement, c’est une erreur de validation de la configuration.

Si aucune des trois n’est définie, Meshloom part en auto-détection série. C’est le comportement par défaut et c’est celui qui marche quand la radio est le seul périphérique série de la machine.

`MESHCORE_BLE_ADDRESS` sans `MESHCORE_BLE_PIN` est également une erreur au démarrage : `MESHCORE_BLE_PIN is required when MESHCORE_BLE_ADDRESS is set.`

## Série (USB)

Le cas normal. La radio est branchée sur la machine qui fait tourner Meshloom.

Depuis un checkout, sans rien préciser, l’auto-détection suffit le plus souvent. Pour forcer un port :

```bash
MESHCORE_SERIAL_PORT=/dev/ttyUSB0 uv run uvicorn app.main:app --reload
```

Sous Windows, en PowerShell :

```powershell
uv sync
$env:MESHCORE_SERIAL_PORT="COM8"
uv run uvicorn app.main:app --reload
```

Le port série n’est pas partageable. Un seul processus le tient. Si un autre client MeshCore, une console série ou une deuxième instance de Meshloom est déjà dessus, la connexion échoue en boucle. Le serveur détecte ce cas particulier : les lignes répétées `Serial Connection started` de la bibliothèque `meshcore` sont regroupées et remontées en `WARNING` avec la mention d’une possible contention du port par un autre processus. Si vous voyez ça, cherchez qui d’autre tient la radio.

En Docker, la bonne pratique est de mapper le périphérique par identifiant stable plutôt que par `/dev/ttyUSB0`, qui bouge d’un rebranchement à l’autre :

```yaml
devices:
  - /dev/serial/by-id/your-meshcore-radio:/dev/meshcore-radio
environment:
  MESHCORE_SERIAL_PORT: /dev/meshcore-radio
```

Un chemin `by-id` contenant des `:` ne peut pas être écrit tel quel dans Compose. Dans ce cas, passez par un alias sans `:` côté hôte.

## TCP

La radio est joignable sur le réseau, par exemple un nœud exposé par une passerelle ou un firmware compagnon en TCP. Pour poser un firmware companion USB, répéteur ou room server depuis le navigateur, voir le [flasher](/flasher/).

```yaml
environment:
  MESHCORE_TCP_HOST: 192.168.1.100
  MESHCORE_TCP_PORT: 5000
```

Le TCP a une conséquence concrète sur les envois de salon. Meshloom ne suppose pas avoir l’accès exclusif au périphérique sur ce transport, donc il ne réutilise pas le cache local de slots de salon : chaque envoi de salon repasse par `set_channel(...)` avant émission. C’est plus lent qu’en série ou en BLE, et c’est voulu. Voir [Radio, contacts et salons](/docs/deep/radio/).

## BLE

Le transport le plus capricieux des trois. `MESHCORE_BLE_ADDRESS` et `MESHCORE_BLE_PIN` sont tous les deux obligatoires.

Deux points à connaître avant de s’engager :

- En Docker, BLE demande presque toujours des modifications manuelles du Compose : passthrough du périphérique Bluetooth, mode privilégié, réseau hôte, ou d’autres ajustements propres à l’hôte. Le fichier d’exemple du dépôt le signale et laisse les lignes commentées.
- Sur une liaison BLE avec beaucoup de contacts, l’énumération initiale de la table de contacts de la radio peut expirer. Meshloom tente quand même de charger favoris et contacts récents, au mieux, mais sans photo complète de ce qui est déjà sur la radio certains ajouts seront redondants ou échoueront. `MESHCORE_LOAD_WITH_AUTOEVICT=true` existe pour ce cas précis, décrit dans [Radio, contacts et salons](/docs/deep/radio/).

## Ce que propose l’installeur

Le one-liner Linux ne propose que les transports utilisables sur la machine où il tourne. Quatre choix possibles : USB en détection automatique, USB avec chemin saisi à la main, TCP, BLE. Le mode « choix manuel » existe pour les machines où plusieurs périphériques série sont branchés. Pour BLE, l’installeur exige le PIN et ne laisse pas passer une valeur vide.

Le transport choisi est écrit dans `/etc/meshloom/meshloom.env` pour l’installation par paquet. Le rejouer plus tard change le transport sans réinstaller : le script arrête le service, réécrit l’unité, recharge systemd et redémarre. Détails dans [Autres chemins d’installation](/docs/deep/install-paths/).

## Reconnexion

Une fois connecté, un moniteur vérifie l’état de la liaison toutes les cinq secondes et tente de reconnecter tout seul. Deux endpoints existent pour la main humaine :

- `POST /api/radio/reconnect` force une tentative de reconnexion.
- `POST /api/radio/disconnect` coupe la liaison et met en pause les tentatives automatiques.

Après une reconnexion, Meshloom rejoue sa séquence d’installation post-connexion : enregistrement des gestionnaires d’événements, export de la clé privée en mémoire, synchronisation d’horloge, synchronisation contacts et salons. Cette séquence est bornée par un délai. Si elle traîne trop, le backend journalise l’échec et pousse un message dans l’interface demandant de redémarrer la radio puis le serveur.

Si la séquence échoue franchement, le moniteur la retente toutes les cinq secondes, indéfiniment. C’est délibéré : la radio peut être en train de redémarrer ou de sortir de veille, et l’installation se terminera d’elle-même quand elle répondra.
