import { useCallback, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import { getContactDisplayName } from '../../utils/pubkey';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { toast } from '../ui/sonner';
import type { Contact } from '../../types';

const CONTACT_TYPE_LABELS: Record<number, string> = {
  0: 'Unknown',
  1: 'Client',
  2: 'Repeater',
  3: 'Room',
  4: 'Sensor',
};

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateISO(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function datetimeToUnix(datetimeStr: string): number {
  const d = new Date(datetimeStr);
  return Math.floor(d.getTime() / 1000);
}

interface BulkDeleteContactsModalProps {
  open: boolean;
  onClose: () => void;
  contacts: Contact[];
  onDeleted: () => void;
}

export function BulkDeleteContactsModal({
  open,
  onClose,
  contacts,
  onDeleted,
}: BulkDeleteContactsModalProps) {
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<number | 'all'>('all');
  const [deleting, setDeleting] = useState(false);
  const lastClickedKeyRef = useRef<string | null>(null);

  const resetAndClose = useCallback(() => {
    setStep('select');
    setSelectedKeys(new Set());
    setStartDate('');
    setEndDate('');
    setTypeFilter('all');
    lastClickedKeyRef.current = null;
    onClose();
  }, [onClose]);

  const filteredContacts = useMemo(() => {
    let list = [...contacts].sort((a, b) => (b.first_seen ?? 0) - (a.first_seen ?? 0));
    if (typeFilter !== 'all') {
      list = list.filter((c) => c.type === typeFilter);
    }
    if (startDate) {
      const start = datetimeToUnix(startDate);
      list = list.filter((c) => (c.first_seen ?? 0) >= start);
    }
    if (endDate) {
      const end = datetimeToUnix(endDate);
      list = list.filter((c) => (c.first_seen ?? 0) <= end);
    }
    return list;
  }, [contacts, typeFilter, startDate, endDate]);

  const handleToggle = (key: string, shiftKey: boolean) => {
    if (shiftKey && lastClickedKeyRef.current && lastClickedKeyRef.current !== key) {
      const keys = filteredContacts.map((c) => c.public_key);
      const lastIdx = keys.indexOf(lastClickedKeyRef.current);
      const curIdx = keys.indexOf(key);
      if (lastIdx >= 0 && curIdx >= 0) {
        const from = Math.min(lastIdx, curIdx);
        const to = Math.max(lastIdx, curIdx);
        const rangeKeys = keys.slice(from, to + 1);
        setSelectedKeys((prev) => {
          const next = new Set(prev);
          for (const k of rangeKeys) next.add(k);
          return next;
        });
        lastClickedKeyRef.current = key;
        return;
      }
    }
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    lastClickedKeyRef.current = key;
  };

  const handleSelectAll = () => {
    setSelectedKeys(new Set(filteredContacts.map((c) => c.public_key)));
  };

  const handleSelectNone = () => {
    setSelectedKeys(new Set());
  };

  const selectedContacts = useMemo(
    () => contacts.filter((c) => selectedKeys.has(c.public_key)),
    [contacts, selectedKeys]
  );

  const contactCount = selectedContacts.filter((c) => c.type === 1 || c.type === 0).length;
  const repeaterCount = selectedContacts.filter((c) => c.type === 2).length;
  const roomCount = selectedContacts.filter((c) => c.type === 3).length;
  const sensorCount = selectedContacts.filter((c) => c.type === 4).length;

  const firstSeenDates = selectedContacts.map((c) => c.first_seen ?? 0).filter((t) => t > 0);
  const minDate =
    firstSeenDates.length > 0 ? formatDateISO(Math.min(...firstSeenDates)) : 'unknown';
  const maxDate =
    firstSeenDates.length > 0 ? formatDateISO(Math.max(...firstSeenDates)) : 'unknown';

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await api.bulkDeleteContacts([...selectedKeys]);
      toast.success(`Deleted ${result.deleted} contact${result.deleted === 1 ? '' : 's'}`);
      onDeleted();
      resetAndClose();
    } catch (err) {
      console.error('Bulk delete failed:', err);
      toast.error('Bulk delete failed', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && resetAndClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' ? 'Bulk Delete Contacts' : 'Confirm Deletion'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Select contacts to delete. Message history will be preserved and accessible if a contact is re-added, but will no longer appear in the sidebar.'
              : 'Review the contacts that will be permanently deleted.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Show</label>
                <select
                  value={typeFilter === 'all' ? 'all' : String(typeFilter)}
                  onChange={(e) =>
                    setTypeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  }
                  className="block h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="all">All</option>
                  <option value="1">Clients</option>
                  <option value="2">Repeaters</option>
                  <option value="3">Room Servers</option>
                  <option value="4">Sensors</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Created after</label>
                <Input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-48 h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Created before</label>
                <Input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-48 h-8 text-sm"
                />
              </div>
              <div className="flex gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
                  Select all
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleSelectNone}>
                  Select none
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {filteredContacts.length} contact{filteredContacts.length === 1 ? '' : 's'} shown
              {(startDate || endDate) && ' (filtered)'}
              {' · '}
              {selectedKeys.size} selected
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 border border-border rounded-md">
              {filteredContacts.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No contacts match the selected date range.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-3 py-1.5 w-8" />
                      <th className="px-3 py-1.5">Name</th>
                      <th className="px-3 py-1.5 hidden sm:table-cell">Type</th>
                      <th className="px-3 py-1.5">Key</th>
                      <th className="px-3 py-1.5 hidden sm:table-cell">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map((c) => (
                      <tr
                        key={c.public_key}
                        className="border-t border-border hover:bg-accent/50 cursor-pointer"
                        onClick={(e) => handleToggle(c.public_key, e.shiftKey)}
                      >
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            checked={selectedKeys.has(c.public_key)}
                            onChange={(e) =>
                              handleToggle(
                                c.public_key,
                                e.nativeEvent instanceof MouseEvent && e.nativeEvent.shiftKey
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-input"
                          />
                        </td>
                        <td className="px-3 py-1.5 truncate max-w-[10rem]">
                          {getContactDisplayName(c.name, c.public_key, c.last_advert)}
                        </td>
                        <td className="px-3 py-1.5 hidden sm:table-cell text-xs text-muted-foreground">
                          {CONTACT_TYPE_LABELS[c.type] ?? 'Unknown'}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground truncate max-w-[8rem]">
                          {c.public_key.slice(0, 12)}
                        </td>
                        <td className="px-3 py-1.5 hidden sm:table-cell text-xs text-muted-foreground">
                          {c.first_seen ? formatDate(c.first_seen) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={resetAndClose}>
                Cancel
              </Button>
              <Button
                variant="outline"
                className="border-warning text-warning hover:bg-warning/10 hover:text-warning"
                disabled={selectedKeys.size === 0}
                onClick={() => setStep('confirm')}
              >
                Proceed to confirmation ({selectedKeys.size})
              </Button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="flex-1 overflow-y-auto min-h-0 border border-border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-3 py-1.5">Name</th>
                    <th className="px-3 py-1.5">Type</th>
                    <th className="px-3 py-1.5">Key</th>
                    <th className="px-3 py-1.5 hidden sm:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedContacts.map((c) => (
                    <tr key={c.public_key} className="border-t border-border">
                      <td className="px-3 py-1.5 truncate max-w-[12rem]">
                        {getContactDisplayName(c.name, c.public_key, c.last_advert)}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {CONTACT_TYPE_LABELS[c.type] ?? 'Unknown'}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground truncate max-w-[8rem]">
                        {c.public_key.slice(0, 12)}
                      </td>
                      <td className="px-3 py-1.5 hidden sm:table-cell text-xs text-muted-foreground">
                        {c.first_seen ? formatDate(c.first_seen) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button
                variant="destructive"
                className="w-full h-auto py-3 text-wrap"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting
                  ? 'Deleting...'
                  : `I confirm permanent, irrevocable deletion of all listed nodes above, totalling ${[
                      contactCount > 0 && `${contactCount} contact${contactCount === 1 ? '' : 's'}`,
                      repeaterCount > 0 &&
                        `${repeaterCount} repeater${repeaterCount === 1 ? '' : 's'}`,
                      roomCount > 0 && `${roomCount} room${roomCount === 1 ? '' : 's'}`,
                      sensorCount > 0 && `${sensorCount} sensor${sensorCount === 1 ? '' : 's'}`,
                    ]
                      .filter(Boolean)
                      .join(', ')}, spanning creation dates from ${minDate} to ${maxDate}`}
              </Button>
              <Button variant="secondary" onClick={() => setStep('select')} disabled={deleting}>
                Back
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
