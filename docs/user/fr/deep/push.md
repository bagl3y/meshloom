---
title: Notifications push
description: Des notifications même quand l’onglet est fermé. HTTPS obligatoire.
level: deep
order: 18
---

Le push web permet à Meshloom de notifier un navigateur pour un message entrant, même quand l’onglet est fermé. Ce n’est pas un module [fanout](/docs/deep/fanout/) : chaque navigateur a son propre abonnement, tandis que les règles (défauts et exceptions) sont partagées par toute l’installation.

Il n’y a plus de notifications de bureau dans l’onglet. Seul le Web Push est exposé.

## Deux prérequis non négociables

**HTTPS.** Un service worker ne s’enregistre que sur un contexte sécurisé. Un certificat auto-signé suffit. Voir [HTTPS](/docs/deep/https/).

**Un accès Internet sortant depuis le serveur.** Les notifications ne partent pas de Meshloom vers le navigateur : elles passent par le service de push du navigateur — Google FCM pour Chrome et Android, Mozilla autopush pour Firefox, APNs pour Safari et iOS. Le serveur doit pouvoir les joindre.

[Meshloom Community](/docs/deep/community/) exige aussi une sortie Internet une fois activé. Sans Community ni push, le reste peut tourner sur un réseau isolé.

## Clés VAPID

La paire de clés VAPID est générée automatiquement au premier démarrage, sur la courbe P-256, et stockée dans la table `app_settings`. Il n’y a rien à créer à la main. La clé publique est exposée par `GET /api/push/vapid-public-key`, ce dont le navigateur a besoin pour s’abonner.

Le sujet des jetons — la revendication `sub` — se règle dans **Réglages → Notifications**. La valeur est stockée dans `app_settings.vapid_subject`. Si ce champ est vide, Meshloom retombe sur `MESHCORE_VAPID_SUBJECT` (`mailto:noreply@meshcore.local` par défaut).

**Apple exige un vrai `mailto:` ou `https:`.** APNs rejette un sujet qui n’est pas une URI de contact, et le défaut `.local` produit `403 BadJwtToken`. Toute installation qui doit notifier un iPhone, un iPad ou Safari doit donc fixer une adresse réelle dans l’interface, ou à défaut dans l’environnement :

```text
MESHCORE_VAPID_SUBJECT=mailto:you@example.com
```

Voir la [documentation Apple sur le Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers). Google FCM accepte le défaut, ce qui explique que le problème passe inaperçu jusqu’au premier appareil Apple.

## Abonnements par navigateur, règles globales

Un **abonnement** est propre à un navigateur. Il est créé quand ce navigateur s’enregistre, stocké dans `push_subscriptions` avec son point de terminaison, une étiquette d’appareil et son état de livraison. L’étiquette est générée automatiquement depuis le User-Agent, par exemple « Chrome on macOS ».

Les **règles**, elles, sont uniques pour l’instance : défauts globaux plus exceptions par conversation (`push_defaults` et `push_conversation_overrides`). Conséquence : une exception posée depuis un téléphone s’applique à tous les navigateurs abonnés. S’abonner ou se désabonner ne change que la réception sur cet appareil.

Une ancienne liste d’opt-in (`push_conversations`) a été importée à la migration : chaque conversation alors activée est devenue une exception `true`. Les cinq défauts sont eux-mêmes passés à ON pour les bases existantes.

## Qui est notifié, par défaut

Les bascules vivent dans **Réglages → Notifications** (`#settings/notifications`). Toutes sont ON au départ.

| Bascule | Effet |
|---------|-------|
| Nouveaux contacts | Première apparition d’un compagnon (type 1) |
| Messages directs | Messages `PRIV`, y compris les publications de serveur de salon |
| Publicités répéteur | Première apparition d’un répéteur (type 2) |
| Publicités compagnon | Première apparition d’un compagnon (type 1) |
| Publicités capteur | Première apparition d’un capteur (type 4) |

Pour un compagnon, **Nouveaux contacts** ou **Publicités compagnon** suffit.

Les alertes de première apparition partent seulement quand une **nouvelle ligne contact** est insérée en base, après le réglage radio. Un nœud déjà connu, une promotion de préfixe, un nœud inconnu (type 0) ou un serveur de salon (type 3) ne déclenchent jamais cette alerte. Ce n’est pas un événement WebSocket.

Pour les salons, sans exception :

- le canal Public et les canaux `#` (hashtag) sont ON ;
- un canal à clé privée est OFF.

Une exception par conversation prime sur ces défauts.

**Coupe-circuit mute.** Le bouton dédié dans l’en-tête d’un canal (cloche barrée) coupe le push pour ce canal, indépendamment des défauts et des exceptions. Ce n’est pas la même action que la cloche d’exception.

## Depuis l’interface

**Réglages → Notifications** : abonner ce navigateur, lister les appareils (test / désabonnement), basculer les défauts, retirer les exceptions, et éditer le sujet VAPID.

**Cloche dans l’en-tête** d’une conversation (contacts, salons, serveurs de salon — pas le tableau de bord répéteur). C’est un interrupteur simple. Premier clic sans abonnement : le navigateur s’abonne, sans inverser l’exception. Les clics suivants forcent ON ou OFF pour cette conversation. La cloche n’apparaît que sur un contexte sécurisé.

## Endpoints

| Méthode | Endpoint | Effet |
|---------|----------|-------|
| GET | `/api/push/vapid-public-key` | Clé publique pour `PushManager.subscribe()` |
| POST | `/api/push/subscribe` | Enregistre ou met à jour un abonnement |
| GET | `/api/push/subscriptions` | Liste les abonnements |
| PATCH | `/api/push/subscriptions/{id}` | Change l’étiquette ou la langue |
| DELETE | `/api/push/subscriptions/{id}` | Supprime un abonnement |
| POST | `/api/push/subscriptions/{id}/test` | Envoie une notification de test |
| GET | `/api/push/preferences` | Défauts, exceptions et sujet VAPID |
| PATCH | `/api/push/preferences` | Met à jour les défauts et/ou le sujet VAPID |
| PUT | `/api/push/preferences/conversations/{key}` | Pose (`true` / `false`) ou retire (`null`) une exception |

`GET` / `POST /api/push/conversations` n’existent plus.

Les abonnements sont uniques par point de terminaison, donc un réenregistrement met à jour la ligne existante au lieu d’en créer une seconde.

## Le service worker

Le fichier `sw.js` est servi par le frontend. Il gère deux événements : l’arrivée d’une notification, qu’il affiche, et le clic sur cette notification, qui donne le focus à un onglet existant ou en ouvre un, puis navigue vers la bonne conversation en s’appuyant sur le fragment d’URL transporté dans le payload.

L’enregistrement n’est tenté que sur un contexte sécurisé. Sur une page en HTTP simple servie depuis une IP du réseau local, l’icône de cloche n’apparaît simplement pas.

## Nettoyage des abonnements morts

Un navigateur désinstallé, un profil effacé, une autorisation révoquée : le service de push répond alors `404` ou `410`. Meshloom supprime immédiatement l’abonnement correspondant. Il n’y a pas de purge à faire à la main.

## Quand rien n’arrive

Dans l’ordre :

1. Vérifier que la page est bien en HTTPS, ou sur `localhost`. Sans ça, aucune souscription n’existe.
2. Vérifier l’autorisation de notification au niveau du navigateur et du système d’exploitation.
3. Envoyer une notification de test depuis Réglages → Notifications. Un test qui échoue isole le problème côté transport, pas côté logique de message.
4. Vérifier les défauts et les exceptions : `GET /api/push/preferences`. Un canal à clé privée reste silencieux sans exception ON. Un canal muté reste silencieux même si le push est activé.
5. Sur un appareil Apple, vérifier le sujet VAPID dans l’interface (ou `MESHCORE_VAPID_SUBJECT` si le champ est vide). Un `403 BadJwtToken` dans les logs du serveur pointe directement là.
6. Vérifier que le serveur sort bien sur Internet.

Les logs du serveur en niveau `DEBUG` détaillent les réponses des services de push. Voir [Dépannage](/docs/deep/troubleshooting/).
