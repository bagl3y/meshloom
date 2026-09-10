---
title: Notifications push
description: Des notifications même quand l’onglet est fermé. HTTPS obligatoire.
level: deep
order: 18
---

Le push web permet à Meshloom de notifier un navigateur pour un message entrant, même quand l’onglet est fermé. C’est un sous-système à part : ce n’est pas un module [fanout](/docs/deep/fanout/), parce qu’il gère un abonnement par navigateur, avec son propre point de terminaison et son propre état de livraison.

## Deux prérequis non négociables

**HTTPS.** Un service worker ne s’enregistre que sur un contexte sécurisé. Un certificat auto-signé suffit. Voir [HTTPS](/docs/deep/https/).

**Un accès Internet sortant depuis le serveur.** Les notifications ne partent pas de Meshloom vers le navigateur : elles passent par le service de push du navigateur — Google FCM pour Chrome et Android, Mozilla autopush pour Firefox, APNs pour Safari et iOS. Le serveur doit pouvoir les joindre.

C’est la seule fonctionnalité de Meshloom qui exige une sortie Internet. Le reste fonctionne sur un réseau isolé.

## Clés VAPID

La paire de clés VAPID est générée automatiquement au premier démarrage, sur la courbe P-256, et stockée dans la table `app_settings`. Il n’y a rien à créer à la main. La clé publique est exposée par `GET /api/push/vapid-public-key`, ce dont le navigateur a besoin pour s’abonner.

Le sujet des jetons — la revendication `sub` — vient de `MESHCORE_VAPID_SUBJECT` et vaut `mailto:noreply@meshcore.local` par défaut.

**Ce défaut ne marche pas avec Apple.** APNs rejette un sujet en `.local` avec `403 BadJwtToken`. Toute installation qui doit notifier un iPhone, un iPad ou Safari doit donc fixer une adresse réelle :

```text
MESHCORE_VAPID_SUBJECT=mailto:you@example.com
```

Un `https:` est également accepté. Google FCM, lui, accepte le défaut, ce qui explique que le problème passe inaperçu jusqu’au premier appareil Apple.

## Abonnements par navigateur, conversations globales

La séparation est importante et surprend souvent.

Un **abonnement** est propre à un navigateur. Il est créé quand ce navigateur s’enregistre, stocké dans la table `push_subscriptions` avec son point de terminaison, une étiquette d’appareil et son état de livraison. L’étiquette est générée automatiquement depuis le User-Agent, par exemple « Chrome on macOS ».

La **liste des conversations à notifier**, elle, est unique pour l’instance. Elle est stockée une seule fois dans `app_settings.push_conversations`. Conséquence : activer le push pour un salon depuis un téléphone l’active pour tous les navigateurs abonnés. Il n’y a pas de sélection par appareil.

## Depuis l’interface

Deux endroits.

Dans l’en-tête d’une conversation, une icône de cloche apparaît sur les contextes sécurisés, à côté de la cloche des notifications de bureau classiques. Le premier clic abonne le navigateur puis active le push pour cette conversation. Les clics suivants activent ou désactivent la conversation.

Dans **Réglages > Local**, la gestion des appareils liste tous les navigateurs enregistrés, avec pour chacun un bouton de test et un bouton de suppression.

## Endpoints

| Méthode | Endpoint | Effet |
|---------|----------|-------|
| GET | `/api/push/vapid-public-key` | Clé publique pour `PushManager.subscribe()` |
| POST | `/api/push/subscribe` | Enregistre ou met à jour un abonnement |
| GET | `/api/push/subscriptions` | Liste les abonnements |
| PATCH | `/api/push/subscriptions/{id}` | Change l’étiquette ou les préférences de filtrage |
| DELETE | `/api/push/subscriptions/{id}` | Supprime un abonnement |
| POST | `/api/push/subscriptions/{id}/test` | Envoie une notification de test |
| GET | `/api/push/conversations` | Liste globale des conversations notifiées |
| POST | `/api/push/conversations/toggle` | Ajoute ou retire une conversation de cette liste |

Les abonnements sont uniques par point de terminaison, donc un réenregistrement met à jour la ligne existante au lieu d’en créer une seconde.

## Le service worker

Le fichier `sw.js` est servi par le frontend. Il gère deux événements : l’arrivée d’une notification, qu’il affiche, et le clic sur cette notification, qui donne le focus à un onglet existant ou en ouvre un, puis navigue vers la bonne conversation en s’appuyant sur le fragment d’URL transporté dans le payload.

L’enregistrement n’est tenté que sur un contexte sécurisé. Sur une page en HTTP simple servie depuis une IP du réseau local, l’icône de cloche push n’apparaît simplement pas.

## Nettoyage des abonnements morts

Un navigateur désinstallé, un profil effacé, une autorisation révoquée : le service de push répond alors `404` ou `410`. Meshloom supprime immédiatement l’abonnement correspondant. Il n’y a pas de purge à faire à la main.

## Quand rien n’arrive

Dans l’ordre :

1. Vérifier que la page est bien en HTTPS, ou sur `localhost`. Sans ça, aucune souscription n’existe.
2. Vérifier l’autorisation de notification au niveau du navigateur et du système d’exploitation.
3. Envoyer une notification de test depuis Réglages > Local. Un test qui échoue isole le problème côté transport, pas côté logique de message.
4. Vérifier que la conversation figure bien dans la liste globale : `GET /api/push/conversations`.
5. Sur un appareil Apple, vérifier `MESHCORE_VAPID_SUBJECT`. Un `403 BadJwtToken` dans les logs du serveur pointe directement là.
6. Vérifier que le serveur sort bien sur Internet.

Les logs du serveur en niveau `DEBUG` détaillent les réponses des services de push. Voir [Dépannage](/docs/deep/troubleshooting/).
