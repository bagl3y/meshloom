import { useEffect, useRef, useState, useCallback } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { api } from '../../api';
import { cn } from '@/lib/utils';
import type { TelemetryHistoryEntry } from '../../types';

type TimeRange = 24 | 168 | 720;

const RANGE_LABELS: Record<TimeRange, string> = {
  24: '24h',
  168: '7d',
  720: '30d',
};

export function BatteryHistoryPane({
  publicKey,
  isTracked,
  onToggleTracking,
  statusFetchedAt,
}: {
  publicKey: string;
  isTracked: boolean;
  onToggleTracking: () => void;
  statusFetchedAt?: number | null;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  const [entries, setEntries] = useState<TelemetryHistoryEntry[] | null>(null);
  const [range, setRange] = useState<TimeRange>(168);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(
    async (hours: TimeRange) => {
      setLoading(true);
      setError(null);
      try {
        const resp = await api.repeaterTelemetryHistory(publicKey, hours);
        setEntries(resp.entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setLoading(false);
      }
    },
    [publicKey]
  );

  useEffect(() => {
    fetchHistory(range);
  }, [fetchHistory, range, statusFetchedAt]);

  // Build / rebuild chart
  useEffect(() => {
    if (!chartRef.current || !entries || entries.length === 0) {
      if (uplotRef.current) {
        uplotRef.current.destroy();
        uplotRef.current = null;
      }
      return;
    }

    const timestamps = entries.map((e) => e.timestamp);
    const volts = entries.map((e) => e.battery_volts);

    const data: uPlot.AlignedData = [timestamps, volts];

    // Get CSS variable colors for dark-theme compat
    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--foreground').trim() || '#a1a1aa';
    const gridColor = style.getPropertyValue('--border').trim() || '#27272a';
    const accentColor = '#22c55e'; // green-500

    // Resolve oklch/hsl CSS colors to a usable format
    const resolvedText = `hsl(${textColor})`;
    const resolvedGrid = `hsl(${gridColor})`;

    const opts: uPlot.Options = {
      width: chartRef.current.clientWidth,
      height: 180,
      cursor: { show: true },
      legend: { show: false },
      padding: [8, 8, 0, 0],
      axes: [
        {
          stroke: resolvedText,
          grid: { stroke: resolvedGrid, width: 1 },
          ticks: { stroke: resolvedGrid, width: 1 },
          font: '10px sans-serif',
          space: 60,
        },
        {
          stroke: resolvedText,
          grid: { stroke: resolvedGrid, width: 1 },
          ticks: { stroke: resolvedGrid, width: 1 },
          font: '10px sans-serif',
          label: 'Volts',
          labelFont: '10px sans-serif',
          size: 50,
        },
      ],
      series: [
        {},
        {
          label: 'Battery',
          stroke: accentColor,
          width: 2,
          points: { show: entries.length < 50, size: 4 },
        },
      ],
    };

    if (uplotRef.current) {
      uplotRef.current.destroy();
    }

    uplotRef.current = new uPlot(opts, data, chartRef.current);

    return () => {
      if (uplotRef.current) {
        uplotRef.current.destroy();
        uplotRef.current = null;
      }
    };
  }, [entries]);

  // Resize handler
  useEffect(() => {
    if (!chartRef.current || !uplotRef.current) return;

    const observer = new ResizeObserver(() => {
      if (uplotRef.current && chartRef.current) {
        uplotRef.current.setSize({
          width: chartRef.current.clientWidth,
          height: 180,
        });
      }
    });
    observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, [entries]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <h3 className="text-sm font-medium">Battery History</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleTracking}
            className={cn(
              'text-[11px] px-2 py-0.5 rounded-full border transition-colors',
              isTracked
                ? 'bg-success/15 border-success/30 text-success'
                : 'bg-muted border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {isTracked ? 'Tracking' : 'Track'}
          </button>
        </div>
      </div>
      <div className="p-3">
        {/* Time range toggles */}
        <div className="flex gap-1 mb-2">
          {([24, 168, 720] as TimeRange[]).map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setRange(h)}
              className={cn(
                'text-[11px] px-2 py-0.5 rounded transition-colors',
                range === h
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              {RANGE_LABELS[h]}
            </button>
          ))}
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground italic">Loading...</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {!loading && !error && entries && entries.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            No history yet. Fetch telemetry above to record a data point
            {!isTracked && ', or enable tracking for hourly collection'}.
          </p>
        )}
        <div ref={chartRef} className={cn(entries && entries.length > 0 ? '' : 'hidden')} />
      </div>
    </div>
  );
}
