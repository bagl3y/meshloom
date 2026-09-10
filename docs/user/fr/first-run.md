---
title: Premier lancement
description: Ouvrir l’interface, vérifier la radio, nommer le nœud, faire le tour de l’écran.
level: start
order: 3
---

Le serveur tourne, la radio est branchée. Reste à ouvrir la page et à regarder ce qui s’y passe.

```
http://127.0.0.1:8000
```

Depuis un autre appareil du même réseau, la même adresse avec l’IP de la machine et le port `8000`.

## Vérifier la liaison avec la radio

Tout en haut de l’écran, une barre d’état indique où en est la radio. Elle passe par plusieurs états : **Radio en connexion**, **Radio en initialisation**, puis **Radio OK** quand la liaison est établie et la synchronisation terminée. La première connexion prend un moment : le serveur lit la configuration de l’appareil, récupère ses contacts et ses salons, remet l’horloge à l’heure.

Si la barre affiche **Radio déconnectée**, un bouton **Reconnecter** est disponible à côté. Un serveur qui ne trouve pas la radio réessaie de lui-même toutes les quelques secondes, donc un câble rebranché ou une radio rallumée finit par être vu sans rien cliquer. Si l’état ne bouge pas, le transport choisi à l’installation est le premier suspect : mauvais port série, mauvaise adresse IP, PIN Bluetooth refusé. Le détail est dans [Transports radio](/docs/deep/transports/) et [Dépannage](/docs/deep/troubleshooting/).

La barre d’état affiche aussi le nom du nœud, sa clé publique — cliquer dessus la copie — et son niveau de batterie quand la radio le remonte.

## Nommer le nœud

Un nœud sans nom apparaît chez les autres sous les premiers caractères de sa clé publique. Autant lui en donner un.

**Réglages**, puis la section **Radio**, groupe **Identité**, champ **Nom de la radio**. Ce nom part dans chaque annonce et c’est ce que les autres verront dans leur liste de contacts. Court vaut mieux que long : la place dans un paquet radio est comptée.

La même section contient les paramètres radio : préréglages, fréquence, largeur de bande, et le reste. Ils doivent correspondre à ceux des nœuds voisins, sinon personne ne s’entend. Si le nœud reste muet alors que d’autres appareils sont actifs à proximité, ces réglages sont le premier endroit à regarder — et il vaut mieux savoir quelles valeurs sont en usage localement avant d’y toucher.

## Se signaler

Plus bas dans la même section, le groupe **Annonces et découverte**. Une annonce est le petit paquet par lequel un nœud dit qu’il existe, avec son nom et sa clé publique.

- **Envoyer une annonce** en envoie une tout de suite. La version *flood* se propage via les répéteurs et va donc loin. La version *zéro saut* reste locale et consomme beaucoup moins de temps d’antenne.
- **Intervalle d’annonce périodique** règle la répétition automatique. `0` désactive. Le minimum est d’une heure, et vingt-quatre heures ou plus est la valeur recommandée : une annonce trop fréquente occupe l’antenne pour tout le monde.

L’inverse fonctionne pareil. Les contacts n’ont pas à être saisis à la main : chaque annonce entendue crée ou met à jour un contact tout seul. Une liste vide au démarrage n’est pas un problème, juste un réseau qu’on n’a pas encore écouté assez longtemps.

## Le tour de l’écran

La colonne de gauche regroupe les conversations, triées par sections : **Favoris**, **Canaux**, **Contacts**, **Répéteurs**, **Serveurs de salon**. Un salon nommé **Public** existe dès le départ ; c’est le salon par défaut de MeshCore, ouvert à tout le monde.

Sous les conversations, une section **Outils** :

- **Flux de paquets bruts** — tout ce que la radio entend, déchiffrable ou non.
- **Carte des nœuds** — les nœuds dont une annonce a donné des coordonnées.
- **Visualiseur mesh** — les chemins réellement empruntés par les paquets.
- **Trace de route** — un test de route vers un nœud précis.
- **Recherche de messages** — recherche plein texte dans tout l’historique.

Le bouton **Ajouter canal/contact** ouvre la création d’une conversation : un contact par sa clé publique, un salon par sa clé, ou un salon hashtag par son nom.

Pour envoyer quelque chose : [Messages](/docs/messages/).
