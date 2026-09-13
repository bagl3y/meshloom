## [4.2.1] - 2026-09-13

Observer-reach badges work again when Meshloom Community is on. CoreScope’s `POST /api/packets/observations` is ingest, not a batch query; counts now fall back to per-packet detail instead of hiding every ear.

### Highlights

- Flood-message observer ears come back with Community enabled, even without a manual CoreScope URL
- New installs join Meshloom Community by default, with a banner until an IATA airport code is saved. Operators who opt out can dismiss that banner permanently

### Added

- Feature: Airport IATA search in Community settings (nearest-airport helper + IATA directory link)
- Feature: Opted-out operators can permanently dismiss the Community setup banner (per browser)

### Changed

- Misc: Brand-new databases seed Community on unless `MESHLOOM_COMMUNITY=0`. Existing databases stay as stored
- Misc: Internal package, backup, and browser-storage identifiers use the `meshloom` prefix. Leftover `remoteterm-` localStorage keys are copied once. New installs seed `#meshloom` instead of `#remoteterm`

### Fixed

- Bug: Community observer-reach counts treated CoreScope `POST /api/packets/observations` as a query. That route is ingest-only, so the directory call failed and the UI hid every badge. Counts now fall back to `GET` packet detail, the same path hop-name resolution already used
- Bug: Clicking an observer badge hung on “Loading observers…”. The modal detail path called Stats GET packet detail without the batch fallback the count already used, and a language-function identity change could cancel the in-flight request so the spinner never cleared

---

### Français

Les badges observateurs refonctionnent quand Meshloom Community est activé. Le `POST /api/packets/observations` de CoreScope est un ingest, pas une requête batch ; les comptages retombent sur le détail par paquet au lieu de cacher toutes les oreilles.

#### Points forts

- Les oreilles sur les messages flood reviennent avec Community, même sans URL CoreScope manuelle
- Les installs neuves rejoignent Meshloom Community par défaut, avec une bannière tant qu’un code IATA d’aéroport n’est pas enregistré. Un opérateur qui a opt-out peut masquer cette bannière définitivement

#### Ajouts

- Fonction : recherche d’aéroport IATA dans les réglages Community (aéroport le plus proche + lien annuaire IATA)
- Fonction : un opérateur opt-out peut masquer définitivement la bannière Community (par navigateur)

#### Changements

- Divers : une base toute neuve seed Community on sauf `MESHLOOM_COMMUNITY=0`. Les bases existantes restent telles quelles
- Divers : les identifiants internes (paquet, backup, localStorage) passent au préfixe `meshloom`. Les clés `remoteterm-` restantes sont copiées une fois. Les installs neuves seedent `#meshloom` au lieu de `#remoteterm`

#### Corrections

- Bug : les comptages observateurs Community traitaient le `POST /api/packets/observations` CoreScope comme une requête. Cette route est un ingest, l’appel directory échouait, et l’UI cachait chaque badge. Les comptages retombent maintenant sur le détail `GET` par hash, le même chemin que la résolution des nœuds
- Bug : un clic sur le badge observateur restait bloqué sur « Chargement des observateurs… ». Le détail de la modale appelait le GET Stats sans le fallback batch déjà utilisé pour le count, et un changement d’identité de la fonction i18n pouvait annuler la requête en vol, donc le spinner ne se fermait jamais

---

## [4.2.0] - 2026-09-13

Optional **Meshloom Stats** observer community: join from Settings, bind a 3-letter IATA code, and this server can publish overheard packets to the official Stats hosts. Existing installs stay off until you join.

### Highlights

- New **Settings > Meshloom Stats** pane to join, bind IATA, and see community contribution stats
- One opt-out stops both publish and community directory calls. Directory can fall back to a manual CoreScope URL in Radio-App
- Observer-reach detail can show hop paths and origin when the directory returns them

### Added

- Feature: Opt-in Meshloom Stats settings (`/api/community`), IATA bind, and a hidden system MQTT publisher (not listed in Fanout CRUD)
- Feature: Stats JWT includes `iata`. Existing databases stay opted out; `MESHLOOM_COMMUNITY=1` only seeds new installs
- Feature: Observer-reach views can render hop paths and origin metadata

### Changed

- Misc: Python, React 19, Vitest 5, and Playwright. Tailwind stays on 3; TypeScript stays on 5
- Misc: Backup restore keeps the SQLite dump intact but honest, validates directory restore before writes, and bounds in-memory CoreScope caches

### Fixed

- Bug: Repeater CLI `send_cmd` after meshcore 2.3.9 required a contact type
- Bug: OSM map tiles were blocked; the map now sends a Referer and uses the official tile URL
- Bug: Module-level asyncio locks broke when pytest-asyncio created a new event loop
- Bug: Joining Meshloom Stats did not turn on hop names, locate, or observer-reach UI; those stayed gated on the manual CoreScope toggle

---

### Français

Communauté d’observateurs **Meshloom Stats** en option : rejoindre depuis les Réglages, associer un code IATA à 3 lettres, et ce serveur peut publier les paquets entendus vers les hôtes Stats officiels. Les installs existantes restent hors ligne tant que tu n’as pas rejoint.

#### Points forts

- Nouvel onglet **Réglages > Meshloom Stats** pour rejoindre, associer l’IATA, et voir les stats de contribution
- Un seul opt-out arrête la publication **et** les appels directory communautaires. Le directory peut retomber sur une URL CoreScope manuelle dans Radio-App
- Le détail observateurs peut afficher les chemins de sauts et l’origine quand le directory les fournit

#### Ajouts

- Fonction : réglages Meshloom Stats opt-in (`/api/community`), association IATA, et publisher MQTT système invisible (pas dans le CRUD Fanout)
- Fonction : le JWT Stats inclut `iata`. Les bases existantes restent opt-out ; `MESHLOOM_COMMUNITY=1` ne seed que les nouvelles installs
- Fonction : les vues observateurs peuvent afficher chemins de sauts et métadonnées d’origine

#### Changements

- Divers : Python, React 19, Vitest 5 et Playwright. Tailwind reste en 3 ; TypeScript reste en 5
- Divers : la restauration de backup garde le dump SQLite intact mais honnête, valide le restore directory avant écriture, et borne les caches CoreScope en mémoire

#### Corrections

- Bug : le CLI répéteur `send_cmd` après meshcore 2.3.9 exigeait un type de contact
- Bug : les tuiles OSM étaient bloquées ; la carte envoie un Referer et utilise l’URL officielle
- Bug : les locks asyncio de module cassaient quand pytest-asyncio créait une nouvelle boucle
- Bug : rejoindre Meshloom Stats n’activait pas l’UI des noms de sauts, locate, ni portée observateurs ; elle restait liée au toggle CoreScope manuel

---

## [4.1.3] - 2026-09-11

Settings > Radio always offers USB serial, TCP, and Bluetooth. A missing port or a failed BLE scan no longer hides those choices. Re-running the Linux installer is an upgrade: it remembers the language and names the version change.

### Highlights

- Serial, TCP, and Bluetooth stay visible in **Settings > Radio** even when this host cannot see a device yet
- Saved language on the Linux one-liner, plus an explicit upgrade prompt (`4.1.2` → `4.2.3`)

### Changed

- Misc: Transport capability flags are always selectable. Missing serial ports or a missing Bluetooth adapter are shown as hints, not as a reason to hide the picker
- Misc: Loading radio settings no longer runs a BLE discovery scan. Scan stays on the **Scan** button
- Misc: systemd grants `bluetooth` when that group exists (`SupplementaryGroups`, `After=bluetooth.target`) so a later BLE choice can work
- Misc: Linux installer remembers `en` / `fr` in `installer.conf` and asks to upgrade (or reinstall) instead of “Start the installation?”



### Fixed

- Bug: USB and Bluetooth disappeared from Settings when no `/dev/ttyUSB*` / `/dev/ttyACM*` was listed, or when a 2-second BLE scan timed out
- Bug: Serial “unavailable” copy always talked about Docker. It now mentions `dialout` on a normal host, and container device mapping only inside a container

---



### Français

Réglages > Radio propose toujours le série USB, TCP et Bluetooth. Un port absent ou un scan BLE raté ne masque plus ces choix. Relancer l’installeur Linux est une mise à jour : la langue est mémorisée, et le changement de version est nommé.

#### Points forts

- Série, TCP et Bluetooth restent visibles dans **Réglages > Radio**, même si l’hôte ne voit pas encore de périphérique
- Langue mémorisée sur le one-liner Linux, et une question d’upgrade explicite (`4.1.2` → `4.2.3`)



#### Changements

- Divers : les transports restent sélectionnables. Ports série absents ou pas d’adaptateur Bluetooth = avertissement, pas un bouton caché
- Divers : ouvrir les réglages radio ne lance plus de scan BLE. Le scan reste sur le bouton **Rechercher**
- Divers : systemd ajoute `bluetooth` quand le groupe existe (`SupplementaryGroups`, `After=bluetooth.target`) pour un BLE choisi plus tard
- Divers : l’installeur Linux retient `en` / `fr` dans `installer.conf` et demande une mise à jour (ou une réinstall) au lieu de « Lancer l’installation ? »



#### Corrections

- Bug : USB et Bluetooth disparaissaient des réglages sans `/dev/ttyUSB*` / `/dev/ttyACM*`, ou si un scan BLE de 2 s expirait
- Bug : le texte « série indisponible » parlait toujours de Docker. Il parle de `dialout` sur un hôte normal, et du mapping de device seulement dans un conteneur

---



## [4.1.2] - 2026-09-11

The Linux one-liner actually downloads the GitHub package again before installing it. 4.1.1 named the tempfile `.deb` but skipped the download, so apt tried to install an empty file.

### Highlights

- Service install from the latest published `.deb` / `.rpm` downloads the package again



### Fixed

- Bug: the installer created an empty `/tmp/meshloom.*.deb` and `apt-get install` failed with `could not locate member control.tar` / `read, still have 8 to read but none left`

---



### Français

L’installeur Linux retélécharge le paquet GitHub avant de l’installer. La 4.1.1 nommait le fichier temporaire `.deb` mais sautait le téléchargement, donc apt installait un fichier vide.

#### Points forts

- L’installation service depuis le `.deb` / `.rpm` publié retélécharge le paquet



#### Corrections

- Bug : l’installeur créait un `/tmp/meshloom.*.deb` vide et `apt-get install` échouait avec `could not locate member control.tar` / `read, still have 8 to read but none left`

---



## [4.1.1] - 2026-09-11

The Linux one-liner can install the latest GitHub `.deb` again. Apt was rejecting a valid package because the tempfile had no `.deb` suffix.

### Highlights

- Service install from the latest published `.deb` / `.rpm` works again on Debian, Ubuntu, and Fedora



### Fixed

- Bug: `apt-get install` of the downloaded release package failed with `Unsupported file /tmp/tmp.… given on commandline` because the tempfile had no `.deb` extension

---



### Français

L’installeur Linux peut à nouveau installer le `.deb` GitHub. Apt refusait un paquet valide parce que le fichier temporaire n’avait pas le suffixe `.deb`.

#### Points forts

- L’installation service depuis le `.deb` / `.rpm` publié fonctionne à nouveau sur Debian, Ubuntu et Fedora



#### Corrections

- Bug : `apt-get install` du paquet téléchargé échouait avec `Unsupported file /tmp/tmp.… given on commandline` parce que le fichier temporaire n’avait pas l’extension `.deb`

---



## [4.1.0] - 2026-09-11

Flood messages can now show how many CoreScope MQTT observers heard the same packet, and chat metadata no longer wraps into the text.

### Highlights

- Optional **observer** ear on flood messages when CoreScope is enabled and at least one observer published the packet
- Click the ear for the observer list, hop/distance summary, and a map
- Date, time, observer count, path, and ACK sit on one line under the message body



### Added

- Feature: Persist firmware packet hashes on stored messages (`packet_hash`, `observer_reach_eligible`) so floods can be matched to CoreScope observations
- Feature: `POST /api/directory/packets/reach-counts` and `GET /api/directory/packets/{hash}/reach` — batch counts for visible floods, then a detail photo (list + map). One opted-in CoreScope instance only (`directory_enabled` + `directory_url`)
- Feature: Chat ear badge on channel floods, and on DMs only when a flood echo arrives. Hidden when the count is 0. Young floods refresh every 8s for 1 minute, then every 60s until 10 minutes; outgoing first lookup waits 20s



### Changed

- Misc: Message time, observer ear, hops / ACK, and region badge move to a single metadata row under the body. The sender name stays above incoming first-in-group messages



### Fixed

- Bug: Observer counts are looked up against the virtualizer’s oldest-first list, not the newest-first REST page
- Bug: Replacing the `messages` array no longer cancels in-flight CoreScope count fetches
- Bug: Empty CoreScope batch responses fall back to a per-hash GET so a live count can still appear
- Bug: Observer detail map has a real height and Leaflet CSS, so the dialog is usable

---



### Français

Les messages flood peuvent maintenant montrer combien d’observateurs MQTT CoreScope ont entendu le même paquet, et les métadonnées du chat ne se mélangent plus au texte.

#### Points forts

- Oreille **observateurs** optionnelle sur les floods quand CoreScope est activé et qu’au moins un observateur a publié le paquet
- Clic sur l’oreille : liste des observateurs, résumé sauts / distance, et carte
- Date, heure, nombre d’observateurs, chemin et ACK sur une seule ligne sous le message



#### Ajouts

- Fonction : conservation du hash firmware sur les messages stockés (`packet_hash`, `observer_reach_eligible`) pour les apparier aux observations CoreScope
- Fonction : `POST /api/directory/packets/reach-counts` et `GET /api/directory/packets/{hash}/reach` — comptages par lot pour les floods visibles, puis une photo de détail (liste + carte). Une seule instance CoreScope opt-in (`directory_enabled` + `directory_url`)
- Fonction : pastille oreille sur les floods canal, et sur les DM seulement si un écho flood arrive. Masquée si le compte est 0. Les floods jeunes se rafraîchissent toutes les 8 s pendant 1 minute, puis toutes les 60 s jusqu’à 10 minutes ; le premier lookup sortant attend 20 s



#### Changements

- Divers : l’heure, l’oreille, les sauts / ACK et le badge de région passent sur une seule ligne de métadonnées sous le corps. Le nom de l’expéditeur reste au-dessus des premiers messages d’un groupe entrant



#### Corrections

- Bug : les comptages d’observateurs sont lus sur la liste oldest-first du virtualizer, pas sur la page REST newest-first
- Bug : remplacer le tableau `messages` n’annule plus les lookups CoreScope en cours
- Bug : un lot CoreScope vide bascule sur un GET par hash pour qu’un compte puisse quand même apparaître
- Bug : la carte de détail a une hauteur réelle et le CSS Leaflet, donc le dialogue est utilisable

---



## [4.0.0] - 2026-09-11

First public **Meshloom** release. This is a new product branch of Jack Kingsman’s [Remote Terminal for MeshCore](https://github.com/jkingsman/Remote-Terminal-for-MeshCore), via [Ian Langworth’s 3.19.0 line](https://github.com/statico/remoteterm-meshcore/releases/tag/3.19.0). The original MIT copyright stays in `LICENSE.md`.

Meshloom is the same job as before — an always-on web client for a MeshCore companion radio — with a bilingual UI, a named identity for the database, radio setup in the browser, and a few observation tools the radio cannot do alone.

### Highlights

- English / French UI, toasts, push notifications, and installer
- Radio transport is chosen in **Settings > Radio** (USB, TCP, or BLE). The radio stays paused until that is set
- The database binds to the radio’s public key on first use (or after an upgrade from an unbound 3.x database)
- **RF Locate** draws conservative 0-hop coverage disks. It never invents a lat/lon pin
- Optional **CoreScope** directory to name unknown hops and search nodes
- New Linux installer, `.deb` / `.rpm` packages, and `ghcr.io/bagl3y/meshloom`
- In-browser Web Serial flasher for official MeshCore firmware



### Added

- Feature: Complete EN/FR i18n for the operator UI, toasts, and web push
- Feature: RF Locate (`#locate` / `#locate/{key}`) — unique identity, then 0-hop disks from local hearings and/or CoreScope (`local` / `corescope` / `mixte`). Ambiguous queries return 409 with candidates
- Feature: CoreScope directory proxy — hop resolve (2/3-byte only), node search, reach, and neighbors. Radio contacts stay authoritative over the overlay
- Feature: Local-only contact groups, optional stale-contact purge, and JSON backup/restore of contacts, channels, settings, and groups (plus a SQLite snapshot). The radio private key is never in the backup
- Feature: Richer chat — emoji picker, optional Giphy (browser-local API key), MeshCore Open reactions, hop-count badges, path inspector, and a MeshCore share QR
- Feature: Meshloom-branded Web Serial flasher for official companion / repeater / room-server firmware
- Feature: Linux one-liner installer at `https://get.meshloom.app` (systemd or Docker, EN/FR, root-or-sudo)
- Feature: Native `meshloom` `.deb` / `.rpm` for amd64 and arm64; Docker image `ghcr.io/bagl3y/meshloom`
- Feature: Portainer GitOps compose (`docker-compose.dev.yaml` + `.env.example`)
- Feature: EN/FR user docs in `docs/user/` (published at [https://meshloom.app/docs/](https://meshloom.app/docs/))



### Changed

- Breaking: Project, packages, and paths are Meshloom — image `ghcr.io/bagl3y/meshloom`, unit `meshloom`, data `/var/lib/meshloom`, env `/etc/meshloom/meshloom.env`
- Breaking: Radio transport is no longer configured with `MESHCORE_SERIAL_PORT`, `MESHCORE_TCP_HOST`, or `MESHCORE_BLE_ADDRESS`. Set it in the UI
- Breaking: An existing database without `radio_bound_public_key` opens the identity dialog (`identity_unbound_legacy`). Bind without wipe if this is the same radio; wipe mesh contacts/messages if it is a different device. A live key mismatch closes ingest until you adopt or reject
- Breaking: AUR packaging is removed. Use the installer, `.deb` / `.rpm`, or Docker
- Breaking: The installer no longer prompts for bots or HTTP Basic auth. Set `MESHCORE_DISABLE_BOTS` and optional `MESHCORE_BASIC_AUTH_*` in the environment yourself
- Misc: First Meshloom branding (cyan-to-violet theme) and renamed release artifacts (`meshloom-prebuilt-frontend-…`)
- Misc: Installer uses `as_root` / `priv` so it works on root-only hosts without assuming `sudo`
- Misc: Marketing site no longer lives in this repo; the README points at `docs/user/`



### Fixed

- Bug: Identity gate no longer deadlocks the radio lock when setup is paused
- Bug: Background radio sync does not write while the identity gate is closed
- Misc: Drop the unused vendored decoder, dead assets, and orphaned release scripts



### Install

```bash
/bin/bash -c "$(curl -fsSL https://get.meshloom.app)"
```

Then open [http://127.0.0.1:8000](http://127.0.0.1:8000) and choose the radio under **Settings > Radio**. Do not pipe the installer into `bash` — it needs a real terminal.

- Docker: `ghcr.io/bagl3y/meshloom` (see `docker-compose.example.yml`)
- Docs: [https://meshloom.app/docs/](https://meshloom.app/docs/)
- Trusted network only. There are no user accounts. Bots can run arbitrary Python unless `MESHCORE_DISABLE_BOTS=true`



### Upgrade from Remote Terminal / 3.19.0

1. Install Meshloom (new image or package). Keep the existing SQLite file if you want the history (`./data` or the old data directory).
2. Set transport in **Settings > Radio**. Env-based serial/TCP/BLE settings are ignored.
3. Confirm the identity dialog. **Previous key: unknown** means the database predates binding, not that the radio changed.
4. Re-apply bot disable / Basic auth in `/etc/meshloom/meshloom.env` or Compose if you still want them.

Meshloom 4.0.0 diverged at 3.19.0. Later 3.x features from other forks are not included.

### Credits

Jack Kingsman built the original client. Ian Langworth carried the 3.x line this release starts from. Thank you both.

---



### Français

Première version publique de **Meshloom**. C’est une nouvelle branche du [client web MeshCore de Jack Kingsman](https://github.com/jkingsman/Remote-Terminal-for-MeshCore), à partir de la [ligne 3.19.0 d’Ian Langworth](https://github.com/statico/remoteterm-meshcore/releases/tag/3.19.0). Le copyright MIT d’origine reste dans `LICENSE.md`.

Meshloom fait le même métier qu’avant — un client web toujours à l’écoute d’une radio compagnon MeshCore — avec une interface bilingue, une identité liée à la base, la radio configurée dans le navigateur, et quelques outils d’observation qu’une radio seule ne peut pas faire.

#### Points forts

- Interface, toasts, notifications push et installeur en anglais / français
- Le transport radio se choisit dans **Réglages > Radio** (USB, TCP ou BLE). La radio reste en pause tant que ce n’est pas fait
- La base se lie à la clé publique de la radio au premier usage (ou après une mise à niveau depuis une base 3.x sans liaison)
- **RF Locate** dessine des disques de couverture 0-saut prudents. Il n’invente jamais un point lat/lon
- Annuaire **CoreScope** optionnel pour nommer les sauts inconnus et chercher des nœuds
- Nouvel installeur Linux, paquets `.deb` / `.rpm`, et image `ghcr.io/bagl3y/meshloom`
- Flasher Web Serial dans le navigateur pour le firmware MeshCore officiel



#### Ajouts

- Fonction : i18n EN/FR complète pour l’interface opérateur, les toasts et le web push
- Fonction : RF Locate (`#locate` / `#locate/{clé}`) — identité unique, puis disques 0-saut à partir des écoutes locales et/ou de CoreScope (`local` / `corescope` / `mixte`). Une requête ambiguë renvoie 409 avec des candidats
- Fonction : proxy d’annuaire CoreScope — résolution de sauts (2/3 octets seulement), recherche de nœuds, portée et voisins. Les contacts radio restent la source de vérité face à l’overlay internet
- Fonction : groupes de contacts locaux, purge optionnelle des contacts trop vieux, et sauvegarde / restauration JSON des contacts, canaux, réglages et groupes (plus un cliché SQLite). La clé privée de la radio n’est jamais dans la sauvegarde
- Fonction : chat plus riche — sélecteur d’emoji, Giphy optionnel (clé API locale au navigateur), réactions MeshCore Open, pastilles de nombre de sauts, inspecteur de chemin, et QR de partage MeshCore
- Fonction : flasher Web Serial aux couleurs Meshloom pour le firmware officiel compagnon / répéteur / serveur de salon
- Fonction : installeur Linux en une ligne sur `https://get.meshloom.app` (systemd ou Docker, EN/FR, root ou sudo)
- Fonction : paquets natifs `meshloom` `.deb` / `.rpm` amd64 et arm64 ; image Docker `ghcr.io/bagl3y/meshloom`
- Fonction : compose GitOps Portainer (`docker-compose.dev.yaml` + `.env.example`)
- Fonction : docs utilisateur EN/FR dans `docs/user/` (publiées sur [https://meshloom.app/docs/](https://meshloom.app/docs/))



#### Changements

- Cassant : le projet, les paquets et les chemins sont Meshloom — image `ghcr.io/bagl3y/meshloom`, unité `meshloom`, données `/var/lib/meshloom`, env `/etc/meshloom/meshloom.env`
- Cassant : le transport radio ne se configure plus avec `MESHCORE_SERIAL_PORT`, `MESHCORE_TCP_HOST` ou `MESHCORE_BLE_ADDRESS`. On le règle dans l’interface
- Cassant : une base existante sans `radio_bound_public_key` ouvre le dialogue d’identité (`identity_unbound_legacy`). Lier sans effacer si c’est la même radio ; effacer contacts et messages mesh si c’est un autre appareil. Un décalage de clé en direct ferme l’ingest jusqu’à adoption ou refus
- Cassant : le paquet AUR est retiré. Utiliser l’installeur, les `.deb` / `.rpm`, ou Docker
- Cassant : l’installeur ne demande plus les bots ni l’auth HTTP Basic. Régler soi-même `MESHCORE_DISABLE_BOTS` et, au besoin, `MESHCORE_BASIC_AUTH_*` dans l’environnement
- Divers : première identité visuelle Meshloom (thème cyan–violet) et artefacts de release renommés (`meshloom-prebuilt-frontend-…`)
- Divers : l’installeur utilise `as_root` / `priv` pour fonctionner sur un hôte root-only sans supposer `sudo`
- Divers : le site vitrine n’est plus dans ce dépôt ; le README pointe vers `docs/user/`



#### Corrections

- Bug : le verrou d’identité ne bloque plus le verrou radio quand l’initialisation est en pause
- Bug : la sync radio en arrière-plan n’écrit plus tant que le verrou d’identité est fermé
- Divers : suppression du décodeur vendored inutilisé, des assets morts et des scripts de release orphelins



#### Installation

```bash
/bin/bash -c "$(curl -fsSL https://get.meshloom.app)"
```

Puis ouvrir [http://127.0.0.1:8000](http://127.0.0.1:8000) et choisir la radio dans **Réglages > Radio**. Ne pas piper l’installeur dans `bash` : il a besoin d’un vrai terminal.

- Docker : `ghcr.io/bagl3y/meshloom` (voir `docker-compose.example.yml`)
- Docs : [https://meshloom.app/docs/](https://meshloom.app/docs/)
- Réseau de confiance seulement. Pas de comptes utilisateurs. Les bots peuvent exécuter du Python arbitraire sauf si `MESHCORE_DISABLE_BOTS=true`



#### Mise à niveau depuis Remote Terminal / 3.19.0

1. Installer Meshloom (nouvelle image ou paquet). Garder le fichier SQLite existant pour conserver l’historique (`./data` ou l’ancien répertoire de données).
2. Régler le transport dans **Réglages > Radio**. Les réglages serial/TCP/BLE par variables d’environnement sont ignorés.
3. Confirmer le dialogue d’identité. **Clé précédente** : **Inconnue** signifie que la base précède la liaison, pas que la radio a changé.
4. Remettre la désactivation des bots / l’auth Basic dans `/etc/meshloom/meshloom.env` ou Compose si vous les voulez encore.

Meshloom 4.0.0 a divergé à la 3.19.0. Les fonctions 3.x plus récentes des autres forks ne sont pas incluses.

#### Crédits

Jack Kingsman a écrit le client d’origine. Ian Langworth a porté la ligne 3.x dont part cette version. Merci à tous les deux.