import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

// Short curated list from docs.meshcore.io/cli_commands — not a live scrape.
const FREQUENT_CLI_COMMANDS = [
  { command: 'ver', hint: 'Firmware version' },
  { command: 'clock', hint: 'UTC time' },
  { command: 'clock sync', hint: 'Sync clock' },
  { command: 'advert', hint: 'Flood advert' },
  { command: 'advert.zerohop', hint: 'Zero-hop advert' },
  { command: 'neighbors', hint: 'Nearby neighbors' },
  { command: 'get name', hint: 'Node name' },
  { command: 'reboot', hint: 'Reboot (no reply)' },
] as const;

export function ConsolePane({
  history,
  loading,
  onSend,
}: {
  history: Array<{ command: string; response: string; timestamp: number; outgoing: boolean }>;
  loading: boolean;
  onSend: (command: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  // -1 = editing the live input; 0+ = index into sentCommands (most recent first)
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [helpOpen, setHelpOpen] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevLoadingRef = useRef(loading);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  // Refocus input after command completes
  useEffect(() => {
    if (prevLoadingRef.current && !loading) {
      inputRef.current?.focus();
    }
    prevLoadingRef.current = loading;
  }, [loading]);

  // Most-recent-first list of sent commands, with consecutive repeats deduped
  const sentCommands = history.reduce<string[]>((acc, entry) => {
    if (entry.outgoing && entry.command !== acc[0]) acc.unshift(entry.command);
    return acc;
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (sentCommands.length === 0) return;
      e.preventDefault();
      const next = e.key === 'ArrowUp' ? historyIndex + 1 : historyIndex - 1;
      if (next >= sentCommands.length || next < -1) return;
      setHistoryIndex(next);
      setInput(next === -1 ? '' : sentCommands[next]);
    },
    [historyIndex, sentCommands]
  );

  const insertCommand = useCallback((command: string) => {
    setInput(command);
    setHistoryIndex(-1);
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = input.trimStart();
      if (!trimmed || loading) return;
      setInput('');
      setHistoryIndex(-1);
      await onSend(trimmed);
    },
    [input, loading, onSend]
  );

  return (
    <div className="border border-border rounded-lg overflow-hidden col-span-full">
      <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Console</h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-expanded={helpOpen}
            aria-controls="repeater-cli-help"
            onClick={() => setHelpOpen((open) => !open)}
            className="text-xs text-primary hover:underline"
          >
            {t('repeater.help')}
          </button>
          <a
            href="https://docs.meshcore.io/cli_commands/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            {t('repeater.cliDocs')}
          </a>
        </div>
      </div>
      {helpOpen && (
        <div
          id="repeater-cli-help"
          className="px-3 py-2 border-b border-border bg-muted/30 space-y-1.5"
        >
          <p className="text-[0.625rem] uppercase tracking-wider text-muted-foreground font-medium">
            Frequent commands
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {FREQUENT_CLI_COMMANDS.map((item) => (
              <li key={item.command}>
                <button
                  type="button"
                  title={item.hint}
                  aria-label={`Insert ${item.command}`}
                  onClick={() => insertCommand(item.command)}
                  className="font-mono text-[0.625rem] px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {item.command}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div
        ref={outputRef}
        className="h-48 overflow-y-auto p-3 font-mono text-xs bg-console-bg/50 text-console space-y-1"
      >
        {history.length === 0 && (
          <p className="text-muted-foreground italic">Type a CLI command below...</p>
        )}
        {history.map((entry, i) =>
          entry.outgoing ? (
            <div key={i} className="text-console-command">
              &gt; {entry.command}
            </div>
          ) : (
            <div key={i} className="text-console/80 whitespace-pre-wrap">
              {entry.response}
            </div>
          )
        )}
        {loading && <div className="text-muted-foreground animate-pulse">...</div>}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 p-2 border-t border-border">
        <Input
          ref={inputRef}
          type="text"
          autoComplete="off"
          // Repeater CLI commands are case-sensitive, so mobile keyboards must
          // not helpfully capitalise or correct them.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          name="console-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="CLI command..."
          aria-label="Console command"
          disabled={loading}
          className="flex-1 font-mono text-sm"
        />
        <Button type="submit" size="sm" disabled={loading || !input.trimStart()}>
          Send
        </Button>
      </form>
    </div>
  );
}
