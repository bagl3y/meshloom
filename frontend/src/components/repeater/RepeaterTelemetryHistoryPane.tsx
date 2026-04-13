import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { LPP_UNIT_MAP } from './repeaterPaneShared';
import type { TelemetryHistoryEntry, TelemetryLppSensor, Contact } from '../../types';

const MAX_TRACKED = 8;

type BuiltinMetric = 'battery_volts' | 'noise_floor_dbm' | 'packets' | 'uptime_seconds';

interface MetricConfig {
  label: string;
  unit: string;
  color: string;
}

const BUILTIN_METRIC_CONFIG: Record<BuiltinMetric, MetricConfig> = {
  battery_volts: { label: 'Voltage', unit: 'V', color: '#22c55e' },
  noise_floor_dbm: { label: 'Noise Floor', unit: 'dBm', color: '#8b5cf6' },
  packets: { label: 'Packets', unit: '', color: '#0ea5e9' },
  uptime_seconds: { label: 'Uptime', unit: 's', color: '#f59e0b' },
};

const BUILTIN_METRICS: BuiltinMetric[] = Object.keys(BUILTIN_METRIC_CONFIG) as BuiltinMetric[];

// Stable color rotation for dynamic LPP sensors
const LPP_COLORS = ['#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#e11d48'];

/** Build a flat data key for an LPP sensor: lpp_{type_name}_ch{channel} */
function lppKey(s: TelemetryLppSensor): string {
  return `lpp_${s.type_name}_ch${s.channel}`;
}

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '6px',
    fontSize: '11px',
    color: 'hsl(var(--popover-foreground))',
  },
  itemStyle: { color: 'hsl(var(--popover-foreground))' },
  labelStyle: { color: 'hsl(var(--muted-foreground))' },
} as const;

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatUptime(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

interface TelemetryHistoryPaneProps {
  entries: TelemetryHistoryEntry[];
  publicKey: string;
  contacts: Contact[];
  trackedTelemetryRepeaters: string[];
  onToggleTrackedTelemetry: (publicKey: string) => Promise<void>;
}

export function TelemetryHistoryPane({
  entries,
  publicKey,
  contacts,
  trackedTelemetryRepeaters,
  onToggleTrackedTelemetry,
}: TelemetryHistoryPaneProps) {
  const [metric, setMetric] = useState<string>('battery_volts');
  const [toggling, setToggling] = useState(false);

  const isTracked = trackedTelemetryRepeaters.includes(publicKey);
  const slotsFull = trackedTelemetryRepeaters.length >= MAX_TRACKED && !isTracked;

  // Discover unique LPP sensors across all history entries
  const lppMetrics = useMemo(() => {
    const seen = new Map<string, { type_name: string; channel: number }>();
    for (const e of entries) {
      for (const s of e.data.lpp_sensors ?? []) {
        const k = lppKey(s);
        if (!seen.has(k)) seen.set(k, { type_name: s.type_name, channel: s.channel });
      }
    }
    const result: { key: string; config: MetricConfig; type_name: string; channel: number }[] = [];
    let colorIdx = 0;
    for (const [k, info] of seen) {
      const label =
        info.type_name.charAt(0).toUpperCase() +
        info.type_name.slice(1).replace(/_/g, ' ') +
        ` Ch${info.channel}`;
      const unit = LPP_UNIT_MAP[info.type_name] ?? '';
      result.push({
        key: k,
        config: { label, unit, color: LPP_COLORS[colorIdx % LPP_COLORS.length] },
        type_name: info.type_name,
        channel: info.channel,
      });
      colorIdx++;
    }
    return result;
  }, [entries]);

  const allMetricKeys = useMemo(
    () => [...BUILTIN_METRICS, ...lppMetrics.map((m) => m.key)],
    [lppMetrics]
  );

  // If the selected metric disappears (e.g. different repeater), reset to default
  const activeMetric = allMetricKeys.includes(metric) ? metric : 'battery_volts';

  const isBuiltin = BUILTIN_METRICS.includes(activeMetric as BuiltinMetric);
  const activeConfig: MetricConfig = isBuiltin
    ? BUILTIN_METRIC_CONFIG[activeMetric as BuiltinMetric]
    : (lppMetrics.find((m) => m.key === activeMetric)?.config ?? {
        label: activeMetric,
        unit: '',
        color: '#888',
      });

  const chartData = useMemo(() => {
    return entries.map((e) => {
      const d = e.data;
      const point: Record<string, number | undefined> = {
        timestamp: e.timestamp,
        battery_volts: d.battery_volts,
        noise_floor_dbm: d.noise_floor_dbm,
        packets_received: d.packets_received,
        packets_sent: d.packets_sent,
        uptime_seconds: d.uptime_seconds,
      };
      // Flatten LPP sensors into the point
      for (const s of d.lpp_sensors ?? []) {
        point[lppKey(s)] = typeof s.value === 'number' ? s.value : undefined;
      }
      return point;
    });
  }, [entries]);

  const dataKeys =
    activeMetric === 'packets' ? ['packets_received', 'packets_sent'] : [activeMetric];

  const yDomain = useMemo<[number, number] | undefined>(() => {
    if (activeMetric !== 'battery_volts' || chartData.length === 0) return undefined;
    const values = chartData.map((d) => d.battery_volts).filter((v) => v != null) as number[];
    if (values.length === 0) return [3, 5];
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    return [Math.min(3, Math.floor(lo) - 1), Math.max(5, Math.ceil(hi) + 1)];
  }, [activeMetric, chartData]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      await onToggleTrackedTelemetry(publicKey);
    } finally {
      setToggling(false);
    }
  };

  const trackedNames = useMemo(() => {
    if (!slotsFull) return [];
    return trackedTelemetryRepeaters.map((key) => {
      const contact = contacts.find((c) => c.public_key === key);
      return { key, name: contact?.name ?? key.slice(0, 12) };
    });
  }, [slotsFull, trackedTelemetryRepeaters, contacts]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Telemetry History</h3>
          {entries.length > 0 && (
            <span className="text-[0.625rem] text-muted-foreground">{entries.length} samples</span>
          )}
        </div>
      </div>
      <div className="p-3">
        {/* Explanation + tracking toggle */}
        <div className="mb-3 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Any time repeater telemetry is fetched, the metrics are stored for 30 days (or 1,000
            samples, whichever comes first). This telemetry is stored on normal interactive fetches
            via the repeater pane, API calls to the endpoint (
            <code className="text-[0.6875rem]">POST /api/contacts/&lt;key&gt;/repeater/status</code>
            ), or when the repeater is opted into interval telemetry polling, in which case the
            repeater will be polled for metrics every 8 hours. You can see which repeaters are opted
            into this flow in the{' '}
            <a
              href="#settings/database"
              className="underline text-primary hover:text-primary/80 transition-colors"
            >
              Database &amp; Messaging
            </a>{' '}
            settings pane. A maximum of {MAX_TRACKED} repeaters may be opted into this for the sake
            of keeping mesh congestion reasonable.
          </p>

          {isTracked ? (
            <Button
              variant="outline"
              onClick={handleToggle}
              disabled={toggling}
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
            >
              {toggling ? 'Updating...' : 'Remove Repeater from Interval Metrics Tracking'}
            </Button>
          ) : slotsFull ? (
            <div className="space-y-2">
              <Button variant="outline" disabled>
                Tracking Full ({trackedTelemetryRepeaters.length}/{MAX_TRACKED} slots used)
              </Button>
              <p className="text-xs text-muted-foreground">
                Disable tracking on another repeater to free a slot:{' '}
                {trackedNames.map((t) => t.name).join(', ')}
              </p>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={handleToggle}
              disabled={toggling}
              className="border-green-600/50 text-green-600 hover:bg-green-600/10"
            >
              {toggling ? 'Updating...' : 'Opt Repeater into 8hr Interval Metrics Tracking'}
            </Button>
          )}
        </div>

        <Separator className="mb-3" />

        {/* Metric selector */}
        <div className="flex flex-wrap gap-1 mb-2">
          {BUILTIN_METRICS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={cn(
                'text-[0.6875rem] px-2 py-0.5 rounded transition-colors',
                activeMetric === m
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {BUILTIN_METRIC_CONFIG[m].label}
            </button>
          ))}
          {lppMetrics.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={cn(
                'text-[0.6875rem] px-2 py-0.5 rounded transition-colors',
                activeMetric === m.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {m.config.label}
            </button>
          ))}
        </div>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No history yet. Fetch status above to record data points.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={['dataMin', 'dataMax']}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatTime}
              />
              <YAxis
                domain={yDomain}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) =>
                  activeMetric === 'uptime_seconds' ? formatUptime(v) : `${v}`
                }
              />
              <RechartsTooltip
                {...TOOLTIP_STYLE}
                cursor={{
                  stroke: 'hsl(var(--muted-foreground))',
                  strokeWidth: 1,
                  strokeDasharray: '3 3',
                }}
                labelFormatter={(ts) => formatTime(Number(ts))}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => {
                  const numVal = typeof value === 'number' ? value : Number(value);
                  const display =
                    activeMetric === 'uptime_seconds' ? formatUptime(numVal) : `${value}`;
                  const suffix =
                    activeMetric === 'uptime_seconds'
                      ? ''
                      : activeConfig.unit
                        ? ` ${activeConfig.unit}`
                        : '';
                  const label =
                    activeMetric === 'packets'
                      ? name === 'packets_received'
                        ? 'Received'
                        : 'Sent'
                      : activeConfig.label;
                  return [`${display}${suffix}`, label];
                }}
              />
              {dataKeys.map((key, i) => (
                <Area
                  key={key}
                  type="linear"
                  dataKey={key}
                  stroke={
                    activeMetric === 'packets'
                      ? i === 0
                        ? '#0ea5e9'
                        : '#f43f5e'
                      : activeConfig.color
                  }
                  fill={
                    activeMetric === 'packets'
                      ? i === 0
                        ? '#0ea5e9'
                        : '#f43f5e'
                      : activeConfig.color
                  }
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                  dot={{
                    r: 4,
                    fill:
                      activeMetric === 'packets'
                        ? i === 0
                          ? '#0ea5e9'
                          : '#f43f5e'
                        : activeConfig.color,
                    strokeWidth: 1.5,
                    stroke: 'hsl(var(--popover))',
                  }}
                  activeDot={{
                    r: 6,
                    fill:
                      activeMetric === 'packets'
                        ? i === 0
                          ? '#0ea5e9'
                          : '#f43f5e'
                        : activeConfig.color,
                    strokeWidth: 2,
                    stroke: 'hsl(var(--popover))',
                  }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
