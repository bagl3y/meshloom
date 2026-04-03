import { useState, useEffect } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { toast } from '../ui/sonner';
import { api } from '../../api';
import { formatTime } from '../../utils/messageParser';
import { BulkDeleteContactsModal } from './BulkDeleteContactsModal';
import type { AppSettings, AppSettingsUpdate, Contact, HealthStatus } from '../../types';

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
  const [retentionDays, setRetentionDays] = useState('14');
  const [cleaning, setCleaning] = useState(false);
  const [purgingDecryptedRaw, setPurgingDecryptedRaw] = useState(false);
  const [autoDecryptOnAdvert, setAutoDecryptOnAdvert] = useState(false);
  const [discoveryBlockedTypes, setDiscoveryBlockedTypes] = useState<number[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAutoDecryptOnAdvert(appSettings.auto_decrypt_dm_on_advert);
    setDiscoveryBlockedTypes(appSettings.discovery_blocked_types ?? []);
  }, [appSettings]);

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

  const handleSave = async () => {
    setBusy(true);
    setError(null);

    try {
      const update: AppSettingsUpdate = { auto_decrypt_dm_on_advert: autoDecryptOnAdvert };
      const currentBlocked = appSettings.discovery_blocked_types ?? [];
      if (
        discoveryBlockedTypes.length !== currentBlocked.length ||
        discoveryBlockedTypes.some((t) => !currentBlocked.includes(t))
      ) {
        update.discovery_blocked_types = discoveryBlockedTypes;
      }
      await onSaveAppSettings(update);
      toast.success('Database settings saved');
    } catch (err) {
      console.error('Failed to save database settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
      toast.error('Failed to save settings');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      {/* ── Database Overview ── */}
      <div className="space-y-3">
        <Label className="text-base">Database Overview</Label>
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
        <Label className="text-base">Storage Cleanup</Label>

        <div className="rounded-md border border-border p-3 space-y-2">
          <Label className="text-sm">Delete Undecrypted Packets</Label>
          <p className="text-xs text-muted-foreground">
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
          <Label className="text-sm">Purge Archival Raw Packets</Label>
          <p className="text-xs text-muted-foreground">
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
        <Label className="text-base">DM Decryption</Label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoDecryptOnAdvert}
            onChange={(e) => setAutoDecryptOnAdvert(e.target.checked)}
            className="w-4 h-4 rounded border-input accent-primary"
          />
          <span className="text-sm">Auto-decrypt historical DMs when new contact advertises</span>
        </label>
        <p className="text-xs text-muted-foreground">
          When enabled, the server will automatically try to decrypt stored DM packets when a new
          contact sends an advertisement. This may cause brief delays on large packet backlogs.
        </p>
      </div>

      <Separator />

      {/* ── Tracked Repeater Telemetry ── */}
      <div className="space-y-3">
        <Label className="text-base">Tracked Repeater Telemetry</Label>
        <p className="text-xs text-muted-foreground">
          Repeaters opted into automatic telemetry collection are polled every 8 hours. Up to 8
          repeaters may be tracked at a time ({trackedTelemetryRepeaters.length} / 8 slots used).
        </p>

        {trackedTelemetryRepeaters.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No repeaters are being tracked. Enable tracking from a repeater's dashboard.
          </p>
        ) : (
          <div className="space-y-1">
            {trackedTelemetryRepeaters.map((key) => {
              const contact = contacts.find((c) => c.public_key === key);
              const displayName = contact?.name ?? key.slice(0, 12);
              return (
                <div key={key} className="flex items-center justify-between gap-2">
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
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      <Button onClick={handleSave} disabled={busy} className="w-full">
        {busy ? 'Saving...' : 'Save Settings'}
      </Button>

      <Separator />

      {/* ── Contact Management ── */}
      <div className="space-y-2">
        <Label className="text-base">Contact Management</Label>
      </div>

      {/* Block discovery of new node types */}
      <div className="space-y-3">
        <Label>Block Discovery of New Node Types</Label>
        <p className="text-xs text-muted-foreground">
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
                  onChange={() =>
                    setDiscoveryBlockedTypes((prev) =>
                      checked ? prev.filter((t) => t !== typeCode) : [...prev, typeCode]
                    )
                  }
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

      <Separator />

      {/* Blocked contacts list */}
      <div className="space-y-3">
        <Label>Blocked Contacts</Label>
        <p className="text-xs text-muted-foreground">
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

      <Separator />

      {/* Bulk delete */}
      <div className="space-y-3">
        <Label>Bulk Delete Contacts</Label>
        <p className="text-xs text-muted-foreground">
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
  );
}
