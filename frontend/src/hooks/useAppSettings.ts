import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../api';
import { takePrefetchOrFetch } from '../prefetch';
import { toast } from '../components/ui/sonner';
import {
  initLastMessageTimes,
  loadLocalStorageLastMessageTimes,
  loadLocalStorageSortOrder,
  clearLocalStorageConversationState,
} from '../utils/conversationState';
import {
  isFavorite,
  loadLocalStorageFavorites,
  clearLocalStorageFavorites,
} from '../utils/favorites';
import type { AppSettings, AppSettingsUpdate, Favorite } from '../types';

export function useAppSettings() {
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  // Stable empty array prevents a new reference every render when there are none.
  const emptyFavorites = useRef<Favorite[]>([]).current;
  const favorites: Favorite[] = appSettings?.favorites ?? emptyFavorites;

  // One-time migration guard
  const hasMigratedRef = useRef(false);

  const fetchAppSettings = useCallback(async () => {
    try {
      const data = await takePrefetchOrFetch('settings', api.getSettings);
      setAppSettings(data);
      initLastMessageTimes(data.last_message_times ?? {});
    } catch (err) {
      console.error('Failed to fetch app settings:', err);
    }
  }, []);

  const handleSaveAppSettings = useCallback(
    async (update: AppSettingsUpdate) => {
      await api.updateSettings(update);
      await fetchAppSettings();
    },
    [fetchAppSettings]
  );

  const handleToggleBlockedKey = useCallback(async (key: string) => {
    const normalizedKey = key.toLowerCase();
    setAppSettings((prev) => {
      if (!prev) return prev;
      const current = prev.blocked_keys ?? [];
      const wasBlocked = current.includes(normalizedKey);
      const optimistic = wasBlocked
        ? current.filter((k) => k !== normalizedKey)
        : [...current, normalizedKey];
      return { ...prev, blocked_keys: optimistic };
    });

    try {
      const updatedSettings = await api.toggleBlockedKey(key);
      setAppSettings(updatedSettings);
    } catch (err) {
      console.error('Failed to toggle blocked key:', err);
      try {
        const settings = await api.getSettings();
        setAppSettings(settings);
      } catch {
        // If refetch also fails, leave optimistic state
      }
      toast.error('Failed to update blocked key');
    }
  }, []);

  const handleToggleBlockedName = useCallback(async (name: string) => {
    setAppSettings((prev) => {
      if (!prev) return prev;
      const current = prev.blocked_names ?? [];
      const wasBlocked = current.includes(name);
      const optimistic = wasBlocked ? current.filter((n) => n !== name) : [...current, name];
      return { ...prev, blocked_names: optimistic };
    });

    try {
      const updatedSettings = await api.toggleBlockedName(name);
      setAppSettings(updatedSettings);
    } catch (err) {
      console.error('Failed to toggle blocked name:', err);
      try {
        const settings = await api.getSettings();
        setAppSettings(settings);
      } catch {
        // If refetch also fails, leave optimistic state
      }
      toast.error('Failed to update blocked name');
    }
  }, []);

  const handleToggleFavorite = useCallback(async (type: 'channel' | 'contact', id: string) => {
    setAppSettings((prev) => {
      if (!prev) return prev;
      const currentFavorites = prev.favorites ?? [];
      const wasFavorited = isFavorite(currentFavorites, type, id);
      const optimisticFavorites = wasFavorited
        ? currentFavorites.filter((f) => !(f.type === type && f.id === id))
        : [...currentFavorites, { type, id }];
      return { ...prev, favorites: optimisticFavorites };
    });

    try {
      const updatedSettings = await api.toggleFavorite(type, id);
      setAppSettings(updatedSettings);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      try {
        const settings = await api.getSettings();
        setAppSettings(settings);
      } catch {
        // If refetch also fails, leave optimistic state
      }
      toast.error('Failed to update favorite');
    }
  }, []);

  const handleToggleTrackedTelemetry = useCallback(async (publicKey: string) => {
    const key = publicKey.toLowerCase();
    setAppSettings((prev) => {
      if (!prev) return prev;
      const current = prev.tracked_telemetry_repeaters ?? [];
      const wasTracked = current.includes(key);
      const optimistic = wasTracked ? current.filter((k) => k !== key) : [...current, key];
      return { ...prev, tracked_telemetry_repeaters: optimistic };
    });

    try {
      const result = await api.toggleTrackedTelemetry(publicKey);
      setAppSettings((prev) =>
        prev ? { ...prev, tracked_telemetry_repeaters: result.tracked_telemetry_repeaters } : prev
      );
    } catch (err) {
      console.error('Failed to toggle tracked telemetry:', err);
      try {
        const settings = await api.getSettings();
        setAppSettings(settings);
      } catch {
        // If refetch also fails, leave optimistic state
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = (err as any)?.body?.detail;
      if (typeof detail === 'object' && detail?.message) {
        toast.error(detail.message);
      } else {
        toast.error('Failed to update tracked telemetry');
      }
    }
  }, []);

  // One-time migration of localStorage preferences to server
  useEffect(() => {
    if (!appSettings || hasMigratedRef.current) return;

    if (appSettings.preferences_migrated) {
      clearLocalStorageFavorites();
      clearLocalStorageConversationState();
      hasMigratedRef.current = true;
      return;
    }

    const localFavorites = loadLocalStorageFavorites();
    const localSortOrder = loadLocalStorageSortOrder();
    const localLastMessageTimes = loadLocalStorageLastMessageTimes();

    const hasLocalData =
      localFavorites.length > 0 ||
      localSortOrder !== 'recent' ||
      Object.keys(localLastMessageTimes).length > 0;

    if (!hasLocalData) {
      hasMigratedRef.current = true;
      return;
    }

    hasMigratedRef.current = true;

    const migratePreferences = async () => {
      try {
        const result = await api.migratePreferences({
          favorites: localFavorites,
          sort_order: localSortOrder,
          last_message_times: localLastMessageTimes,
        });

        if (result.migrated) {
          toast.success('Preferences migrated', {
            description: `Migrated ${localFavorites.length} favorites to server`,
          });
        }

        setAppSettings(result.settings);
        initLastMessageTimes(result.settings.last_message_times ?? {});

        clearLocalStorageFavorites();
        clearLocalStorageConversationState();
      } catch (err) {
        console.error('Failed to migrate preferences:', err);
      }
    };

    migratePreferences();
  }, [appSettings]);

  return {
    appSettings,
    favorites,
    fetchAppSettings,
    handleSaveAppSettings,
    handleToggleFavorite,
    handleToggleBlockedKey,
    handleToggleBlockedName,
    handleToggleTrackedTelemetry,
  };
}
