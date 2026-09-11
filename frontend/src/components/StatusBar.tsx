import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  BatteryWarning,
  Menu,
  Moon,
  Sun,
} from 'lucide-react';
import { isRadioIdentityGate, type HealthStatus, type RadioConfig } from '../types';
import { api } from '../api';
import { toast } from './ui/sonner';
import { handleKeyboardActivate } from '../utils/a11y';
import { applyTheme, getEffectiveTheme, THEME_CHANGE_EVENT } from '../utils/theme';
import {
  BATTERY_DISPLAY_CHANGE_EVENT,
  getShowBatteryPercent,
  getShowBatteryVoltage,
  mvToPercent,
} from '../utils/batteryDisplay';
import {
  STATUS_DOT_PULSE_CHANGE_EVENT,
  STATUS_DOT_PULSE_DURATION_MS,
  STATUS_DOT_PULSE_PACKET_EVENT,
  getStatusDotPulseEnabled,
  pulseColorFor,
  type StatusDotPulseKind,
} from '../utils/statusDotPulse';
import { cn } from '@/lib/utils';

interface StatusBarProps {
  health: HealthStatus | null;
  config: RadioConfig | null;
  settingsMode?: boolean;
  onSettingsClick: () => void;
  onOpenRadioSettings?: () => void;
  onOpenIdentityModal?: () => void;
  onMenuClick?: () => void;
}

export function StatusBar({
  health,
  config,
  settingsMode = false,
  onSettingsClick,
  onOpenRadioSettings,
  onOpenIdentityModal,
  onMenuClick,
}: StatusBarProps) {
  const { t } = useTranslation();
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

  const batteryMv = health?.radio_stats?.battery_mv;
  const batteryInfo = useMemo(() => {
    if ((!showBatteryPercent && !showBatteryVoltage) || !batteryMv || batteryMv <= 0) return null;
    const pct = mvToPercent(batteryMv);
    const Icon =
      pct >= 80 ? BatteryFull : pct >= 40 ? BatteryMedium : pct >= 15 ? BatteryLow : BatteryWarning;
    const color =
      pct >= 40 ? 'text-status-connected' : pct >= 15 ? 'text-warning' : 'text-destructive';
    const label =
      showBatteryPercent && showBatteryVoltage
        ? `${pct}% (${batteryMv}mV)`
        : showBatteryPercent
          ? `${pct}%`
          : `${batteryMv}mV`;
    return { pct, Icon, color, label, mv: batteryMv };
  }, [batteryMv, showBatteryPercent, showBatteryVoltage]);

  const radioState =
    health?.radio_state ??
    (health?.radio_initializing
      ? 'initializing'
      : health?.radio_connected
        ? 'connected'
        : 'disconnected');
  const connected = health?.radio_connected ?? false;
  const identityGate = isRadioIdentityGate(radioState);
  const needsTransport = health?.transport_configured === false;
  const statusLabel =
    radioState === 'identity_mismatch'
      ? t('statusBar.radioIdentityMismatch')
      : radioState === 'identity_unbound_legacy'
        ? t('statusBar.radioIdentityUnbound')
        : radioState === 'paused'
          ? t('statusBar.radioPaused')
          : radioState === 'connecting'
            ? t('statusBar.radioConnecting')
            : radioState === 'initializing'
              ? t('statusBar.radioInitializing')
              : connected
                ? t('statusBar.radioOk')
                : t('statusBar.radioDisconnected');
  const [reconnecting, setReconnecting] = useState(false);
  // Track the *effective* theme (follow-os is resolved to original/light) so the
  // toggle icon and action match what the user currently sees rendered.
  const [currentTheme, setCurrentTheme] = useState(getEffectiveTheme);
  const [pulseEnabled, setPulseEnabled] = useState(getStatusDotPulseEnabled);
  const [pulseKind, setPulseKind] = useState<StatusDotPulseKind | null>(null);

  useEffect(() => {
    const handler = () => setPulseEnabled(getStatusDotPulseEnabled());
    window.addEventListener(STATUS_DOT_PULSE_CHANGE_EVENT, handler);
    return () => window.removeEventListener(STATUS_DOT_PULSE_CHANGE_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!pulseEnabled) {
      setPulseKind(null);
      return;
    }
    let timer: number | null = null;
    const handler = (event: Event) => {
      const kind = (event as CustomEvent<StatusDotPulseKind>).detail;
      setPulseKind(kind);
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        setPulseKind(null);
        timer = null;
      }, STATUS_DOT_PULSE_DURATION_MS);
    };
    window.addEventListener(STATUS_DOT_PULSE_PACKET_EVENT, handler);
    return () => {
      window.removeEventListener(STATUS_DOT_PULSE_PACKET_EVENT, handler);
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [pulseEnabled]);

  useEffect(() => {
    const syncEffective = () => setCurrentTheme(getEffectiveTheme());
    window.addEventListener(THEME_CHANGE_EVENT, syncEffective);

    // When saved theme is "follow-os", OS appearance changes alter the effective
    // theme without firing a THEME_CHANGE_EVENT, so also watch matchMedia.
    const mql =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: light)')
        : null;
    if (mql) {
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', syncEffective);
      } else if (typeof (mql as MediaQueryList).addListener === 'function') {
        (mql as MediaQueryList).addListener(syncEffective);
      }
    }

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, syncEffective);
      if (mql) {
        if (typeof mql.removeEventListener === 'function') {
          mql.removeEventListener('change', syncEffective);
        } else if (typeof (mql as MediaQueryList).removeListener === 'function') {
          (mql as MediaQueryList).removeListener(syncEffective);
        }
      }
    };
  }, []);

  const handleConnectAction = async () => {
    if (identityGate) {
      onOpenIdentityModal?.();
      return;
    }
    if (needsTransport) {
      window.location.hash = '#settings/radio';
      onOpenRadioSettings?.();
      return;
    }
    setReconnecting(true);
    try {
      const result = await api.reconnectRadio();
      if (result.connected) {
        toast.success(t('statusBar.reconnected'), { description: result.message });
      }
    } catch (err) {
      toast.error(t('statusBar.reconnectFailed'), {
        description: err instanceof Error ? err.message : t('statusBar.reconnectFailedHint'),
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
          aria-label={t('statusBar.openMenu')}
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      <h1
        aria-label="Meshloom"
        className="text-base font-semibold tracking-tight mr-auto text-foreground flex items-center gap-2"
      >
        <img
          src="./meshloom-mark.svg"
          alt=""
          className="h-7 w-7 shrink-0 [filter:drop-shadow(0_0_8px_rgba(34,211,238,0.28))_drop-shadow(0_0_10px_rgba(191,90,242,0.28))]"
        />
        <span>
          <span>Mesh</span>
          <span className="bg-[linear-gradient(90deg,#22D3EE_0%,#BF5AF2_100%)] bg-clip-text text-transparent">
            loom
          </span>
        </span>
      </h1>

      <div className="flex items-center gap-1.5" role="status" aria-label={statusLabel}>
        <div
          className={cn(
            'w-2 h-2 rounded-full transition-colors',
            radioState === 'initializing' || radioState === 'connecting' || identityGate
              ? 'bg-warning'
              : connected
                ? pulseKind
                  ? ''
                  : 'bg-status-connected shadow-[0_0_6px_hsl(var(--status-connected)/0.5)]'
                : 'bg-status-disconnected'
          )}
          style={connected && pulseKind ? { backgroundColor: pulseColorFor(pulseKind) } : undefined}
          aria-hidden="true"
        />
        <span className="hidden lg:inline text-muted-foreground">{statusLabel}</span>
      </div>

      {connected && batteryInfo && (
        <div
          className={cn('flex items-center gap-1', batteryInfo.color)}
          title={t('statusBar.batteryTitle', {
            pct: batteryInfo.pct,
            volts: (batteryInfo.mv / 1000).toFixed(2),
          })}
          role="status"
          aria-label={t('statusBar.batteryAria', { pct: batteryInfo.pct })}
        >
          <batteryInfo.Icon className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline text-[0.6875rem]">{batteryInfo.label}</span>
        </div>
      )}

      {config && (
        <div className="hidden lg:flex items-center gap-2 text-muted-foreground">
          <span className="text-foreground font-medium">
            {config.name || t('statusBar.unnamed')}
          </span>
          <span
            className="font-mono text-[0.6875rem] text-muted-foreground cursor-pointer hover:text-primary transition-colors"
            role="button"
            tabIndex={0}
            onKeyDown={handleKeyboardActivate}
            onClick={() => {
              navigator.clipboard.writeText(config.public_key);
              toast.success(t('statusBar.publicKeyCopied'));
            }}
            title={t('statusBar.copyPublicKeyHint')}
            aria-label={t('statusBar.copyPublicKey')}
          >
            {config.public_key.toLowerCase()}
          </span>
        </div>
      )}

      {(radioState === 'disconnected' || radioState === 'paused' || identityGate) && (
        <button
          onClick={handleConnectAction}
          disabled={reconnecting}
          className="px-3 py-1 bg-warning/10 border border-warning/20 text-warning rounded-md text-xs cursor-pointer hover:bg-warning/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {reconnecting
            ? t('statusBar.reconnecting')
            : identityGate
              ? t('statusBar.reviewIdentity')
              : needsTransport || radioState === 'paused'
                ? t('statusBar.connect')
                : t('statusBar.reconnect')}
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
        {settingsMode ? t('shell.backToChat') : t('statusBar.settings')}
      </button>
      <button
        onClick={handleThemeToggle}
        className="p-0.5 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        title={currentTheme === 'light' ? t('statusBar.themeClassic') : t('statusBar.themeLight')}
        aria-label={
          currentTheme === 'light' ? t('statusBar.themeClassic') : t('statusBar.themeLight')
        }
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
