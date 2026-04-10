import { useEffect, useState } from 'react';
import {
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  BatteryWarning,
  Menu,
  Moon,
  Sun,
} from 'lucide-react';
import type { HealthStatus, RadioConfig } from '../types';
import { api } from '../api';
import { toast } from './ui/sonner';
import { handleKeyboardActivate } from '../utils/a11y';
import { applyTheme, getSavedTheme, THEME_CHANGE_EVENT } from '../utils/theme';
import { getShowBatteryPercent, getShowBatteryVoltage } from '../utils/batteryDisplay';
import { cn } from '@/lib/utils';

// Meshtastic default OCV table (meshtastic/firmware src/power.h)
const OCV_TABLE: [number, number][] = [
  [4190, 100],
  [4050, 90],
  [3990, 80],
  [3890, 70],
  [3800, 60],
  [3720, 50],
  [3630, 40],
  [3530, 30],
  [3420, 20],
  [3300, 10],
  [3100, 0],
];

function mvToPercent(mv: number): number {
  if (mv >= OCV_TABLE[0][0]) return 100;
  if (mv <= OCV_TABLE[OCV_TABLE.length - 1][0]) return 0;
  for (let i = 0; i < OCV_TABLE.length - 1; i++) {
    const [highMv, highPct] = OCV_TABLE[i];
    const [lowMv, lowPct] = OCV_TABLE[i + 1];
    if (mv >= lowMv)
      return Math.round(lowPct + ((mv - lowMv) / (highMv - lowMv)) * (highPct - lowPct));
  }
  return 0;
}

export const BATTERY_DISPLAY_CHANGE_EVENT = 'remoteterm-battery-display-change';

interface StatusBarProps {
  health: HealthStatus | null;
  config: RadioConfig | null;
  settingsMode?: boolean;
  onSettingsClick: () => void;
  onMenuClick?: () => void;
}

export function StatusBar({
  health,
  config,
  settingsMode = false,
  onSettingsClick,
  onMenuClick,
}: StatusBarProps) {
  const [showBatteryPercent, setShowBatteryPercent] = useState(getShowBatteryPercent);
  const [showBatteryVoltage, setShowBatteryVoltage] = useState(getShowBatteryVoltage);

  useEffect(() => {
    const handler = () => {
      setShowBatteryPercent(getShowBatteryPercent());
      setShowBatteryVoltage(getShowBatteryVoltage());
    };
    window.addEventListener(BATTERY_DISPLAY_CHANGE_EVENT, handler);
    return () => window.removeEventListener(BATTERY_DISPLAY_CHANGE_EVENT, handler);
  }, []);

  const radioState =
    health?.radio_state ??
    (health?.radio_initializing
      ? 'initializing'
      : health?.radio_connected
        ? 'connected'
        : 'disconnected');
  const connected = health?.radio_connected ?? false;
  const statusLabel =
    radioState === 'paused'
      ? 'Radio Paused'
      : radioState === 'connecting'
        ? 'Radio Connecting'
        : radioState === 'initializing'
          ? 'Radio Initializing'
          : connected
            ? 'Radio OK'
            : 'Radio Disconnected';
  const [reconnecting, setReconnecting] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(getSavedTheme);

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const themeId = (event as CustomEvent<string>).detail;
      setCurrentTheme(typeof themeId === 'string' && themeId ? themeId : getSavedTheme());
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange as EventListener);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange as EventListener);
    };
  }, []);

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      const result = await api.reconnectRadio();
      if (result.connected) {
        toast.success('Reconnected', { description: result.message });
      }
    } catch (err) {
      toast.error('Reconnection failed', {
        description: err instanceof Error ? err.message : 'Check radio connection and power',
      });
    } finally {
      setReconnecting(false);
    }
  };

  const handleThemeToggle = () => {
    const nextTheme = currentTheme === 'light' ? 'original' : 'light';
    applyTheme(nextTheme);
    setCurrentTheme(nextTheme);
  };

  return (
    <header className="flex items-center gap-3 px-4 py-2.5 bg-card border-b border-border text-xs">
      {/* Mobile menu button - only visible on small screens */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="md:hidden p-0.5 bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      <h1 className="text-base font-semibold tracking-tight mr-auto text-foreground flex items-center gap-1.5">
        <svg
          className="h-4 w-4 shrink-0 text-white"
          viewBox="0 0 512 512"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="m455.68 85.902c-31.289 0-56.32 25.031-56.32 56.32 0 11.379 3.4141 21.617 8.5352 30.152l-106.38 135.39c12.516 6.2578 23.895 15.359 32.996 25.602l107.52-136.54c4.5508 1.1367 9.1016 1.707 13.652 1.707 31.289 0 56.32-25.031 56.32-56.32 0-30.719-25.031-56.32-56.32-56.32z" />
          <path d="m256 343.04c-5.6875 0-10.809 0.57031-15.93 2.2773l-106.38-135.96c-9.1016 10.809-20.48 19.344-32.996 25.602l106.38 135.96c-5.1211 8.5352-7.3945 18.203-7.3945 28.445 0 31.289 25.031 56.32 56.32 56.32s56.32-25.031 56.32-56.32c0-31.293-25.031-56.324-56.32-56.324z" />
          <path d="m356.69 114.91c3.9805-13.652 10.238-26.738 19.344-37.547-38.113-13.652-78.508-21.047-120.04-21.047-59.164 0-115.48 14.789-166.12 42.668-9.1016-6.8281-21.051-10.809-33.562-10.809-31.289-0.57031-56.32 25.027-56.32 55.75 0 31.289 25.031 56.32 56.32 56.32 31.289 0 56.32-25.031 56.32-56.32 0-3.4141-0.57031-6.8281-1.1367-9.6719 44.371-23.895 93.297-36.41 144.5-36.41 34.703 0 68.836 5.6914 100.69 17.066z" />
        </svg>
        RemoteTerm
      </h1>

      <div className="flex items-center gap-1.5" role="status" aria-label={statusLabel}>
        <div
          className={cn(
            'w-2 h-2 rounded-full transition-colors',
            radioState === 'initializing' || radioState === 'connecting'
              ? 'bg-warning'
              : connected
                ? 'bg-status-connected shadow-[0_0_6px_hsl(var(--status-connected)/0.5)]'
                : 'bg-status-disconnected'
          )}
          aria-hidden="true"
        />
        <span className="hidden lg:inline text-muted-foreground">{statusLabel}</span>
      </div>

      {(showBatteryPercent || showBatteryVoltage) &&
        connected &&
        health?.radio_stats?.battery_mv != null &&
        health.radio_stats.battery_mv > 0 &&
        (() => {
          const mv = health.radio_stats.battery_mv!;
          const pct = mvToPercent(mv);
          const Icon =
            pct >= 80
              ? BatteryFull
              : pct >= 40
                ? BatteryMedium
                : pct >= 15
                  ? BatteryLow
                  : BatteryWarning;
          const color =
            pct >= 40 ? 'text-status-connected' : pct >= 15 ? 'text-warning' : 'text-destructive';
          const label =
            showBatteryPercent && showBatteryVoltage
              ? `${pct}% (${mv}mV)`
              : showBatteryPercent
                ? `${pct}%`
                : `${mv}mV`;
          return (
            <div
              className={cn('flex items-center gap-1', color)}
              title={`Battery: ${pct}% (${(mv / 1000).toFixed(2)}V)`}
              role="status"
              aria-label={`Battery ${pct} percent`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline text-[0.6875rem]">{label}</span>
            </div>
          );
        })()}

      {config && (
        <div className="hidden lg:flex items-center gap-2 text-muted-foreground">
          <span className="text-foreground font-medium">{config.name || 'Unnamed'}</span>
          <span
            className="font-mono text-[0.6875rem] text-muted-foreground cursor-pointer hover:text-primary transition-colors"
            role="button"
            tabIndex={0}
            onKeyDown={handleKeyboardActivate}
            onClick={() => {
              navigator.clipboard.writeText(config.public_key);
              toast.success('Public key copied!');
            }}
            title="Click to copy public key"
            aria-label="Copy public key"
          >
            {config.public_key.toLowerCase()}
          </span>
        </div>
      )}

      {(radioState === 'disconnected' || radioState === 'paused') && (
        <button
          onClick={handleReconnect}
          disabled={reconnecting}
          className="px-3 py-1 bg-warning/10 border border-warning/20 text-warning rounded-md text-xs cursor-pointer hover:bg-warning/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {reconnecting ? 'Reconnecting...' : radioState === 'paused' ? 'Connect' : 'Reconnect'}
        </button>
      )}
      <button
        onClick={onSettingsClick}
        className={cn(
          'px-3 py-1.5 rounded-md text-xs cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          settingsMode
            ? 'bg-status-connected/15 border border-status-connected/30 text-status-connected hover:bg-status-connected/25'
            : 'bg-secondary border border-border text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        {settingsMode ? 'Back to Chat' : 'Settings'}
      </button>
      <button
        onClick={handleThemeToggle}
        className="p-0.5 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        title={currentTheme === 'light' ? 'Switch to classic theme' : 'Switch to light theme'}
        aria-label={currentTheme === 'light' ? 'Switch to classic theme' : 'Switch to light theme'}
      >
        {currentTheme === 'light' ? (
          <Moon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Sun className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </header>
  );
}
