import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../api';
import { takePrefetchOrFetch } from '../prefetch';
import { toast } from '../components/ui/sonner';
import { initLastMessageTimes } from '../utils/conversationState';
import { isFavorite } from '../utils/favorites';
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

  // Legacy favorites migration: if pre-server-side favorites exist in
  // localStorage, toggle each one via the existing API and clear the key.
  useEffect(() => {
    if (!appSettings || hasMigratedRef.current) return;
    hasMigratedRef.current = true;

    const FAVORITES_KEY = 'remoteterm-favorites';
    let localFavorites: Favorite[] = [];
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) localFavorites = JSON.parse(stored);
    } catch {
      // corrupt or unavailable
    }
    if (localFavorites.length === 0) return;

    const migrate = async () => {
      try {
        for (const f of localFavorites) {
          await api.toggleFavorite(f.type, f.id);
        }
        localStorage.removeItem(FAVORITES_KEY);
        await fetchAppSettings();
      } catch (err) {
        console.error('Failed to migrate legacy favorites:', err);
      }
    };
    migrate();
  }, [appSettings, fetchAppSettings]);

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
