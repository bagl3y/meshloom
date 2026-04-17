import { useState, useEffect, useRef } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { toast } from '../ui/sonner';
import { api } from '../../api';
import { formatTime } from '../../utils/messageParser';
import { lppDisplayUnit } from '../repeater/repeaterPaneShared';
import { useDistanceUnit } from '../../contexts/DistanceUnitContext';
import { BulkDeleteContactsModal } from './BulkDeleteContactsModal';
import type {
  AppSettings,
  AppSettingsUpdate,
  Contact,
  HealthStatus,
  TelemetryHistoryEntry,
  TelemetrySchedule,
} from '../../types';

export function SettingsDatabaseSection({
  appSettings,
  health,
  onSaveAppSettings,
  onHealthRefresh,
  blockedKeys = [],
  blockedNames = [],
  onToggleBlockedKey,
  onToggleBlockedName,
  contacts = [],
  onBulkDeleteContacts,
  trackedTelemetryRepeaters = [],
  onToggleTrackedTelemetry,
  className,
}: {
  appSettings: AppSettings;
  health: HealthStatus | null;
  onSaveAppSettings: (update: AppSettingsUpdate) => Promise<void>;
  onHealthRefresh: () => Promise<void>;
  blockedKeys?: string[];
  blockedNames?: string[];
  onToggleBlockedKey?: (key: string) => void;
  onToggleBlockedName?: (name: string) => void;
  contacts?: Contact[];
  onBulkDeleteContacts?: (deletedKeys: string[]) => void;
  trackedTelemetryRepeaters?: string[];
  onToggleTrackedTelemetry?: (publicKey: string) => Promise<void>;
  className?: string;
}) {
  const { distanceUnit } = useDistanceUnit();
  const [retentionDays, setRetentionDays] = useState('14');
  const [cleaning, setCleaning] = useState(false);
  const [purgingDecryptedRaw, setPurgingDecryptedRaw] = useState(false);
  const [autoDecryptOnAdvert, setAutoDecryptOnAdvert] = useState(false);
  const [discoveryBlockedTypes, setDiscoveryBlockedTypes] = useState<number[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [latestTelemetry, setLatestTelemetry] = useState<
    Record<string, TelemetryHistoryEntry | null>
  >({});
  const telemetryFetchedRef = useRef(false);

  const [schedule, setSchedule] = useState<TelemetrySchedule | null>(null);
  const [intervalDraft, setIntervalDraft] = useState<number>(appSettings.telemetry_interval_hours);

  // Serialization chain for every auto-persisted control on this page.
  // Without this, rapid successive toggles (or mixed dropdown + checkbox
  // interactions) can dispatch overlapping PATCHes that land out of order
  // on HTTP/2 — a stale write then wins, reverting the user's last click.
  // Each call awaits the previous one before sending its request, so the
  // server sees updates in the order the user made them.
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    setAutoDecryptOnAdvert(appSettings.auto_decrypt_dm_on_advert);
    setDiscoveryBlockedTypes(appSettings.discovery_blocked_types ?? []);
    setIntervalDraft(appSettings.telemetry_interval_hours);
  }, [appSettings]);

  // Re-fetch the scheduler derivation whenever the tracked list changes or
  // the stored preference changes. Cheap: single GET, no radio lock.
  useEffect(() => {
    let cancelled = false;
    api
      .getTelemetrySchedule()
      .then((s) => {
        if (!cancelled) setSchedule(s);
      })
      .catch(() => {
        // Non-critical: dropdown falls back to the unfiltered menu.
      });
    return () => {
      cancelled = true;
    };
  }, [trackedTelemetryRepeaters.length, appSettings.telemetry_interval_hours]);

  useEffect(() => {
    if (trackedTelemetryRepeaters.length === 0 || telemetryFetchedRef.current) return;
    telemetryFetchedRef.current = true;
    let cancelled = false;
    const fetches = trackedTelemetryRepeaters.map((key) =>
      api.repeaterTelemetryHistory(key).then(
        (history) => [key, history.length > 0 ? history[history.length - 1] : null] as const,
        () => [key, null] as const
      )
    );
    Promise.all(fetches).then((entries) => {
      if (cancelled) return;
      setLatestTelemetry(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [trackedTelemetryRepeaters]);

  const handleCleanup = async () => {
    const days = parseInt(retentionDays, 10);
    if (isNaN(days) || days < 1) {
      toast.error('Invalid retention days', {
        description: 'Retention days must be at least 1',
      });
      return;
    }

    setCleaning(true);

    try {
      const result = await api.runMaintenance({ pruneUndecryptedDays: days });
      toast.success('Database cleanup complete', {
        description: `Deleted ${result.packets_deleted} old packet${result.packets_deleted === 1 ? '' : 's'}`,
      });
      await onHealthRefresh();
    } catch (err) {
      console.error('Failed to run maintenance:', err);
      toast.error('Database cleanup failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setCleaning(false);
    }
  };

  const handlePurgeDecryptedRawPackets = async () => {
    setPurgingDecryptedRaw(true);

    try {
      const result = await api.runMaintenance({ purgeLinkedRawPackets: true });
      toast.success('Decrypted raw packets purged', {
        description: `Deleted ${result.packets_deleted} raw packet${result.packets_deleted === 1 ? '' : 's'}`,
      });
      await onHealthRefresh();
    } catch (err) {
      console.error('Failed to purge decrypted raw packets:', err);
      toast.error('Failed to purge decrypted raw packets', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setPurgingDecryptedRaw(false);
    }
  };

  /**
   * Apply an AppSettings PATCH after any already-queued saves finish, and
   * revert local state if the save fails. Every auto-persist control on
   * this page routes through here so the user-visible order of clicks is
   * the order the backend sees, regardless of network reordering.
   */
  const persistAppSettings = (update: AppSettingsUpdate, revert: () => void): Promise<void> => {
    const chained = saveChainRef.current.then(async () => {
      try {
        await onSaveAppSettings(update);
      } catch (err) {
        console.error('Failed to save database settings:', err);
        revert();
        toast.error('Failed to save setting', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    });
    saveChainRef.current = chained;
    return chained;
  };

  return (
    <div className={className}>
      {/* ── Database Overview ── */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight">Database Overview</h3>
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm">Database size</span>
            <span className="text-sm font-semibold">{health?.database_size_mb ?? '?'} MB</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Oldest undecrypted packet</span>
            {health?.oldest_undecrypted_timestamp ? (
              <span className="text-sm font-semibold">
                {formatTime(health.oldest_undecrypted_timestamp)}
                <span className="font-normal text-muted-foreground ml-1">
                  ({Math.floor((Date.now() / 1000 - health.oldest_undecrypted_timestamp) / 86400)}{' '}
                  days)
                </span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">None</span>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Storage Cleanup ── */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold tracking-tight">Storage Cleanup</h3>

        <div className="rounded-md border border-border p-3 space-y-2">
          <h3 className="text-sm font-semibold">Delete Undecrypted Packets</h3>
          <p className="text-[0.8125rem] text-muted-foreground">
            Permanently deletes stored raw packets that have not yet been decrypted. These are
            retained in case you later obtain the correct key — once deleted, these messages can
            never be recovered.
          </p>
          <div className="flex gap-2 items-end">
            <div className="space-y-1">
              <Label htmlFor="retention-days" className="text-xs text-muted-foreground">
                Older than (days)
              </Label>
              <Input
                id="retention-days"
                type="number"
                min="1"
                max="365"
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                className="w-24"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleCleanup}
              disabled={cleaning}
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
            >
              {cleaning ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-border p-3 space-y-2">
          <h3 className="text-sm font-semibold">Purge Archival Raw Packets</h3>
          <p className="text-[0.8125rem] text-muted-foreground">
            Deletes the raw packet bytes behind messages that are already decrypted and visible in
            chat. This frees space but removes packet-analysis availability for those messages. It
            does not affect displayed messages or future decryption.
          </p>
          <Button
            variant="outline"
            onClick={handlePurgeDecryptedRawPackets}
            disabled={purgingDecryptedRaw}
            className="w-full border-warning/50 text-warning hover:bg-warning/10"
          >
            {purgingDecryptedRaw ? 'Purging...' : 'Purge Archival Packets'}
          </Button>
        </div>
      </div>

      <Separator />

      {/* ── DM Decryption ── */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight">DM Decryption</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoDecryptOnAdvert}
            onChange={(e) => {
              const next = e.target.checked;
              const prev = autoDecryptOnAdvert;
              setAutoDecryptOnAdvert(next);
              void persistAppSettings({ auto_decrypt_dm_on_advert: next }, () =>
                setAutoDecryptOnAdvert(prev)
              );
            }}
            className="w-4 h-4 rounded border-input accent-primary"
          />
          <span className="text-sm">Auto-decrypt historical DMs when new contact advertises</span>
        </label>
        <p className="text-[0.8125rem] text-muted-foreground">
          When enabled, the server will automatically try to decrypt stored DM packets when a new
          contact sends an advertisement. This may cause brief delays on large packet backlogs.
        </p>
      </div>

      <Separator />

      {/* ── Tracked Repeater Telemetry ── */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight">Tracked Repeater Telemetry</h3>
        <p className="text-[0.8125rem] text-muted-foreground">
          Repeaters opted into automatic telemetry collection are polled on a scheduled interval. To
          limit mesh traffic, the app caps telemetry at 24 checks per day across all tracked
          repeaters — so fewer tracked repeaters allows shorter intervals, and more tracked
          repeaters forces longer ones. Up to {schedule?.max_tracked ?? 8} repeaters may be tracked
          at once ({trackedTelemetryRepeaters.length} / {schedule?.max_tracked ?? 8} slots used).
        </p>

        {/* Interval picker. Legal options depend on current tracked count;
            we list only those. If the saved preference is no longer legal,
            the effective interval is shown below so the user knows what the
            scheduler is actually using. */}
        <div className="space-y-1.5">
          <Label htmlFor="telemetry-interval" className="text-sm">
            Collection interval
          </Label>
          <div className="flex items-center gap-2">
            <select
              id="telemetry-interval"
              value={intervalDraft}
              onChange={(e) => {
                const nextValue = Number(e.target.value);
                if (!Number.isFinite(nextValue) || nextValue === intervalDraft) return;
                const prevValue = intervalDraft;
                setIntervalDraft(nextValue);
                void persistAppSettings({ telemetry_interval_hours: nextValue }, () =>
                  setIntervalDraft(prevValue)
                );
              }}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {(schedule?.options ?? [1, 2, 3, 4, 6, 8, 12, 24]).map((hrs) => (
                <option key={hrs} value={hrs}>
                  Every {hrs} hour{hrs === 1 ? '' : 's'} ({Math.floor(24 / hrs)} check
                  {Math.floor(24 / hrs) === 1 ? '' : 's'}/day)
                </option>
              ))}
            </select>
          </div>
          {schedule && schedule.effective_hours !== schedule.preferred_hours && (
            <p className="text-xs text-warning">
              Saved preference is {schedule.preferred_hours} hour
              {schedule.preferred_hours === 1 ? '' : 's'}, but the scheduler is using{' '}
              {schedule.effective_hours} hours because {schedule.tracked_count} repeater
              {schedule.tracked_count === 1 ? '' : 's'}{' '}
              {schedule.tracked_count === 1 ? 'is' : 'are'} tracked. Your preference will be
              restored if you drop back to a supported count.
            </p>
          )}
          {schedule?.next_run_at != null && (
            <p className="text-xs text-muted-foreground">
              Next run at {formatTime(schedule.next_run_at)} (UTC top of hour).
            </p>
          )}
        </div>

        {trackedTelemetryRepeaters.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No repeaters are being tracked. Enable tracking from a repeater's dashboard.
          </p>
        ) : (
          <div className="space-y-2">
            {trackedTelemetryRepeaters.map((key) => {
              const contact = contacts.find((c) => c.public_key === key);
              const displayName = contact?.name ?? key.slice(0, 12);
              const snap = latestTelemetry[key];
              const d = snap?.data;
              return (
                <div key={key} className="rounded-md border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block">{displayName}</span>
                      <span className="text-[0.625rem] text-muted-foreground font-mono">
                        {key.slice(0, 12)}
                      </span>
                    </div>
                    {onToggleTrackedTelemetry && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleTrackedTelemetry(key)}
                        className="h-7 text-xs flex-shrink-0 text-destructive hover:text-destructive"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  {d ? (
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.625rem] text-muted-foreground">
                      <span>{d.battery_volts?.toFixed(2)}V</span>
                      <span>noise {d.noise_floor_dbm} dBm</span>
                      <span>
                        rx {d.packets_received != null ? d.packets_received.toLocaleString() : '?'}
                      </span>
                      <span>
                        tx {d.packets_sent != null ? d.packets_sent.toLocaleString() : '?'}
                      </span>
                      {d.lpp_sensors?.map((s) => {
                        const display = lppDisplayUnit(s.type_name, s.value, distanceUnit);
                        const val =
                          typeof display.value === 'number'
                            ? display.value % 1 === 0
                              ? display.value
                              : display.value.toFixed(1)
                            : display.value;
                        const label = s.type_name.charAt(0).toUpperCase() + s.type_name.slice(1);
                        return (
                          <span key={`${s.type_name}-${s.channel}`}>
                            {label} {val}
                            {display.unit ? ` ${display.unit}` : ''}
                          </span>
                        );
                      })}
                      <span className="ml-auto">checked {formatTime(snap.timestamp)}</span>
                    </div>
                  ) : snap === null ? (
                    <div className="mt-1 text-[0.625rem] text-muted-foreground italic">
                      No telemetry recorded yet
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      {/* ── Contact Management ── */}
      <div className="space-y-5">
        <h3 className="text-base font-semibold tracking-tight">Contact Management</h3>

        {/* Block discovery of new node types */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Block Discovery of New Node Types</h4>
          <p className="text-[0.8125rem] text-muted-foreground">
            Checked types will be ignored when heard via advertisement. Existing contacts of these
            types are still updated. This does not affect contacts added manually or via DM.
          </p>
          <div className="space-y-1.5">
            {(
              [
                [1, 'Block clients'],
                [2, 'Block repeaters'],
                [3, 'Block room servers'],
                [4, 'Block sensors'],
              ] as const
            ).map(([typeCode, label]) => {
              const checked = discoveryBlockedTypes.includes(typeCode);
              return (
                <label key={typeCode} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const prev = discoveryBlockedTypes;
                      const next = checked
                        ? prev.filter((t) => t !== typeCode)
                        : [...prev, typeCode];
                      setDiscoveryBlockedTypes(next);
                      void persistAppSettings({ discovery_blocked_types: next }, () =>
                        setDiscoveryBlockedTypes(prev)
                      );
                    }}
                    className="rounded border-input"
                  />
                  {label}
                </label>
              );
            })}
          </div>
          {discoveryBlockedTypes.length > 0 && (
            <p className="text-xs text-warning">
              New{' '}
              {discoveryBlockedTypes
                .map((t) =>
                  t === 1 ? 'clients' : t === 2 ? 'repeaters' : t === 3 ? 'room servers' : 'sensors'
                )
                .join(', ')}{' '}
              heard via advertisement will not be added to your contact list.
            </p>
          )}
        </div>

        {/* Blocked contacts list */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Blocked Contacts</h4>
          <p className="text-[0.8125rem] text-muted-foreground">
            Blocked contacts are hidden from the sidebar. Blocking only hides messages from the UI —
            MQTT forwarding and bot responses are not affected. Messages are still stored and will
            reappear if unblocked.
          </p>

          {blockedKeys.length === 0 && blockedNames.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No blocked contacts. Block contacts from their info pane, viewed by clicking their
              avatar in any channel, or their name within the top status bar with the conversation
              open.
            </p>
          ) : (
            <div className="space-y-2">
              {blockedKeys.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Blocked Keys</span>
                  <div className="mt-1 space-y-1">
                    {blockedKeys.map((key) => (
                      <div key={key} className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono truncate flex-1">{key}</span>
                        {onToggleBlockedKey && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleBlockedKey(key)}
                            className="h-7 text-xs flex-shrink-0"
                          >
                            Unblock
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {blockedNames.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Blocked Names</span>
                  <div className="mt-1 space-y-1">
                    {blockedNames.map((name) => (
                      <div key={name} className="flex items-center justify-between gap-2">
                        <span className="text-sm truncate flex-1">{name}</span>
                        {onToggleBlockedName && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleBlockedName(name)}
                            className="h-7 text-xs flex-shrink-0"
                          >
                            Unblock
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bulk delete */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Bulk Delete Contacts</h4>
          <p className="text-[0.8125rem] text-muted-foreground">
            Remove multiple contacts or repeaters at once. Useful for cleaning up spam or unwanted
            nodes. Message history will be preserved.
          </p>
          <Button variant="outline" className="w-full" onClick={() => setBulkDeleteOpen(true)}>
            Open Bulk Delete
          </Button>
          <BulkDeleteContactsModal
            open={bulkDeleteOpen}
            onClose={() => setBulkDeleteOpen(false)}
            contacts={contacts}
            onDeleted={(keys) => onBulkDeleteContacts?.(keys)}
          />
        </div>
      </div>
    </div>
  );
}
