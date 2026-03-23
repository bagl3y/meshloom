import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import { api } from '../api';
import type { HealthStatus } from '../types';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from './ui/sonner';

const STORAGE_KEY = 'meshcore_security_warning_acknowledged';

function readAcknowledgedState(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeAcknowledgedState(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // Best effort only; the warning will continue to show if localStorage is unavailable.
  }
}

interface SecurityWarningModalProps {
  health: HealthStatus | null;
}

export function SecurityWarningModal({ health }: SecurityWarningModalProps) {
  const [acknowledged, setAcknowledged] = useState(readAcknowledgedState);
  const [confirmedRisk, setConfirmedRisk] = useState(false);
  const [disablingBots, setDisablingBots] = useState(false);
  const [botsDisabledLocally, setBotsDisabledLocally] = useState(false);

  const shouldWarn =
    health !== null &&
    health.bots_disabled !== true &&
    health.basic_auth_enabled !== true &&
    !botsDisabledLocally &&
    !acknowledged;

  useEffect(() => {
    if (!shouldWarn) {
      setConfirmedRisk(false);
    }
  }, [shouldWarn]);

  if (!shouldWarn) {
    return null;
  }

  return (
    <Dialog open>
      <DialogContent
        hideCloseButton
        className="max-w-[min(92vw,42rem)] gap-5"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="space-y-3 text-left">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle>Unprotected bot execution is enabled</DialogTitle>
          <DialogDescription>
            Bots are enabled, and app-wide Basic Auth is not configured.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>
            Without one of those protections, or another access-control layer in front of
            RemoteTerm, anyone on your local network who can reach this app can run Python code on
            the computer hosting this instance.
          </p>
          <p>
            This is only safe on protected or isolated networks with appropriate access control. If
            your network is untrusted or later compromised, this setup may expose the host system to
            arbitrary code execution.
          </p>
          <p>
            To reduce that risk, either disable bots with{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">
              MESHCORE_DISABLE_BOTS=true
            </code>{' '}
            or enable the built-in login with{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">
              MESHCORE_BASIC_AUTH_USERNAME
            </code>{' '}
            and{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">
              MESHCORE_BASIC_AUTH_PASSWORD
            </code>
            . Another external auth or access-control system is also acceptable.
          </p>
          <p>
            If you just want a temporary safety measure while you learn the system, you can use the
            button below to disable bots until the server restarts. That is only a temporary guard;
            permanent protection through Basic Auth or env-based bot disablement is still
            encouraged.
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-md border border-input bg-muted/20 p-4">
          <Checkbox
            checked={confirmedRisk}
            onCheckedChange={(checked) => setConfirmedRisk(checked === true)}
            aria-label="Acknowledge bot security risk"
            className="mt-0.5"
          />
          <span className="text-sm leading-6 text-foreground">
            I understand that continuing with my existing security setup may put me at risk on
            untrusted networks or if my home network is compromised.
          </span>
        </label>

        <div className="space-y-2">
          <Button
            type="button"
            className="w-full"
            disabled={disablingBots}
            onClick={async () => {
              setDisablingBots(true);
              try {
                await api.disableBotsUntilRestart();
                setBotsDisabledLocally(true);
                toast.success('Bots disabled until restart');
              } catch (err) {
                toast.error('Failed to disable bots', {
                  description: err instanceof Error ? err.message : undefined,
                });
              } finally {
                setDisablingBots(false);
              }
            }}
          >
            {disablingBots ? 'Disabling Bots...' : 'Disable Bots Until Server Restart'}
          </Button>
          <Button
            type="button"
            className="w-full"
            variant="outline"
            disabled={!confirmedRisk || disablingBots}
            onClick={() => {
              writeAcknowledgedState();
              setAcknowledged(true);
            }}
          >
            Do Not Warn Me On This Device Again
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
