import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../api';
import { toast } from './ui/sonner';
import { Button } from './ui/button';
import type {
  Contact,
  PaneState,
  RepeaterAclResponse,
  RepeaterLppTelemetryResponse,
  RepeaterStatusResponse,
} from '../types';
import { TelemetryPane } from './repeater/RepeaterTelemetryPane';
import { AclPane } from './repeater/RepeaterAclPane';
import { LppTelemetryPane } from './repeater/RepeaterLppTelemetryPane';
import { ConsolePane } from './repeater/RepeaterConsolePane';
import { RepeaterLogin } from './RepeaterLogin';
import { useRememberedServerPassword } from '../hooks/useRememberedServerPassword';

interface RoomServerPanelProps {
  contact: Contact;
  onAuthenticatedChange?: (authenticated: boolean) => void;
}

type RoomPaneKey = 'status' | 'acl' | 'lppTelemetry';

type RoomPaneData = {
  status: RepeaterStatusResponse | null;
  acl: RepeaterAclResponse | null;
  lppTelemetry: RepeaterLppTelemetryResponse | null;
};

type RoomPaneStates = Record<RoomPaneKey, PaneState>;

type ConsoleEntry = {
  command: string;
  response: string;
  timestamp: number;
  outgoing: boolean;
};

const INITIAL_PANE_STATE: PaneState = {
  loading: false,
  attempt: 0,
  error: null,
  fetched_at: null,
};

function createInitialPaneStates(): RoomPaneStates {
  return {
    status: { ...INITIAL_PANE_STATE },
    acl: { ...INITIAL_PANE_STATE },
    lppTelemetry: { ...INITIAL_PANE_STATE },
  };
}

export function RoomServerPanel({ contact, onAuthenticatedChange }: RoomServerPanelProps) {
  const { password, setPassword, rememberPassword, setRememberPassword, persistAfterLogin } =
    useRememberedServerPassword('room', contact.public_key);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [paneData, setPaneData] = useState<RoomPaneData>({
    status: null,
    acl: null,
    lppTelemetry: null,
  });
  const [paneStates, setPaneStates] = useState<RoomPaneStates>(createInitialPaneStates);
  const [consoleHistory, setConsoleHistory] = useState<ConsoleEntry[]>([]);
  const [consoleLoading, setConsoleLoading] = useState(false);

  useEffect(() => {
    setLoginLoading(false);
    setLoginError(null);
    setLoginMessage(null);
    setAuthenticated(false);
    setAdvancedOpen(false);
    setPaneData({
      status: null,
      acl: null,
      lppTelemetry: null,
    });
    setPaneStates(createInitialPaneStates());
    setConsoleHistory([]);
    setConsoleLoading(false);
  }, [contact.public_key]);

  useEffect(() => {
    onAuthenticatedChange?.(authenticated);
  }, [authenticated, onAuthenticatedChange]);

  const refreshPane = useCallback(
    async <K extends RoomPaneKey>(pane: K, loader: () => Promise<RoomPaneData[K]>) => {
      setPaneStates((prev) => ({
        ...prev,
        [pane]: {
          ...prev[pane],
          loading: true,
          attempt: prev[pane].attempt + 1,
          error: null,
        },
      }));

      try {
        const data = await loader();
        setPaneData((prev) => ({ ...prev, [pane]: data }));
        setPaneStates((prev) => ({
          ...prev,
          [pane]: {
            loading: false,
            attempt: prev[pane].attempt,
            error: null,
            fetched_at: Date.now(),
          },
        }));
      } catch (err) {
        setPaneStates((prev) => ({
          ...prev,
          [pane]: {
            ...prev[pane],
            loading: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          },
        }));
      }
    },
    []
  );

  const performLogin = useCallback(
    async (password: string) => {
      if (loginLoading) return;

      setLoginLoading(true);
      setLoginError(null);
      setLoginMessage(null);
      try {
        const result = await api.roomLogin(contact.public_key, password);
        setAuthenticated(result.authenticated);
        setLoginMessage(
          result.message ??
            (result.authenticated
              ? 'Login confirmed. You can now send room messages and open admin tools.'
              : 'Login request sent, but authentication was not confirmed.')
        );
        if (result.authenticated) {
          toast.success('Room login confirmed');
        } else {
          toast(result.message ?? 'Room login was not confirmed');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setAuthenticated(false);
        setLoginError(message);
        toast.error('Room login failed', { description: message });
      } finally {
        setLoginLoading(false);
      }
    },
    [contact.public_key, loginLoading]
  );

  const handleLogin = useCallback(
    async (password: string) => {
      await performLogin(password);
      persistAfterLogin(password);
    },
    [performLogin, persistAfterLogin]
  );

  const handleLoginAsGuest = useCallback(async () => {
    await performLogin('');
    persistAfterLogin('');
  }, [performLogin, persistAfterLogin]);

  const handleConsoleCommand = useCallback(
    async (command: string) => {
      setConsoleLoading(true);
      const timestamp = Date.now();
      setConsoleHistory((prev) => [
        ...prev,
        { command, response: command, timestamp, outgoing: true },
      ]);
      try {
        const response = await api.sendRepeaterCommand(contact.public_key, command);
        setConsoleHistory((prev) => [
          ...prev,
          {
            command,
            response: response.response,
            timestamp: Date.now(),
            outgoing: false,
          },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setConsoleHistory((prev) => [
          ...prev,
          {
            command,
            response: `(error) ${message}`,
            timestamp: Date.now(),
            outgoing: false,
          },
        ]);
      } finally {
        setConsoleLoading(false);
      }
    },
    [contact.public_key]
  );

  const panelTitle = useMemo(() => contact.name || contact.public_key.slice(0, 12), [contact]);

  if (!authenticated) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
          <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            Room server access is experimental and in public alpha. Please report any issues on{' '}
            <a
              href="https://github.com/jkingsman/Remote-Terminal-for-MeshCore/issues"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-2 hover:text-warning/80"
            >
              GitHub
            </a>
            .
          </div>
          <RepeaterLogin
            repeaterName={panelTitle}
            loading={loginLoading}
            error={loginError}
            password={password}
            onPasswordChange={setPassword}
            rememberPassword={rememberPassword}
            onRememberPasswordChange={setRememberPassword}
            onLogin={handleLogin}
            onLoginAsGuest={handleLoginAsGuest}
            description="Log in with the room password or use ACL/guest access to enter this room server"
            passwordPlaceholder="Room server password..."
            guestLabel="Login with ACL / Guest"
          />
        </div>
      </div>
    );
  }

  return (
    <section className="border-b border-border bg-muted/20 px-4 py-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium">Room Server Controls</div>
            <p className="text-xs text-muted-foreground">
              Room access is active. Use the chat history and message box below to participate, and
              open admin tools when needed.
            </p>
            {loginMessage && <p className="text-xs text-muted-foreground">{loginMessage}</p>}
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={handleLoginAsGuest}
              disabled={loginLoading}
            >
              Refresh ACL Login
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAdvancedOpen((prev) => !prev)}
            >
              {advancedOpen ? 'Hide Tools' : 'Show Tools'}
            </Button>
          </div>
        </div>

        {advancedOpen && (
          <div className="grid gap-3 xl:grid-cols-2">
            <TelemetryPane
              data={paneData.status}
              state={paneStates.status}
              onRefresh={() => refreshPane('status', () => api.roomStatus(contact.public_key))}
            />
            <AclPane
              data={paneData.acl}
              state={paneStates.acl}
              onRefresh={() => refreshPane('acl', () => api.roomAcl(contact.public_key))}
            />
            <LppTelemetryPane
              data={paneData.lppTelemetry}
              state={paneStates.lppTelemetry}
              onRefresh={() =>
                refreshPane('lppTelemetry', () => api.roomLppTelemetry(contact.public_key))
              }
            />
            <ConsolePane
              history={consoleHistory}
              loading={consoleLoading}
              onSend={handleConsoleCommand}
            />
          </div>
        )}
      </div>
    </section>
  );
}
