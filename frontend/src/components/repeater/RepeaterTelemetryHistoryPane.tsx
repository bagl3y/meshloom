import { useState, useMemo, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Brush,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { lppDisplayUnit } from './repeaterPaneShared';
import { useDistanceUnit } from '../../contexts/DistanceUnitContext';
import type { TelemetryHistoryEntry, TelemetryLppSensor, Contact } from '../../types';

const MAX_TRACKED = 8;

type BuiltinMetric =
  | 'battery_volts'
  | 'noise_floor_dbm'
  | 'packets'
  | 'recv_errors'
  | 'uptime_seconds';

interface MetricConfig {
  label: string;
  unit: string;
  color: string;
}

const BUILTIN_METRIC_CONFIG: Record<BuiltinMetric, MetricConfig> = {
  battery_volts: { label: 'Voltage', unit: 'V', color: '#22c55e' },
  noise_floor_dbm: { label: 'Noise Floor', unit: 'dBm', color: '#8b5cf6' },
  packets: { label: 'Packets', unit: '', color: '#0ea5e9' },
  recv_errors: { label: 'RX Errors', unit: '', color: '#ef4444' },
  uptime_seconds: { label: 'Uptime', unit: 's', color: '#f59e0b' },
};

const BUILTIN_METRICS: BuiltinMetric[] = Object.keys(BUILTIN_METRIC_CONFIG) as BuiltinMetric[];

// Stable color rotation for dynamic LPP sensors
const LPP_COLORS = ['#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#e11d48'];

/** Assign disambiguated flat keys to an array of LPP sensors.
 *  First occurrence keeps the base key; duplicates of the same (type, channel) get _2, _3, etc. */
function assignLppKeys(
  sensors: TelemetryLppSensor[]
): { sensor: TelemetryLppSensor; key: string; occurrence: number }[] {
  const counts = new Map<string, number>();
  return sensors.map((s) => {
    const base = `lpp_${s.type_name}_ch${s.channel}`;
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    return { sensor: s, key: n === 1 ? base : `${base}_${n}`, occurrence: n };
  });
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

/** Collect all numeric values for the given keys across a set of chart points. */
function collectValues(data: Array<Record<string, number | undefined>>, keys: string[]): number[] {
  const out: number[] = [];
  for (const d of data) {
    for (const k of keys) {
      const v = d[k];
      if (typeof v === 'number' && Number.isFinite(v)) out.push(v);
    }
  }
  return out;
}

/** Bound a Y axis to the data range padded by 10% on each side.
 *  Returns undefined (recharts auto-domain) when there is nothing to plot. */
function paddedDomain(values: number[]): [number, number] | undefined {
  if (values.length === 0) return undefined;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo;
  // Flat series (single value / no spread): pad relative to magnitude so the
  // line doesn't sit on a degenerate zero-height axis.
  const pad = span === 0 ? Math.abs(lo) * 0.1 || 1 : span * 0.1;
  return [lo - pad, hi + pad];
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
  const { distanceUnit } = useDistanceUnit();
  const [metric, setMetric] = useState<string>('battery_volts');
  const [toggling, setToggling] = useState(false);
  const [brushRange, setBrushRange] = useState<{ start: number; end: number } | null>(null);

  // Reset the zoom window when switching to a different repeater.
  useEffect(() => {
    setBrushRange(null);
  }, [publicKey]);

  const isTracked = trackedTelemetryRepeaters.includes(publicKey);
  const slotsFull = trackedTelemetryRepeaters.length >= MAX_TRACKED && !isTracked;

  // Discover unique LPP sensors across all history entries
  const lppMetrics = useMemo(() => {
    const seen = new Map<string, { type_name: string; channel: number; occurrence: number }>();
    for (const e of entries) {
      for (const { sensor: s, key: k, occurrence } of assignLppKeys(e.data.lpp_sensors ?? [])) {
        if (!seen.has(k)) seen.set(k, { type_name: s.type_name, channel: s.channel, occurrence });
      }
    }
    const result: { key: string; config: MetricConfig; type_name: string; channel: number }[] = [];
    let colorIdx = 0;
    for (const [k, info] of seen) {
      const label =
        info.type_name.charAt(0).toUpperCase() +
        info.type_name.slice(1).replace(/_/g, ' ') +
        ` Ch${info.channel}` +
        (info.occurrence > 1 ? ` (${info.occurrence})` : '');
      const { unit } = lppDisplayUnit(info.type_name, 0, distanceUnit);
      result.push({
        key: k,
        config: { label, unit, color: LPP_COLORS[colorIdx % LPP_COLORS.length] },
        type_name: info.type_name,
        channel: info.channel,
      });
      colorIdx++;
    }
    return result;
  }, [entries, distanceUnit]);

  const allMetricKeys = useMemo(
    () => [...BUILTIN_METRICS, ...lppMetrics.map((m) => m.key)],
    [lppMetrics]
  );

  // If the selected metric disappears (e.g. different repeater), reset to default
  const activeMetric = allMetricKeys.includes(metric) ? metric : 'battery_volts';

  const isBuiltin = BUILTIN_METRICS.includes(activeMetric as BuiltinMetric);
  const activeConfig: MetricConfig = useMemo(
    () =>
      isBuiltin
        ? BUILTIN_METRIC_CONFIG[activeMetric as BuiltinMetric]
        : (lppMetrics.find((m) => m.key === activeMetric)?.config ?? {
            label: activeMetric,
            unit: '',
            color: '#888',
          }),
    [isBuiltin, activeMetric, lppMetrics]
  );

  const chartData = useMemo(() => {
    // Sort chronologically so per-sample deltas compare against the true
    // predecessor (entries are not guaranteed ordered by the API).
    const ordered = [...entries].sort((a, b) => a.timestamp - b.timestamp);
    let prevRecv: number | undefined;
    let prevSent: number | undefined;
    return ordered.map((e) => {
      const d = e.data;
      const recvErrors = d.recv_errors ?? undefined;
      const packetsReceived = d.packets_received;
      const packetsSent = d.packets_sent;
      // Per-sample deltas off the cumulative lifetime counters. A drop
      // (counter < previous) means the repeater rebooted and reset its
      // counters, so we emit no delta for that sample rather than a large
      // negative spike. The first sample has no predecessor, so no delta.
      const recvDelta =
        prevRecv != null && packetsReceived != null && packetsReceived >= prevRecv
          ? packetsReceived - prevRecv
          : undefined;
      const sentDelta =
        prevSent != null && packetsSent != null && packetsSent >= prevSent
          ? packetsSent - prevSent
          : undefined;
      if (packetsReceived != null) prevRecv = packetsReceived;
      if (packetsSent != null) prevSent = packetsSent;
      const point: Record<string, number | undefined> = {
        timestamp: e.timestamp,
        battery_volts: d.battery_volts,
        noise_floor_dbm: d.noise_floor_dbm,
        packets_received: packetsReceived,
        packets_sent: packetsSent,
        packets_received_delta: recvDelta,
        packets_sent_delta: sentDelta,
        recv_errors: recvErrors,
        recv_error_pct:
          recvErrors != null && packetsReceived != null && packetsReceived + recvErrors > 0
            ? +((recvErrors / (packetsReceived + recvErrors)) * 100).toFixed(2)
            : undefined,
        uptime_seconds: d.uptime_seconds,
      };
      // Flatten LPP sensors into the point, converting units as needed
      for (const { sensor: s, key } of assignLppKeys(d.lpp_sensors ?? [])) {
        if (typeof s.value === 'number') {
          point[key] = lppDisplayUnit(s.type_name, s.value, distanceUnit).value;
        }
      }
      return point;
    });
  }, [entries, distanceUnit]);

  // Series descriptors drive axes, colors, labels, and tooltip formatting.
  // Cumulative counters render as filled areas on the left axis; derived
  // per-sample deltas render as gapped lines on a secondary right axis.
  const series = useMemo(() => {
    if (activeMetric === 'packets') {
      return [
        {
          key: 'packets_received',
          color: '#0ea5e9',
          axis: 'left' as const,
          line: false,
          label: 'Received',
        },
        {
          key: 'packets_sent',
          color: '#f43f5e',
          axis: 'left' as const,
          line: false,
          label: 'Sent',
        },
        {
          key: 'packets_received_delta',
          color: '#14b8a6',
          axis: 'right' as const,
          line: true,
          label: 'Received Δ',
        },
        {
          key: 'packets_sent_delta',
          color: '#f59e0b',
          axis: 'right' as const,
          line: true,
          label: 'Sent Δ',
        },
      ];
    }
    if (activeMetric === 'recv_errors') {
      return [
        {
          key: 'recv_errors',
          color: '#ef4444',
          axis: 'left' as const,
          line: false,
          label: 'RX Errors',
        },
        {
          key: 'recv_error_pct',
          color: '#f59e0b',
          axis: 'right' as const,
          line: false,
          label: 'Error Rate',
        },
      ];
    }
    return [
      {
        key: activeMetric,
        color: activeConfig.color,
        axis: 'left' as const,
        line: false,
        label: activeConfig.label,
      },
    ];
  }, [activeMetric, activeConfig]);

  const leftKeys = useMemo(
    () => series.filter((s) => s.axis === 'left').map((s) => s.key),
    [series]
  );
  const rightKeys = useMemo(
    () => series.filter((s) => s.axis === 'right').map((s) => s.key),
    [series]
  );

  // Brush-controlled viewport. Indices are clamped to the current data length
  // so a stale range from a previous repeater can never index out of bounds.
  const lastIndex = Math.max(0, chartData.length - 1);
  const brushStart = brushRange ? Math.min(brushRange.start, lastIndex) : 0;
  const brushEnd = brushRange ? Math.min(brushRange.end, lastIndex) : lastIndex;

  const visibleData = useMemo(
    () => chartData.slice(brushStart, brushEnd + 1),
    [chartData, brushStart, brushEnd]
  );

  // Y extents bound to the visible window so zooming re-tightens the axis.
  const leftDomain = useMemo(
    () => paddedDomain(collectValues(visibleData, leftKeys)),
    [visibleData, leftKeys]
  );
  const rightDomain = useMemo(
    () => (rightKeys.length ? paddedDomain(collectValues(visibleData, rightKeys)) : undefined),
    [visibleData, rightKeys]
  );

  const handleBrushChange = (range: { startIndex?: number; endIndex?: number }) => {
    if (typeof range.startIndex === 'number' && typeof range.endIndex === 'number') {
      setBrushRange({ start: range.startIndex, end: range.endIndex });
    }
  };

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
            repeater will be polled for metrics automatically. Fetch frequency can be configured in{' '}
            <a
              href="#settings/radio-app"
              className="underline text-primary hover:text-primary/80 transition-colors"
            >
              Settings &rarr; Radio-App Management
            </a>
            , where you can also see which repeaters are currently opted in. A maximum of{' '}
            {MAX_TRACKED} repeaters may be opted into this for the sake of keeping mesh congestion
            reasonable.
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
              {toggling ? 'Updating...' : 'Opt Repeater into Interval Metrics Tracking'}
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
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart
              data={chartData}
              margin={{
                top: 4,
                right: rightKeys.length ? 8 : 4,
                bottom: 0,
                left: -8,
              }}
            >
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
                yAxisId="left"
                domain={leftDomain}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) =>
                  activeMetric === 'uptime_seconds' ? formatUptime(v) : `${v}`
                }
              />
              {rightKeys.length > 0 && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={rightDomain}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (activeMetric === 'recv_errors' ? `${v}%` : `${v}`)}
                />
              )}
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
                  const s = series.find((x) => x.key === name);
                  const label = s?.label ?? String(name);
                  const numVal = typeof value === 'number' ? value : Number(value);
                  if (name === 'recv_error_pct') return [`${numVal}%`, label];
                  if (activeMetric === 'uptime_seconds') return [formatUptime(numVal), label];
                  const suffix =
                    activeConfig.unit &&
                    activeMetric !== 'packets' &&
                    activeMetric !== 'recv_errors'
                      ? ` ${activeConfig.unit}`
                      : '';
                  return [`${value}${suffix}`, label];
                }}
              />
              {series.map((s) => (
                <Area
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  yAxisId={s.axis}
                  connectNulls={false}
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={s.line ? 0 : 0.15}
                  strokeWidth={1.5}
                  dot={{
                    r: 4,
                    fill: s.color,
                    strokeWidth: 1.5,
                    stroke: 'hsl(var(--popover))',
                  }}
                  activeDot={{
                    r: 6,
                    fill: s.color,
                    strokeWidth: 2,
                    stroke: 'hsl(var(--popover))',
                  }}
                />
              ))}
              {chartData.length > 2 && (
                <Brush
                  dataKey="timestamp"
                  height={22}
                  travellerWidth={8}
                  stroke="hsl(var(--muted-foreground))"
                  fill="hsl(var(--muted))"
                  tickFormatter={(ts) => formatTime(Number(ts))}
                  startIndex={brushStart}
                  endIndex={brushEnd}
                  onChange={handleBrushChange}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
