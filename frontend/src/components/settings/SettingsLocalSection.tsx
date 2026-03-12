import { useState } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import {
  captureLastViewedConversationFromHash,
  getReopenLastConversationEnabled,
  setReopenLastConversationEnabled,
} from '../../utils/lastViewedConversation';
import { ThemeSelector } from './ThemeSelector';
import { getLocalLabel, setLocalLabel, type LocalLabel } from '../../utils/localLabel';

export function SettingsLocalSection({
  onLocalLabelChange,
  className,
}: {
  onLocalLabelChange?: (label: LocalLabel) => void;
  className?: string;
}) {
  const [reopenLastConversation, setReopenLastConversation] = useState(
    getReopenLastConversationEnabled
  );
  const [localLabelText, setLocalLabelText] = useState(() => getLocalLabel().text);
  const [localLabelColor, setLocalLabelColor] = useState(() => getLocalLabel().color);

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

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={reopenLastConversation}
          onChange={(e) => handleToggleReopenLastConversation(e.target.checked)}
          className="w-4 h-4 rounded border-input accent-primary"
        />
        <span className="text-sm">Reopen to last viewed channel/conversation</span>
      </label>
    </div>
  );
}

function ThemePreview({ className }: { className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-card p-3 ${className ?? ''}`}>
      <p className="text-xs text-muted-foreground mb-3">
        Preview alert and message contrast for the selected theme.
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
        <span className="mb-1 text-[11px] text-muted-foreground">{sender}</span>
        <div className={`rounded-2xl px-3 py-2 text-sm break-words ${bubbleClassName}`}>{text}</div>
      </div>
    </div>
  );
}
