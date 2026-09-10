---
title: Radio, contacts et salons
description: Ce que Meshloom charge sur la radio, la portée de flood, et la largeur des sauts.
level: deep
order: 15
---

Meshloom prend le contrôle des contacts et des salons de la radio. Ce n’est pas un effet de bord, c’est le modèle : le serveur garde beaucoup plus d’état que la radio ne peut en retenir, et il pilote le contenu de la mémoire du nœud pour que celui-ci travaille sur les bonnes entrées.

La conséquence est nette. Si vous changez de radio en attendant que l’appareil conserve ses propres favoris indépendamment de l’application, Meshloom est un mauvais choix.

## Pourquoi charger des contacts sur la radio

Une radio n’a de place que pour quelques centaines de contacts et une poignée de salons. Le serveur, lui, garde tout.

Meshloom charge quand même des contacts sur la radio, et pour une raison précise : la radio peut acquitter automatiquement les messages directs entrants à votre place quand l’expéditeur est dans sa table de contacts. Sans ça, pas d’ACK automatique.

La séquence est la suivante. Meshloom énumère la table de contacts existante de la radio, puis la réconcilie avec l’ensemble de travail souhaité. Les favoris sont rechargés en premier. Le remplissage en contacts non favoris vise environ 80 % de `max_radio_contacts`. Un déchargement puis rechargement complet se déclenche autour de 95 % d’occupation.

`max_radio_contacts` est un réglage d’exécution, dans les paramètres radio de l’interface. Le baisser réduit le nombre de contacts que l’application tente de charger.

## Quand la table de contacts est pleine

Deux situations posent problème.

Sur une liaison BLE avec beaucoup de contacts, ou sur une radio dont la table a grossi organiquement à force de publicités reçues, l’énumération initiale peut expirer. Meshloom charge alors les favoris et les contacts récents au mieux, mais sans photo complète de la table certains ajouts sont redondants ou échouent.

Si la table est déjà pleine — remplie par des publicités ou par un autre client — l’application ne peut pas charger tout ce qu’elle voudrait. Un avertissement signale que l’acquittement automatique des DM ne fonctionnera peut-être pas pour tous les contacts. Quatre sorties :

- Vider la table de contacts de la radio avec un autre client MeshCore, l’application compagnon officielle par exemple, puis redémarrer Meshloom.
- Baisser la cible de remplissage dans les paramètres radio.
- Activer le mode autoevict.
- Ignorer l’avertissement. **L’envoi et la réception de messages ne sont jamais affectés.**

### Mode autoevict

`MESHCORE_LOAD_WITH_AUTOEVICT=true` évite entièrement les erreurs `TABLE_FULL`. À la connexion, l’application active la préférence `AUTO_ADD_OVERWRITE_OLDEST` de la radio, qui fait évincer automatiquement le plus ancien contact non favori quand la table est pleine. Trois effets :

- Les ajouts de contacts n’échouent plus, la radio fait toujours de la place.
- L’application peut charger des contacts même quand elle n’arrive pas à énumérer la table existante, typiquement sur une liaison BLE lente.
- Aucune étape de retrait n’est nécessaire pendant la réconciliation.

Le compromis : les contacts chargés par l’application ne sont pas marqués favoris côté radio, donc ils sont candidats à l’éviction si une nouvelle publicité arrive alors que la table est pleine. En pratique, un contact fraîchement chargé a un `lastmod` récent et sera parmi les derniers évincés. Mais si vous débranchez la radio de Meshloom pour l’utiliser seule, ces contacts ne sont plus protégés.

## Salons et slots

Le nombre de slots de salon vient de ce que le firmware annonce dans `DEVICE_INFO.max_channels`. Meshloom ne suppose pas de valeur fixe.

Au démarrage, le déchargement des salons vide les slots de la radio. Ensuite, les envois utilisent un cache local de slots en LRU : un envoi répété vers le même salon réutilise le slot déjà chargé, un nouveau salon prend un slot libre jusqu’à la capacité annoncée, puis évince le salon en cache le moins récemment utilisé.

Deux exceptions à cette réutilisation :

- En TCP, chaque envoi de salon repasse par `set_channel(...)`. Meshloom n’a pas l’accès exclusif au périphérique sur ce transport, donc il ne fait pas confiance au contenu supposé des slots.
- `MESHCORE_FORCE_CHANNEL_SLOT_RECONFIGURE=true` désactive la réutilisation sur tous les transports. À utiliser si les slots semblent instables ou si un autre client les modifie. Coût : environ 500 ms de plus par envoi.

## L’audit horaire

Par défaut, Meshloom s’appuie sur les événements radio et la récupération automatique de MeshCore pour les messages entrants, et fait tourner en plus un audit à basse fréquence, une fois par heure. Cet audit vérifie deux choses :

- si des messages sont restés sur la radio sans atteindre l’application par abonnement d’événement
- si les attentes de l’application sur les slots de salon correspondent toujours à la liste réelle de la radio

En cas d’écart, une erreur apparaît dans l’interface et dans les logs, et le cache de slots d’envoi est réinitialisé.

Si vous voyez cet avertissement, ou si des messages présents sur la radio n’apparaissent jamais dans l’application, `MESHCORE_ENABLE_MESSAGE_POLL_FALLBACK=true` transforme cet audit en filet de sécurité agressif, toutes les 10 secondes.

## Largeur des sauts : path_hash_mode

Le firmware MeshCore peut encoder les sauts d’un chemin sur 1, 2 ou 3 octets. Le réglage s’appelle `path_hash_mode` :

| Valeur | Largeur par saut |
|--------|------------------|
| `0` | 1 octet |
| `1` | 2 octets |
| `2` | 3 octets |

`GET /api/radio/config` expose la valeur courante et `path_hash_mode_supported`. `PATCH /api/radio/config` ne peut la modifier que si le firmware connecté le supporte. L’interface n’affiche le réglage que dans ce cas.

Deux règles qui évitent des erreurs de lecture :

- `path_len`, dans les payloads d’API comme dans l’interface, est **toujours un nombre de sauts**, jamais un nombre d’octets. La longueur réelle en octets est `nombre de sauts × largeur`.
- Un salon peut porter un `path_hash_mode_override`. Quand il est défini, l’envoi vers ce salon bascule temporairement la radio sur cette largeur, puis restaure la valeur par défaut.

## Portée de flood régionale

`flood_scope` est un réglage global, dans la base. Il nomme la région dans laquelle les envois en flood sont portés. Un salon peut en dévier avec `flood_scope_override` : l’envoi bascule la radio sur cette portée le temps de l’émission, puis restaure le réglage global.

Côté réception, nommer la région d’un paquet demande une liste de candidats. Les paquets scopés portent un code de transport qui n’est pas un identifiant de région stable : c’est un MAC calculé avec la clé de la région. Il n’existe pas de table inverse. Meshloom recalcule donc le code pour chaque région de `known_regions` et cherche une correspondance. Une région absente de la liste donne un paquet scopé mais non nommé.

`known_regions` est éditable. `POST /api/radio/discover-regions` interroge les répéteurs proches pour récupérer les noms de régions autorisées en flood et les fusionner dans la liste. La requête est routée en direct, donc seuls les répéteurs à portée répondent.

## Routage des messages directs

Trois sources de route possibles pour un DM, dans cet ordre de priorité :

1. une surcharge explicite (`route_override_*`)
2. la route directe apprise
3. le flood

La route directe apprise vient de la synchronisation des contacts de la radio et des mises à jour de découverte de chemin. Les chemins de publicité ne sont **pas** une source de route : ils sont conservés pour le panneau contact et le visualiseur, rien de plus. Les ACK non plus : ils décrivent l’état de livraison, pas la topologie.

Un DM part une fois immédiatement. Si le résultat d’envoi contient un code d’ACK attendu et que le message reste non acquitté, jusqu’à deux réessais suivent en arrière-plan, cadencés par le `suggested_timeout` de la radio. Le dernier réessai est envoyé en flood même si une surcharge de route existe.

## Publicité

`advert_interval`, en secondes, pilote la publicité périodique. `0` la désactive. Le dernier envoi est mémorisé dans `last_advert_time`.

Un envoi manuel passe par `POST /api/radio/advertise`, avec un `mode` valant `flood` ou `zero_hop`. L’interface expose les deux boutons dans les paramètres radio.

Le contrôle de localisation dans la publicité est volontairement binaire : désactivé, ou inclure la position du nœud. Le firmware compagnon ne distingue pas fiablement des coordonnées enregistrées d’un relevé GPS live sur ce chemin.

## Clé privée

À la connexion, Meshloom exporte la clé privée de la radio et la garde **en mémoire uniquement**. Elle n’est jamais écrite sur disque. C’est ce qui permet de déchiffrer les messages directs côté serveur, même quand le contact n’est pas chargé sur la radio, et de rattraper des DM historiques quand une clé devient connue.

L’export de cette clé par l’API est désactivé par défaut. Voir [Sécurité](/docs/deep/security/).
