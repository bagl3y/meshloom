---
title: Installer
description: Le one-liner Linux, systemd ou Docker, et pourquoi il faut garder /bin/bash -c.
level: start
order: 2
---

Le serveur Meshloom est conçu pour Linux. Une machine qui reste allumée fait un bien meilleur hôte qu’un portable qu’on referme : tant que le serveur tourne, il écoute le mesh et écrit ce qu’il entend.

Un script d’installation fait le travail et pose des questions, en français ou en anglais. À coller dans un terminal :

```bash
/bin/bash -c "$(curl -fsSL https://get.meshloom.app)"
```

## Pourquoi `/bin/bash -c`

Cette forme n’est pas décorative. Le script est interactif : il demande le mode d’installation, le type de radio, un mot de passe éventuel. Avec `/bin/bash -c "$(...)"`, le téléchargement se termine d’abord, puis le script s’exécute avec le terminal disponible pour ses questions.

Si on l’envoie dans un tube — `curl … | bash` — l’entrée du script est occupée par le téléchargement. Les questions n’ont plus de terminal pour s’afficher et l’installation part de travers. Gardez le `/bin/bash -c`.

## Ce que le script demande

Trois blocs de questions, dans cet ordre.

**Le mode.** Un service natif géré par systemd, ou Docker. Le service natif démarre automatiquement avec la machine et sait parler à une radio USB, réseau ou Bluetooth. Docker fonctionne dans un conteneur, ce qui isole l’installation mais restreint l’accès au matériel : partager une radio USB avec un conteneur suppose un Docker en mode root sur Linux. Si ce n’est pas le cas, le script le dit et propose la radio réseau.

**La radio.** Le script ne propose que les transports que cette machine peut réellement atteindre :

- Câble USB, en détection automatique quand la radio est le seul port série branché.
- Câble USB, avec chemin saisi à la main — `/dev/ttyUSB0`, `/dev/ttyACM0` — quand plusieurs appareils série sont présents.
- Réseau (TCP), quand la radio ou un appareil compagnon à côté d’elle expose un port. Il faut une adresse IP ou un nom d’hôte, plus un port.
- Bluetooth (BLE), avec l’adresse de l’appareil et le code PIN affiché sur son écran.

Un seul transport à la fois. Les détails de chacun sont dans [Transports radio](/docs/deep/transports/).

**La sécurité.** Les bots exécutent du code sur la machine : le script les laisse désactivés par défaut, et c’est le bon réglage tant que le réseau n’est pas entièrement de confiance. Il propose aussi de demander un identifiant et un mot de passe à l’ouverture. Il s’agit d’un accès partagé unique, pas de comptes utilisateurs. Voir [Un réseau de confiance](/docs/trust/).

Un récapitulatif s’affiche avant de lancer quoi que ce soit. Certaines étapes demandent les droits administrateur.

## Ouvrir l’interface

Une fois l’installation terminée, depuis la machine elle-même :

```
http://127.0.0.1:8000
```

Depuis un autre appareil du même réseau, remplacez `127.0.0.1` par l’adresse IP de la machine, en gardant le port `8000`.

Attention à ne pas confondre deux adresses proches. `http://127.0.0.1:8000/docs` est la documentation technique de l’API que le serveur génère lui-même. Ce n’est pas cette documentation-ci.

Pour vérifier ou redémarrer un service natif :

```bash
sudo systemctl status meshloom
```

## Mettre à jour

Selon le mode retenu :

```bash
sudo apt upgrade                          # Debian / Ubuntu
sudo dnf upgrade                          # Fedora / Rocky / Alma
sudo docker compose pull && sudo docker compose up -d
```

La base de données reste en place : `/var/lib/meshloom` pour le paquet, `./data` pour Docker. Les migrations de schéma s’exécutent au démarrage.

## Les autres chemins

Le script couvre le cas courant. Le reste — image Docker `ghcr.io/bagl3y/meshloom`, Portainer, HTTPS, systemd à la main, variables d’environnement, ou un dépôt cloné pour développer — est dans [Autres chemins d’installation](/docs/deep/install-paths/).

Ensuite : [Premier lancement](/docs/first-run/).
