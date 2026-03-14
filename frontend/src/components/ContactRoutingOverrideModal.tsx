import { useEffect, useMemo, useState } from 'react';

import { api } from '../api';
import type { Contact } from '../types';
import {
  formatRouteLabel,
  formatRoutingOverrideInput,
  hasRoutingOverride,
} from '../utils/pathUtils';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface ContactRoutingOverrideModalProps {
  open: boolean;
  onClose: () => void;
  contact: Contact;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}

function summarizeLearnedRoute(contact: Contact): string {
  return formatRouteLabel(contact.last_path_len, true);
}

function summarizeForcedRoute(contact: Contact): string | null {
  if (!hasRoutingOverride(contact)) {
    return null;
  }
  const routeOverrideLen = contact.route_override_len;
  return routeOverrideLen == null ? null : formatRouteLabel(routeOverrideLen, true);
}

export function ContactRoutingOverrideModal({
  open,
  onClose,
  contact,
  onSaved,
  onError,
}: ContactRoutingOverrideModalProps) {
  const [route, setRoute] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setRoute(formatRoutingOverrideInput(contact));
    setError(null);
  }, [contact, open]);

  const forcedRouteSummary = useMemo(() => summarizeForcedRoute(contact), [contact]);

  const saveRoute = async (value: string) => {
    setSaving(true);
    setError(null);
    try {
      await api.setContactRoutingOverride(contact.public_key, value);
      onSaved(value.trim() === '' ? 'Routing override cleared' : 'Routing override updated');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update routing override';
      setError(message);
      onError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Routing Override</DialogTitle>
          <DialogDescription>
            Set a forced route for this contact. Leave the field blank to clear the override and
            fall back to the learned route or flood until a new path is heard.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void saveRoute(route);
          }}
        >
          <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
            <div className="font-medium">{contact.name || contact.public_key.slice(0, 12)}</div>
            <div className="mt-1 text-muted-foreground">
              Current learned route: {summarizeLearnedRoute(contact)}
            </div>
            {forcedRouteSummary && (
              <div className="mt-1 text-destructive">
                Current forced route: {forcedRouteSummary}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="routing-override-input">Forced route</Label>
            <Input
              id="routing-override-input"
              value={route}
              onChange={(event) => setRoute(event.target.value)}
              placeholder='Examples: "ae,f1" or "ae92,f13e"'
              autoFocus
              disabled={saving}
            />
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Use comma-separated 1, 2, or 3 byte hop IDs for an explicit path.</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void saveRoute('-1')}
                disabled={saving}
              >
                Force Flood
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void saveRoute('0')}
                disabled={saving}
              >
                Force Direct
              </Button>
            </div>
            <Button type="submit" className="w-full" disabled={saving || route.trim().length === 0}>
              {saving
                ? 'Saving...'
                : `Force ${route.trim() === '' ? 'custom' : route.trim()} routing`}
            </Button>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void saveRoute('')}
              disabled={saving}
            >
              Clear override
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
