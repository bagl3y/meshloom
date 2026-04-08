import type { Contact } from '../types';

/**
 * Merge an incoming contact into an existing list.
 *
 * - If the contact exists (matched by public_key), merge fields and return
 *   a new array only if something changed (preserves referential equality
 *   for React when nothing changed).
 * - If the contact is new, append it.
 */
export function mergeContactIntoList(contacts: Contact[], incoming: Contact): Contact[] {
  const idx = contacts.findIndex((c) => c.public_key === incoming.public_key);
  if (idx >= 0) {
    const existing = contacts[idx];
    // Preserve user-action-only fields that should not be overwritten by
    // radio-event-driven WS updates (adverts, path updates, syncs).  These
    // fields are only changed via explicit user actions (favorite toggle,
    // mark-read) or full REST refetches, not via mesh/radio events.
    const merged = {
      ...existing,
      ...incoming,
      favorite: existing.favorite,
      last_read_at: existing.last_read_at,
    };
    const unchanged = (Object.keys(merged) as (keyof Contact)[]).every(
      (k) => existing[k] === merged[k]
    );
    if (unchanged) return contacts;
    const updated = [...contacts];
    updated[idx] = merged;
    return updated;
  }
  return [...contacts, incoming];
}
