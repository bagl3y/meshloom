import { useState, useEffect, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { toast } from '../ui/sonner';
import { api } from '../../api';
import { formatTime } from '../../utils/messageParser';
import type { AppSettings, AppSettingsUpdate, HealthStatus } from '../../types';

export function SettingsDatabaseSection({
  appSettings,
  health,
  onSaveAppSettings,
  onHealthRefresh,
  className,
}: {
  appSettings: AppSettings;
  health: HealthStatus | null;
  onSaveAppSettings: (update: AppSettingsUpdate) => Promise<void>;
  onHealthRefresh: () => Promise<void>;
  className?: string;
}) {
  const { t } = useTranslation();
  const [retentionDays, setRetentionDays] = useState('14');
  const [cleaning, setCleaning] = useState(false);
  const [purgingDecryptedRaw, setPurgingDecryptedRaw] = useState(false);
  const [autoDecryptOnAdvert, setAutoDecryptOnAdvert] = useState(false);
  const [downloadingDb, setDownloadingDb] = useState(false);
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState(false);

  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    setAutoDecryptOnAdvert(appSettings.auto_decrypt_dm_on_advert);
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

      <div className="space-y-4">
        <h3 className="text-base font-semibold tracking-tight">{t('settings.backupTitle')}</h3>
        <p className="text-[0.8125rem] text-muted-foreground">
          <Trans i18nKey="settings.backupKeyWarning" />
        </p>

        <div className="rounded-md border border-border p-3 space-y-2">
          <h4 className="text-sm font-semibold">{t('settings.backupDbTitle')}</h4>
          <p className="text-[0.8125rem] text-muted-foreground">{t('settings.backupDbHelp')}</p>
          <Button
            variant="outline"
            disabled={downloadingDb}
            onClick={async () => {
              setDownloadingDb(true);
              try {
                await api.downloadDatabaseBackup();
              } catch (err) {
                toast.error(t('settings.backupDbFailed'), {
                  description: err instanceof Error ? err.message : 'Unknown error',
                });
              } finally {
                setDownloadingDb(false);
              }
            }}
          >
            {downloadingDb ? t('settings.backupDbDownloading') : t('settings.backupDbDownload')}
          </Button>
        </div>

        <div className="rounded-md border border-border p-3 space-y-2">
          <h4 className="text-sm font-semibold">{t('settings.backupJsonTitle')}</h4>
          <p className="text-[0.8125rem] text-muted-foreground">{t('settings.backupJsonHelp')}</p>
          <Button
            variant="outline"
            disabled={downloadingJson}
            onClick={async () => {
              setDownloadingJson(true);
              try {
                const data = await api.getJsonBackup();
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                  type: 'application/json',
                });
                const href = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = href;
                a.download = 'remoteterm-backup.json';
                a.click();
                URL.revokeObjectURL(href);
              } catch (err) {
                toast.error(t('settings.backupJsonFailed'), {
                  description: err instanceof Error ? err.message : 'Unknown error',
                });
              } finally {
                setDownloadingJson(false);
              }
            }}
          >
            {downloadingJson ? t('settings.backupJsonExporting') : t('settings.backupJsonDownload')}
          </Button>
        </div>

        <div className="rounded-md border border-warning/40 p-3 space-y-2">
          <h4 className="text-sm font-semibold">{t('settings.restoreJsonTitle')}</h4>
          <p className="text-[0.8125rem] text-muted-foreground">{t('settings.restoreJsonHelp')}</p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={restoreConfirm}
              onChange={(e) => setRestoreConfirm(e.target.checked)}
              className="w-4 h-4 rounded border-input accent-primary"
            />
            <span className="text-sm">{t('settings.restoreConfirm')}</span>
          </label>
          <Input
            type="file"
            accept="application/json,.json"
            disabled={!restoreConfirm || restoring}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file || !restoreConfirm) return;
              setRestoring(true);
              try {
                const parsed = JSON.parse(await file.text());
                const result = await api.restoreJsonBackup(parsed);
                toast.success(t('settings.restoreMerged'), {
                  description: t('settings.restoreMergedDetail', {
                    contacts: result.contacts_upserted,
                    channels: result.channels_upserted,
                    groups: result.groups_upserted,
                  }),
                });
                await onHealthRefresh();
              } catch (err) {
                toast.error(t('settings.restoreFailed'), {
                  description: err instanceof Error ? err.message : 'Unknown error',
                });
              } finally {
                setRestoring(false);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
