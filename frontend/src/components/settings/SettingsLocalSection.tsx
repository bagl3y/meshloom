import { useState } from 'react';
import { ChevronRight, Logs, MessageSquare, Send, Settings } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { cn } from '../../lib/utils';
import { ContactAvatar } from '../ContactAvatar';
import {
  captureLastViewedConversationFromHash,
  getReopenLastConversationEnabled,
  setReopenLastConversationEnabled,
} from '../../utils/lastViewedConversation';
import { ThemeSelector } from './ThemeSelector';
import { getLocalLabel, setLocalLabel, type LocalLabel } from '../../utils/localLabel';
import {
  DISTANCE_UNIT_LABELS,
  DISTANCE_UNITS,
  setSavedDistanceUnit,
} from '../../utils/distanceUnits';
import { useDistanceUnit } from '../../contexts/DistanceUnitContext';
import {
  DEFAULT_FONT_SCALE,
  FONT_SCALE_SLIDER_STEP,
  MAX_FONT_SCALE,
  MIN_FONT_SCALE,
  getSavedFontScale,
  setSavedFontScale,
} from '../../utils/fontScale';
import { getAutoFocusInputEnabled, setAutoFocusInputEnabled } from '../../utils/autoFocusInput';
import {
  BATTERY_DISPLAY_CHANGE_EVENT,
  getShowBatteryPercent,
  setShowBatteryPercent as saveBatteryPercent,
  getShowBatteryVoltage,
  setShowBatteryVoltage as saveBatteryVoltage,
} from '../../utils/batteryDisplay';
import {
  STATUS_DOT_PULSE_CHANGE_EVENT,
  getStatusDotPulseEnabled,
  setStatusDotPulseEnabled as saveStatusDotPulse,
} from '../../utils/statusDotPulse';

export function SettingsLocalSection({
  onLocalLabelChange,
  className,
}: {
  onLocalLabelChange?: (label: LocalLabel) => void;
  className?: string;
}) {
  const { distanceUnit, setDistanceUnit } = useDistanceUnit();
  const [reopenLastConversation, setReopenLastConversation] = useState(
    getReopenLastConversationEnabled
  );
  const [localLabelText, setLocalLabelText] = useState(() => getLocalLabel().text);
  const [localLabelColor, setLocalLabelColor] = useState(() => getLocalLabel().color);
  const [autoFocusInput, setAutoFocusInput] = useState(getAutoFocusInputEnabled);
  const [batteryPercent, setBatteryPercent] = useState(getShowBatteryPercent);
  const [batteryVoltage, setBatteryVoltage] = useState(getShowBatteryVoltage);
  const [statusDotPulse, setStatusDotPulse] = useState(getStatusDotPulseEnabled);
  const [fontScale, setFontScale] = useState(getSavedFontScale);
  const [fontScaleSlider, setFontScaleSlider] = useState(getSavedFontScale);
  const [fontScaleInput, setFontScaleInput] = useState(() => String(getSavedFontScale()));

  const commitFontScale = (nextScale: number) => {
    const normalized = setSavedFontScale(nextScale);
    setFontScale(normalized);
    setFontScaleSlider(normalized);
    setFontScaleInput(String(normalized));
  };

  const restoreFontScaleInput = () => {
    setFontScaleInput(String(fontScale));
  };

  const handleSliderChange = (nextScale: number) => {
    setFontScaleSlider(nextScale);
    setFontScaleInput(String(nextScale));
  };

  const handleSliderCommit = (nextScale: number) => {
    commitFontScale(nextScale);
  };

  const handleToggleReopenLastConversation = (enabled: boolean) => {
    setReopenLastConversation(enabled);
    setReopenLastConversationEnabled(enabled);
    if (enabled) {
      captureLastViewedConversationFromHash();
    }
  };

  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground">
        These settings apply only to this device/browser.
      </p>

      <div className="space-y-1">
        <Label>Color Scheme</Label>
        <ThemeSelector />
        <ThemePreview className="mt-6" />
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>Local Label</Label>
        <div className="flex items-center gap-2">
          <Input
            value={localLabelText}
            onChange={(e) => {
              const text = e.target.value;
              setLocalLabelText(text);
              setLocalLabel(text, localLabelColor);
              onLocalLabelChange?.({ text, color: localLabelColor });
            }}
            placeholder="e.g. Home Base, Field Radio 2"
            aria-label="Local label text"
            className="flex-1"
          />
          <input
            type="color"
            value={localLabelColor}
            onChange={(e) => {
              const color = e.target.value;
              setLocalLabelColor(color);
              setLocalLabel(localLabelText, color);
              onLocalLabelChange?.({ text: localLabelText, color });
            }}
            aria-label="Local label color"
            className="w-10 h-9 rounded border border-input cursor-pointer bg-transparent p-0.5"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Display a colored banner at the top of the page to identify this instance.
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label htmlFor="distance-units">Distance Units</Label>
        <select
          id="distance-units"
          value={distanceUnit}
          onChange={(event) => {
            const nextUnit = event.target.value as (typeof DISTANCE_UNITS)[number];
            setSavedDistanceUnit(nextUnit);
            setDistanceUnit(nextUnit);
          }}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {DISTANCE_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {DISTANCE_UNIT_LABELS[unit]}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Controls how distances are shown throughout the app.
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>UI Tweaks</Label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={reopenLastConversation}
            onChange={(e) => handleToggleReopenLastConversation(e.target.checked)}
            className="w-4 h-4 rounded border-input accent-primary"
          />
          <span className="text-sm">Reopen to last viewed channel/conversation</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoFocusInput}
            onChange={(e) => {
              const v = e.target.checked;
              setAutoFocusInput(v);
              setAutoFocusInputEnabled(v);
            }}
            className="w-4 h-4 rounded border-input accent-primary"
          />
          <span className="text-sm">Auto-focus input on conversation load (desktop only)</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={batteryPercent}
            onChange={(e) => {
              const v = e.target.checked;
              setBatteryPercent(v);
              saveBatteryPercent(v);
              window.dispatchEvent(new Event(BATTERY_DISPLAY_CHANGE_EVENT));
            }}
            className="w-4 h-4 rounded border-input accent-primary"
          />
          <span className="text-sm">Show battery percentage in status bar</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={batteryVoltage}
            onChange={(e) => {
              const v = e.target.checked;
              setBatteryVoltage(v);
              saveBatteryVoltage(v);
              window.dispatchEvent(new Event(BATTERY_DISPLAY_CHANGE_EVENT));
            }}
            className="w-4 h-4 rounded border-input accent-primary"
          />
          <span className="text-sm">Show battery voltage in status bar</span>
        </label>

        {(batteryPercent || batteryVoltage) && (
          <p className="text-xs text-muted-foreground ml-7">
            Battery data updates every 60 seconds and may take up to a minute to appear after
            connecting.
          </p>
        )}

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={statusDotPulse}
            onChange={(e) => {
              const v = e.target.checked;
              setStatusDotPulse(v);
              saveStatusDotPulse(v);
              window.dispatchEvent(new Event(STATUS_DOT_PULSE_CHANGE_EVENT));
            }}
            className="w-4 h-4 rounded border-input accent-primary"
          />
          <span className="text-sm">
            Glitter status dot as packets arrive (blue = channel, purple = DM, cyan = advert, dark
            green = other)
          </span>
        </label>

        <div className="space-y-3">
          <Label htmlFor="font-scale-input">Relative Font Size</Label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="range"
              min={MIN_FONT_SCALE}
              max={MAX_FONT_SCALE}
              step={FONT_SCALE_SLIDER_STEP}
              value={fontScaleSlider}
              onChange={(event) => handleSliderChange(Number(event.target.value))}
              onMouseUp={(event) => handleSliderCommit(Number(event.currentTarget.value))}
              onTouchEnd={(event) => handleSliderCommit(Number(event.currentTarget.value))}
              onKeyUp={(event) => handleSliderCommit(Number(event.currentTarget.value))}
              onBlur={(event) => handleSliderCommit(Number(event.currentTarget.value))}
              aria-label="Relative font size slider"
              className="w-full accent-primary sm:flex-1"
            />
            <div className="flex items-center gap-2 sm:w-40">
              <Input
                id="font-scale-input"
                type="number"
                inputMode="decimal"
                min={MIN_FONT_SCALE}
                max={MAX_FONT_SCALE}
                step="any"
                value={fontScaleInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setFontScaleInput(nextValue);

                  if (nextValue === '') {
                    return;
                  }

                  if (event.target.validity.valid && Number.isFinite(event.target.valueAsNumber)) {
                    commitFontScale(event.target.valueAsNumber);
                  }
                }}
                onBlur={() => {
                  const parsed = Number.parseFloat(fontScaleInput);
                  if (!Number.isFinite(parsed)) {
                    restoreFontScaleInput();
                    return;
                  }
                  commitFontScale(parsed);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') {
                    return;
                  }
                  event.preventDefault();
                  const parsed = Number.parseFloat(fontScaleInput);
                  if (!Number.isFinite(parsed)) {
                    restoreFontScaleInput();
                    return;
                  }
                  commitFontScale(parsed);
                }}
                aria-label="Relative font size percentage"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <button
              type="button"
              onClick={() => commitFontScale(DEFAULT_FONT_SCALE)}
              className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={fontScale === DEFAULT_FONT_SCALE}
            >
              Reset
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Scales the app&apos;s typography for this browser only. The slider moves in 5% steps;
            the number field accepts any value from 25% to 400%.
          </p>
        </div>
      </div>
    </div>
  );
}

function ThemePreview({ className }: { className?: string }) {
  const [showStyleRef, setShowStyleRef] = useState(false);

  return (
    <div className={`rounded-lg border border-border bg-card p-3 ${className ?? ''}`}>
      <p className="text-xs text-muted-foreground mb-3">
        Preview alert, message, sidebar, and badge contrast for the selected theme.
      </p>

      <div className="space-y-2">
        <PreviewBanner className="border border-status-connected/30 bg-status-connected/15 text-status-connected">
          Connected preview: radio link healthy and syncing.
        </PreviewBanner>
        <PreviewBanner className="border border-warning/50 bg-warning/10 text-warning">
          Warning preview: packet audit suggests missing history.
        </PreviewBanner>
        <PreviewBanner className="border border-destructive/30 bg-destructive/10 text-destructive">
          Error preview: radio reconnect failed.
        </PreviewBanner>
      </div>

      <div className="mt-4 space-y-2">
        <PreviewMessage
          sender="Alice"
          bubbleClassName="bg-msg-incoming text-foreground"
          text="Hello, mesh!"
        />
        <PreviewMessage
          sender="You"
          alignRight
          bubbleClassName="bg-msg-outgoing text-foreground"
          text="Hi there! I'm using RemoteTerm."
        />
      </div>

      <div className="mt-4 rounded-md border border-border bg-background p-2">
        <p className="mb-2 text-[0.6875rem] font-medium text-muted-foreground">Sidebar preview</p>
        <div className="space-y-1">
          <PreviewSidebarRow
            active
            leading={
              <span
                className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <Logs className="h-3.5 w-3.5" />
              </span>
            }
            label="Packet Feed"
          />
          <PreviewSidebarRow
            leading={<ContactAvatar name="Alice" publicKey={'ab'.repeat(32)} size={24} />}
            label="Alice"
            badge={
              <span className="rounded-full bg-badge-unread/90 px-1.5 py-0.5 text-[0.625rem] font-semibold text-badge-unread-foreground">
                3
              </span>
            }
          />
          <PreviewSidebarRow
            leading={<ContactAvatar name="Mesh Ops" publicKey={'cd'.repeat(32)} size={24} />}
            label="Mesh Ops"
            badge={
              <span className="rounded-full bg-badge-mention px-1.5 py-0.5 text-[0.625rem] font-semibold text-badge-mention-foreground">
                @2
              </span>
            }
          />
        </div>
      </div>

      {/* ── Style Reference (collapsible) ── */}
      <button
        type="button"
        onClick={() => setShowStyleRef((v) => !v)}
        className="mt-4 flex w-full items-center gap-1.5 text-[0.6875rem] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight
          className={cn('h-3.5 w-3.5 transition-transform', showStyleRef && 'rotate-90')}
        />
        Canonical style reference
      </button>

      {showStyleRef && (
        <>
          {/* ── Text Hierarchy ── */}
          <PreviewSection title="Text hierarchy">
            <div className="space-y-2">
              <PreviewTextRow
                classes="text-xl font-semibold"
                label="text-xl font-semibold"
                desc="Hero / large data"
              />
              <PreviewTextRow
                classes="text-lg font-semibold"
                label="text-lg font-semibold"
                desc="Sheet / dialog title"
              />
              <PreviewTextRow
                classes="text-base font-semibold"
                label="text-base font-semibold"
                desc="Section title"
              />
              <PreviewTextRow classes="text-sm" label="text-sm" desc="Body text, form labels" />
              <PreviewTextRow
                classes="text-xs text-muted-foreground"
                label="text-xs text-muted-foreground"
                desc="Helper text"
              />
              <PreviewTextRow
                classes="text-[0.6875rem] text-muted-foreground"
                label="text-[0.6875rem] text-muted-foreground"
                desc="Metadata, timestamps"
              />
              <div>
                <p className="text-[0.625rem] uppercase tracking-wider text-muted-foreground font-medium">
                  Section Label
                </p>
                <p className="text-[0.625rem] text-muted-foreground/60 mt-0.5">
                  text-[0.625rem] uppercase tracking-wider text-muted-foreground font-medium
                </p>
              </div>
            </div>
          </PreviewSection>

          {/* ── Mono Text ── */}
          <PreviewSection title="Mono text">
            <div className="space-y-1.5">
              <div>
                <p className="text-xs font-mono text-muted-foreground">
                  a1b2c3d4e5f6...7890abcdef01
                </p>
                <p className="text-[0.625rem] text-muted-foreground/60">
                  text-xs font-mono — keys, identifiers
                </p>
              </div>
              <div>
                <p className="text-[0.6875rem] font-mono">1h 23m 45s uptime</p>
                <p className="text-[0.625rem] text-muted-foreground/60">
                  text-[0.6875rem] font-mono — metadata mono
                </p>
              </div>
              <div>
                <p className="text-sm font-mono">$ req_status_sync 0xA1B2...</p>
                <p className="text-[0.625rem] text-muted-foreground/60">
                  text-sm font-mono — console / code
                </p>
              </div>
            </div>
          </PreviewSection>

          {/* ── Badges ── */}
          <PreviewSection title="Badges and tags">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[0.625rem] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                Hashtag
              </span>
              <span className="text-[0.625rem] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                Repeater
              </span>
              <span className="text-[0.625rem] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                On Radio
              </span>
              <span className="rounded-full bg-badge-unread/90 px-1.5 py-0.5 text-[0.625rem] font-semibold text-badge-unread-foreground">
                3
              </span>
              <span className="rounded-full bg-badge-mention px-1.5 py-0.5 text-[0.625rem] font-semibold text-badge-mention-foreground">
                @2
              </span>
            </div>
            <p className="text-[0.625rem] text-muted-foreground/60 mt-1.5">
              Muted: bg-muted &middot; Primary: bg-primary/10 &middot; Unread/Mention: bg-badge-*
            </p>
          </PreviewSection>

          {/* ── Buttons ── */}
          <PreviewSection title="Buttons">
            <div className="space-y-3">
              <div>
                <p className="text-[0.625rem] text-muted-foreground/60 mb-1.5">
                  Standard variants (size sm)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm">Default</Button>
                  <Button size="sm" variant="outline">
                    Outline
                  </Button>
                  <Button size="sm" variant="secondary">
                    Secondary
                  </Button>
                  <Button size="sm" variant="destructive">
                    Destructive
                  </Button>
                  <Button size="sm" variant="ghost">
                    Ghost
                  </Button>
                  <Button size="icon" variant="outline">
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-[0.625rem] text-muted-foreground/60 mb-1.5">
                  Semantic outline variants
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                  >
                    Danger
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-warning/50 text-warning hover:bg-warning/10"
                  >
                    Warning
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-600/50 text-green-600 hover:bg-green-600/10"
                  >
                    Success
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-[0.625rem] text-muted-foreground/60 mb-1.5">
                  Metric selector pills
                </p>
                <div className="flex gap-1">
                  {['Voltage', 'Noise Floor', 'Packets'].map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      className={cn(
                        'text-[0.6875rem] px-2 py-0.5 rounded transition-colors',
                        i === 0
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </PreviewSection>

          {/* ── Clickable Text ── */}
          <PreviewSection title="Clickable text">
            <div className="space-y-1.5">
              <span
                role="button"
                tabIndex={0}
                className="text-xs font-mono text-muted-foreground cursor-pointer hover:text-primary transition-colors block"
              >
                a1b2c3d4e5f6 (click to copy)
              </span>
              <span
                role="button"
                tabIndex={0}
                className="text-sm cursor-pointer underline underline-offset-2 decoration-muted-foreground/50 hover:text-primary transition-colors"
              >
                Underlined navigational link
              </span>
            </div>
            <p className="text-[0.625rem] text-muted-foreground/60 mt-1.5">
              cursor-pointer hover:text-primary transition-colors — use role=&quot;button&quot; +
              tabIndex
            </p>
          </PreviewSection>

          {/* ── Inline Alerts ── */}
          <PreviewSection title="Inline alerts">
            <div className="space-y-1.5">
              <div className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-info">
                Info: channel slot cache refreshed from radio.
              </div>
              <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                Warning: radio clock skew detected.
              </div>
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                Error: post-connect setup timed out. Reboot the radio and restart.
              </div>
            </div>
          </PreviewSection>
        </>
      )}
    </div>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-md border border-border bg-background p-2">
      <p className="mb-2 text-[0.6875rem] font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function PreviewTextRow({
  classes,
  label,
  desc,
}: {
  classes: string;
  label: string;
  desc: string;
}) {
  return (
    <div>
      <p className={classes}>Sample text at this size</p>
      <p className="text-[0.625rem] text-muted-foreground/60">
        {label} — {desc}
      </p>
    </div>
  );
}

function PreviewBanner({ children, className }: { children: React.ReactNode; className: string }) {
  return <div className={`rounded-md px-3 py-2 text-xs ${className}`}>{children}</div>;
}

function PreviewMessage({
  sender,
  text,
  bubbleClassName,
  alignRight = false,
}: {
  sender: string;
  text: string;
  bubbleClassName: string;
  alignRight?: boolean;
}) {
  return (
    <div className={`flex ${alignRight ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${alignRight ? 'items-end' : 'items-start'} flex flex-col`}>
        <span className="mb-1 text-[0.6875rem] text-muted-foreground">{sender}</span>
        <div className={`rounded-2xl px-3 py-2 text-sm break-words ${bubbleClassName}`}>{text}</div>
      </div>
    </div>
  );
}

function PreviewSidebarRow({
  leading,
  label,
  badge,
  active = false,
}: {
  leading: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div
      data-active={active ? 'true' : undefined}
      className={`sidebar-action-row flex items-center gap-2 rounded-md border-l-2 px-3 py-2 text-[0.8125rem] ${
        active ? 'border-l-primary bg-accent text-foreground' : 'border-l-transparent'
      }`}
    >
      <span className="sidebar-tool-icon" aria-hidden="true">
        {leading}
      </span>
      <span className={`sidebar-tool-label min-w-0 flex-1 truncate ${active ? 'font-medium' : ''}`}>
        {label}
      </span>
      {badge}
      {!badge && (
        <span className="sidebar-tool-icon" aria-hidden="true">
          <MessageSquare className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}
