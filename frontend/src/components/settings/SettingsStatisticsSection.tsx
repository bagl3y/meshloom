import { useState, useEffect } from 'react';
import { Separator } from '../ui/separator';
import { api } from '../../api';
import type { StatisticsResponse } from '../../types';

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function SettingsStatisticsSection({ className }: { className?: string }) {
  const [stats, setStats] = useState<StatisticsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    setStatsError(false);
    api.getStatistics().then(
      (data) => {
        if (!cancelled) {
          setStats(data);
          setStatsLoading(false);
        }
      },
      () => {
        if (!cancelled) {
          setStatsError(true);
          setStatsLoading(false);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={className}>
      {statsLoading && !stats ? (
        <div className="py-8 text-center text-muted-foreground">
          Loading statistics... this can take a while if you have a lot of stored packets.
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Network */}
          <div>
            <h4 className="text-sm font-medium mb-2">Network</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <div className="text-2xl font-bold">{stats.contact_count}</div>
                <div className="text-xs text-muted-foreground">Contacts</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <div className="text-2xl font-bold">{stats.repeater_count}</div>
                <div className="text-xs text-muted-foreground">Repeaters</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <div className="text-2xl font-bold">{stats.channel_count}</div>
                <div className="text-xs text-muted-foreground">Channels</div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Messages */}
          <div>
            <h4 className="text-sm font-medium mb-2">Messages</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <div className="text-2xl font-bold">{stats.total_dms}</div>
                <div className="text-xs text-muted-foreground">Direct Messages</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <div className="text-2xl font-bold">{stats.total_channel_messages}</div>
                <div className="text-xs text-muted-foreground">Channel Messages</div>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <div className="text-2xl font-bold">{stats.total_outgoing}</div>
                <div className="text-xs text-muted-foreground">Sent (Outgoing)</div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Packets */}
          <div>
            <h4 className="text-sm font-medium mb-2">Packets</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total stored</span>
                <span className="font-medium">{stats.total_packets}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-success">Decrypted</span>
                <span className="font-medium text-success">{stats.decrypted_packets}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-warning">Undecrypted</span>
                <span className="font-medium text-warning">{stats.undecrypted_packets}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-2">Path Hash Width (24h)</h4>
            <div className="mb-2 text-xs text-muted-foreground">
              Parsed stored raw packets from the last 24 hours:{' '}
              {stats.path_hash_width_24h.total_packets}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span>1-byte hops</span>
                <span className="text-muted-foreground">
                  {stats.path_hash_width_24h.single_byte} (
                  {formatPercent(stats.path_hash_width_24h.single_byte_pct)})
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>2-byte hops</span>
                <span className="text-muted-foreground">
                  {stats.path_hash_width_24h.double_byte} (
                  {formatPercent(stats.path_hash_width_24h.double_byte_pct)})
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>3-byte hops</span>
                <span className="text-muted-foreground">
                  {stats.path_hash_width_24h.triple_byte} (
                  {formatPercent(stats.path_hash_width_24h.triple_byte_pct)})
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Activity */}
          <div>
            <h4 className="text-sm font-medium mb-2">Activity</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left font-normal pb-1"></th>
                  <th className="text-right font-normal pb-1">1h</th>
                  <th className="text-right font-normal pb-1">24h</th>
                  <th className="text-right font-normal pb-1">7d</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1">Contacts heard</td>
                  <td className="text-right py-1">{stats.contacts_heard.last_hour}</td>
                  <td className="text-right py-1">{stats.contacts_heard.last_24_hours}</td>
                  <td className="text-right py-1">{stats.contacts_heard.last_week}</td>
                </tr>
                <tr>
                  <td className="py-1">Repeaters heard</td>
                  <td className="text-right py-1">{stats.repeaters_heard.last_hour}</td>
                  <td className="text-right py-1">{stats.repeaters_heard.last_24_hours}</td>
                  <td className="text-right py-1">{stats.repeaters_heard.last_week}</td>
                </tr>
                <tr>
                  <td className="py-1">Known-channels active</td>
                  <td className="text-right py-1">{stats.known_channels_active.last_hour}</td>
                  <td className="text-right py-1">{stats.known_channels_active.last_24_hours}</td>
                  <td className="text-right py-1">{stats.known_channels_active.last_week}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Busiest Channels */}
          {stats.busiest_channels_24h.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Busiest Channels (24h)</h4>
                <div className="space-y-1">
                  {stats.busiest_channels_24h.map((ch, i) => (
                    <div key={ch.channel_key} className="flex justify-between items-center text-sm">
                      <span>
                        <span className="text-muted-foreground mr-2">{i + 1}.</span>
                        {ch.channel_name}
                      </span>
                      <span className="text-muted-foreground">{ch.message_count} msgs</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : statsError ? (
        <div className="py-8 text-center text-muted-foreground">Failed to load statistics.</div>
      ) : null}
    </div>
  );
}
