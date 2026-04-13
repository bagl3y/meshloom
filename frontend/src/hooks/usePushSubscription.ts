import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '../components/ui/sonner';
import { api } from '../api';
import type { PushSubscriptionInfo } from '../types';

function generateLabel(): string {
  const ua = navigator.userAgent;
  // Extract browser + OS in a human-readable form
  if (/Firefox/i.test(ua)) {
    if (/Android/i.test(ua)) return 'Firefox on Android';
    if (/Mac/i.test(ua)) return 'Firefox on macOS';
    if (/Windows/i.test(ua)) return 'Firefox on Windows';
    if (/Linux/i.test(ua)) return 'Firefox on Linux';
    return 'Firefox';
  }
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) {
    if (/Android/i.test(ua)) return 'Chrome on Android';
    if (/CrOS/i.test(ua)) return 'Chrome on ChromeOS';
    if (/Mac/i.test(ua)) return 'Chrome on macOS';
    if (/Windows/i.test(ua)) return 'Chrome on Windows';
    if (/Linux/i.test(ua)) return 'Chrome on Linux';
    return 'Chrome';
  }
  if (/Edg/i.test(ua)) return 'Edge';
  if (/Safari/i.test(ua)) {
    if (/iPhone|iPad/i.test(ua)) return 'Safari on iOS';
    return 'Safari on macOS';
  }
  return 'Browser';
}

/** Convert a base64url string to a Uint8Array (for applicationServerKey) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function usePushSubscription() {
  const [isSupported, setIsSupported] = useState(false);
  const [currentSubscriptionId, setCurrentSubscriptionId] = useState<string | null>(null);
  const [allSubscriptions, setAllSubscriptions] = useState<PushSubscriptionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const vapidKeyRef = useRef<string | null>(null);

  // Check support on mount
  useEffect(() => {
    const supported =
      window.isSecureContext &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setIsSupported(supported);

    if (supported) {
      // Check if this browser already has an active push subscription
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then(async (sub) => {
          if (sub) {
            // Look up this endpoint in backend to get the subscription ID
            const existing = await api
              .getPushSubscriptions()
              .catch(() => [] as PushSubscriptionInfo[]);
            const match = existing.find((s) => s.endpoint === sub.endpoint);
            if (match) {
              setCurrentSubscriptionId(match.id);
              setAllSubscriptions(existing);
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  const refreshSubscriptions = useCallback(async () => {
    try {
      const subs = await api.getPushSubscriptions();
      setAllSubscriptions(subs);
      return subs;
    } catch {
      return [];
    }
  }, []);

  const subscribe = useCallback(
    async (conversationKey?: string): Promise<string | null> => {
      if (!isSupported) return null;
      setLoading(true);
      try {
        // Get VAPID key if not cached
        if (!vapidKeyRef.current) {
          const resp = await api.getVapidPublicKey();
          vapidKeyRef.current = resp.public_key;
        }

        // Register/get service worker
        const reg = await navigator.serviceWorker.ready;

        // Reuse existing browser subscription if one exists, otherwise create new
        let pushSub = await reg.pushManager.getSubscription();
        if (!pushSub) {
          pushSub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKeyRef.current).buffer as ArrayBuffer,
          });
        }

        const json = pushSub.toJSON();
        const endpoint = json.endpoint!;
        const p256dh = json.keys!.p256dh!;
        const auth = json.keys!.auth!;

        // Register with backend
        const result = await api.pushSubscribe({
          endpoint,
          p256dh,
          auth,
          label: generateLabel(),
        });

        // If subscribing for a specific conversation, set filter_mode to selected
        if (conversationKey) {
          await api.updatePushSubscription(result.id, {
            filter_mode: 'selected',
            filter_conversations: [conversationKey],
          });
        }

        setCurrentSubscriptionId(result.id);
        await refreshSubscriptions();
        return result.id;
      } catch (err) {
        console.error('Push subscribe failed:', err);
        toast.error('Failed to enable push notifications', {
          description: err instanceof Error ? err.message : 'Check that notifications are allowed',
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [isSupported, refreshSubscriptions]
  );

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      // Unsubscribe from browser Push API
      const reg = await navigator.serviceWorker.ready;
      const pushSub = await reg.pushManager.getSubscription();
      if (pushSub) await pushSub.unsubscribe();

      // Remove from backend
      if (currentSubscriptionId) {
        await api.deletePushSubscription(currentSubscriptionId).catch(() => {});
      }

      setCurrentSubscriptionId(null);
      await refreshSubscriptions();
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
    } finally {
      setLoading(false);
    }
  }, [currentSubscriptionId, refreshSubscriptions]);

  const addConversation = useCallback(
    async (conversationKey: string) => {
      if (!currentSubscriptionId) return;
      const sub = allSubscriptions.find((s) => s.id === currentSubscriptionId);
      if (!sub) return;

      const conversations = [...(sub.filter_conversations || [])];
      if (!conversations.includes(conversationKey)) {
        conversations.push(conversationKey);
      }
      await api.updatePushSubscription(currentSubscriptionId, {
        filter_mode: 'selected',
        filter_conversations: conversations,
      });
      await refreshSubscriptions();
    },
    [currentSubscriptionId, allSubscriptions, refreshSubscriptions]
  );

  const removeConversation = useCallback(
    async (conversationKey: string) => {
      if (!currentSubscriptionId) return;
      const sub = allSubscriptions.find((s) => s.id === currentSubscriptionId);
      if (!sub) return;

      const conversations = (sub.filter_conversations || []).filter((k) => k !== conversationKey);
      await api.updatePushSubscription(currentSubscriptionId, {
        filter_conversations: conversations,
      });
      await refreshSubscriptions();
    },
    [currentSubscriptionId, allSubscriptions, refreshSubscriptions]
  );

  const isConversationPushEnabled = useCallback(
    (conversationKey: string): boolean => {
      if (!currentSubscriptionId) return false;
      const sub = allSubscriptions.find((s) => s.id === currentSubscriptionId);
      if (!sub) return false;
      if (sub.filter_mode === 'all_messages') return true;
      if (sub.filter_mode === 'all_dms') return conversationKey.startsWith('contact-');
      return (sub.filter_conversations || []).includes(conversationKey);
    },
    [currentSubscriptionId, allSubscriptions]
  );

  const deleteSubscription = useCallback(
    async (subscriptionId: string) => {
      await api.deletePushSubscription(subscriptionId);
      if (subscriptionId === currentSubscriptionId) {
        setCurrentSubscriptionId(null);
        // Also unsubscribe from browser Push API if it's our own
        try {
          const reg = await navigator.serviceWorker.ready;
          const pushSub = await reg.pushManager.getSubscription();
          if (pushSub) await pushSub.unsubscribe();
        } catch {
          // best effort
        }
      }
      await refreshSubscriptions();
    },
    [currentSubscriptionId, refreshSubscriptions]
  );

  const testPush = useCallback(async (subscriptionId: string) => {
    try {
      await api.testPushSubscription(subscriptionId);
      toast.success('Test notification sent');
    } catch {
      toast.error('Test notification failed');
    }
  }, []);

  return {
    isSupported,
    isSubscribed: !!currentSubscriptionId,
    currentSubscriptionId,
    allSubscriptions,
    loading,
    subscribe,
    unsubscribe,
    addConversation,
    removeConversation,
    isConversationPushEnabled,
    deleteSubscription,
    testPush,
    refreshSubscriptions,
  };
}
