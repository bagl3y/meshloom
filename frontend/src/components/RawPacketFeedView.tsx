import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { RawPacketList } from './RawPacketList';
import { RawPacketDetailModal } from './RawPacketDetailModal';
import type { Channel, Contact, RawPacket } from '../types';
import {
  RAW_PACKET_STATS_WINDOWS,
  buildRawPacketStatsSnapshot,
  type NeighborStat,
  type PacketTimelineBin,
  type RankedPacketStat,
  type RawPacketStatsSessionState,
  type RawPacketStatsWindow,
} from '../utils/rawPacketStats';
import { getContactDisplayName } from '../utils/pubkey';
import { cn } from '@/lib/utils';

interface RawPacketFeedViewProps {
  packets: RawPacket[];
  rawPacketStatsSession: RawPacketStatsSessionState;
  contacts: Contact[];
  channels: Channel[];
}

const WINDOW_LABELS: Record<RawPacketStatsWindow, string> = {
  '1m': '1 min',
  '5m': '5 min',
  '10m': '10 min',
  '30m': '30 min',
  session: 'Session',
};

const TIMELINE_COLORS = [
  'bg-sky-500/80',
  'bg-emerald-500/80',
  'bg-amber-500/80',
  'bg-rose-500/80',
  'bg-violet-500/80',
];

function formatTimestamp(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.max(1, Math.round(seconds))} sec`;
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.round(seconds % 60);
    return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatRate(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatRssi(value: number | null): string {
  return value === null ? '-' : `${Math.round(value)} dBm`;
}

function resolveContactLabel(sourceKey: string | null, contacts: Contact[]): string | null {
  if (!sourceKey || sourceKey.startsWith('name:')) {
    return null;
  }

  const normalizedSourceKey = sourceKey.toLowerCase();
  const matches = contacts.filter((contact) =>
    contact.public_key.toLowerCase().startsWith(normalizedSourceKey)
  );
  if (matches.length !== 1) {
    return null;
  }

  const contact = matches[0];
  return getContactDisplayName(contact.name, contact.public_key, contact.last_advert);
}

function resolveNeighbor(item: NeighborStat, contacts: Contact[]): NeighborStat {
  return {
    ...item,
    label: resolveContactLabel(item.key, contacts) ?? item.label,
  };
}

function isNeighborIdentityResolvable(item: NeighborStat, contacts: Contact[]): boolean {
  if (item.key.startsWith('name:')) {
    return true;
  }
  return resolveContactLabel(item.key, contacts) !== null;
}

function formatStrongestPacketDetail(
  stats: ReturnType<typeof buildRawPacketStatsSnapshot>,
  contacts: Contact[]
): string | undefined {
  if (!stats.strongestPacketPayloadType) {
    return undefined;
  }

  const resolvedLabel =
    resolveContactLabel(stats.strongestPacketSourceKey, contacts) ??
    stats.strongestPacketSourceLabel;
  if (resolvedLabel) {
    return `${resolvedLabel} · ${stats.strongestPacketPayloadType}`;
  }
  if (stats.strongestPacketPayloadType === 'GroupText') {
    return '<unknown sender> · GroupText';
  }
  return stats.strongestPacketPayloadType;
}

function getCoverageMessage(
  stats: ReturnType<typeof buildRawPacketStatsSnapshot>,
  session: RawPacketStatsSessionState
): { tone: 'default' | 'warning'; message: string } {
  if (session.trimmedObservationCount > 0 && stats.window === 'session') {
    return {
      tone: 'warning',
      message: `Detailed session history was trimmed after ${session.totalObservedPackets.toLocaleString()} observations.`,
    };
  }

  if (!stats.windowFullyCovered) {
    return {
      tone: 'warning',
      message: `This window is only covered for ${formatDuration(stats.coverageSeconds)} of frontend-collected history.`,
    };
  }

  return {
    tone: 'default',
    message: `Tracking ${session.observations.length.toLocaleString()} detailed observations from this browser session.`,
  };
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="break-inside-avoid rounded-lg border border-border/70 bg-card/80 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</div>
      {detail ? <div className="mt-1 text-xs text-muted-foreground">{detail}</div> : null}
    </div>
  );
}

function RankedBars({
  title,
  items,
  emptyLabel,
  formatter,
}: {
  title: string;
  items: RankedPacketStat[];
  emptyLabel: string;
  formatter?: (item: RankedPacketStat) => string;
}) {
  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <section className="mb-4 break-inside-avoid rounded-lg border border-border/70 bg-card/70 p-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-foreground">{item.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatter
                    ? formatter(item)
                    : `${item.count.toLocaleString()} · ${formatPercent(item.share)}`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/80"
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function NeighborList({
  title,
  items,
  emptyLabel,
  mode,
  contacts,
}: {
  title: string;
  items: NeighborStat[];
  emptyLabel: string;
  mode: 'heard' | 'signal' | 'recent';
  contacts: Contact[];
}) {
  return (
    <section className="mb-4 break-inside-avoid rounded-lg border border-border/70 bg-card/70 p-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-md bg-background/70 px-2 py-1.5"
            >
              <div className="min-w-0">
                <div className="truncate text-sm text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground">
                  {mode === 'heard'
                    ? `${item.count.toLocaleString()} packets`
                    : mode === 'signal'
                      ? `${formatRssi(item.bestRssi)} best`
                      : `Last seen ${new Date(item.lastSeen * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </div>
                {!isNeighborIdentityResolvable(item, contacts) ? (
                  <div className="text-[11px] text-warning">Identity not resolvable</div>
                ) : null}
              </div>
              {mode !== 'signal' ? (
                <div className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {mode === 'recent' ? formatRssi(item.bestRssi) : formatRssi(item.bestRssi)}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TimelineChart({ bins }: { bins: PacketTimelineBin[] }) {
  const maxTotal = Math.max(...bins.map((bin) => bin.total), 1);
  const typeOrder = Array.from(new Set(bins.flatMap((bin) => Object.keys(bin.countsByType)))).slice(
    0,
    TIMELINE_COLORS.length
  );

  return (
    <section className="mb-4 break-inside-avoid rounded-lg border border-border/70 bg-card/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Traffic Timeline</h3>
        <div className="flex flex-wrap justify-end gap-2 text-[11px] text-muted-foreground">
          {typeOrder.map((type, index) => (
            <span key={type} className="inline-flex items-center gap-1">
              <span className={cn('h-2 w-2 rounded-full', TIMELINE_COLORS[index])} />
              <span>{type}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-start gap-1">
        {bins.map((bin, index) => (
          <div
            key={`${bin.label}-${index}`}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
          >
            <div className="flex h-24 w-full items-end overflow-hidden rounded-sm bg-muted/60">
              <div className="flex h-full w-full flex-col justify-end">
                {typeOrder.map((type, index) => {
                  const count = bin.countsByType[type] ?? 0;
                  if (count === 0) return null;
                  return (
                    <div
                      key={type}
                      className={cn('w-full', TIMELINE_COLORS[index])}
                      style={{
                        height: `${(count / maxTotal) * 100}%`,
                      }}
                      title={`${bin.label}: ${type} ${count.toLocaleString()}`}
                    />
                  );
                })}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground">{bin.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RawPacketFeedView({
  packets,
  rawPacketStatsSession,
  contacts,
  channels,
}: RawPacketFeedViewProps) {
  const [statsOpen, setStatsOpen] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 768px)').matches
      : false
  );
  const [selectedWindow, setSelectedWindow] = useState<RawPacketStatsWindow>('10m');
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [selectedPacket, setSelectedPacket] = useState<RawPacket | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setNowSec(Math.floor(Date.now() / 1000));
  }, [packets, rawPacketStatsSession]);

  const stats = useMemo(
    () => buildRawPacketStatsSnapshot(rawPacketStatsSession, selectedWindow, nowSec),
    [nowSec, rawPacketStatsSession, selectedWindow]
  );
  const coverageMessage = getCoverageMessage(stats, rawPacketStatsSession);
  const strongestPacketDetail = useMemo(
    () => formatStrongestPacketDetail(stats, contacts),
    [contacts, stats]
  );
  const strongestNeighbors = useMemo(
    () => stats.strongestNeighbors.map((item) => resolveNeighbor(item, contacts)),
    [contacts, stats.strongestNeighbors]
  );
  const mostActiveNeighbors = useMemo(
    () => stats.mostActiveNeighbors.map((item) => resolveNeighbor(item, contacts)),
    [contacts, stats.mostActiveNeighbors]
  );
  const newestNeighbors = useMemo(
    () => stats.newestNeighbors.map((item) => resolveNeighbor(item, contacts)),
    [contacts, stats.newestNeighbors]
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div>
          <h2 className="font-semibold text-base text-foreground">Raw Packet Feed</h2>
          <p className="text-xs text-muted-foreground">
            Collecting stats since {formatTimestamp(rawPacketStatsSession.sessionStartedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStatsOpen((current) => !current)}
          aria-expanded={statsOpen}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {statsOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {statsOpen ? 'Hide Stats' : 'Show Stats'}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className={cn('min-h-0 min-w-0 flex-1', statsOpen && 'md:border-r md:border-border')}>
          <RawPacketList packets={packets} channels={channels} onPacketClick={setSelectedPacket} />
        </div>

        <aside
          className={cn(
            'shrink-0 overflow-hidden border-t border-border transition-all duration-300 md:border-l md:border-t-0',
            statsOpen
              ? 'max-h-[42rem] md:max-h-none md:w-1/2 md:min-w-[30rem]'
              : 'max-h-0 md:w-0 md:min-w-0 border-transparent'
          )}
        >
          {statsOpen ? (
            <div className="h-full overflow-y-auto bg-background p-4 [contain:layout_paint]">
              <div className="break-inside-avoid rounded-lg border border-border/70 bg-card/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Coverage
                    </div>
                    <div
                      className={cn(
                        'mt-1 text-sm',
                        coverageMessage.tone === 'warning'
                          ? 'text-warning'
                          : 'text-muted-foreground'
                      )}
                    >
                      {coverageMessage.message}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <span className="text-muted-foreground">Window</span>
                    <select
                      value={selectedWindow}
                      onChange={(event) =>
                        setSelectedWindow(event.target.value as RawPacketStatsWindow)
                      }
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                      aria-label="Stats window"
                    >
                      {RAW_PACKET_STATS_WINDOWS.map((option) => (
                        <option key={option} value={option}>
                          {WINDOW_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {stats.packetCount.toLocaleString()} packets in{' '}
                  {WINDOW_LABELS[selectedWindow].toLowerCase()} window
                  {' · '}
                  {rawPacketStatsSession.totalObservedPackets.toLocaleString()} observed this
                  session
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                <StatTile
                  label="Packets / min"
                  value={formatRate(stats.packetsPerMinute)}
                  detail={`${stats.packetCount.toLocaleString()} total in window`}
                />
                <StatTile
                  label="Unique Sources"
                  value={stats.uniqueSources.toLocaleString()}
                  detail="Distinct identified senders"
                />
                <StatTile
                  label="Decrypt Rate"
                  value={formatPercent(stats.decryptRate)}
                  detail={`${stats.decryptedCount.toLocaleString()} decrypted / ${stats.undecryptedCount.toLocaleString()} locked`}
                />
                <StatTile
                  label="Path Diversity"
                  value={stats.distinctPaths.toLocaleString()}
                  detail={`${formatPercent(stats.pathBearingRate)} path-bearing packets`}
                />
                <StatTile
                  label="Best RSSI"
                  value={formatRssi(stats.bestRssi)}
                  detail={strongestPacketDetail ?? 'No signal sample in window'}
                />
                <StatTile
                  label="Median RSSI"
                  value={formatRssi(stats.medianRssi)}
                  detail={
                    stats.averageRssi === null
                      ? 'No signal sample in window'
                      : `Average ${formatRssi(stats.averageRssi)}`
                  }
                />
              </div>

              <div className="mt-4">
                <TimelineChart bins={stats.timeline} />
              </div>

              <div className="md:columns-2 md:gap-4">
                <RankedBars
                  title="Packet Types"
                  items={stats.payloadBreakdown}
                  emptyLabel="No packets in this window yet."
                />

                <RankedBars
                  title="Route Mix"
                  items={stats.routeBreakdown}
                  emptyLabel="No packets in this window yet."
                />

                <RankedBars
                  title="Hop Profile"
                  items={stats.hopProfile}
                  emptyLabel="No packets in this window yet."
                />

                <RankedBars
                  title="Hop Byte Width"
                  items={stats.hopByteWidthProfile}
                  emptyLabel="No packets in this window yet."
                />

                <RankedBars
                  title="Signal Distribution"
                  items={stats.rssiBuckets}
                  emptyLabel="No RSSI samples in this window yet."
                />

                <NeighborList
                  title="Most-Heard Neighbors"
                  items={mostActiveNeighbors}
                  emptyLabel="No sender identities resolved in this window yet."
                  mode="heard"
                  contacts={contacts}
                />

                <NeighborList
                  title="Strongest Recent Neighbors"
                  items={strongestNeighbors}
                  emptyLabel="No RSSI-tagged neighbors in this window yet."
                  mode="signal"
                  contacts={contacts}
                />

                <NeighborList
                  title="Newest Heard Neighbors"
                  items={newestNeighbors}
                  emptyLabel="No newly identified neighbors in this window yet."
                  mode="recent"
                  contacts={contacts}
                />
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <RawPacketDetailModal
        packet={selectedPacket}
        channels={channels}
        onClose={() => setSelectedPacket(null)}
      />
    </>
  );
}
