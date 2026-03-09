import type { ReactNode } from 'react';
import { toast } from './ui/sonner';
import { api } from '../api';
import { formatTime } from '../utils/messageParser';
import {
  isValidLocation,
  calculateDistance,
  formatDistance,
  formatRouteLabel,
  formatRoutingOverrideInput,
  getEffectiveContactRoute,
} from '../utils/pathUtils';
import { getMapFocusHash } from '../utils/urlHash';
import { handleKeyboardActivate } from '../utils/a11y';
import type { Contact } from '../types';

interface ContactStatusInfoProps {
  contact: Contact;
  ourLat: number | null;
  ourLon: number | null;
}

/**
 * Renders the "(Last heard: ..., N hops, lat, lon (dist))" status line
 * shared between ChatHeader and RepeaterDashboard.
 */
export function ContactStatusInfo({ contact, ourLat, ourLon }: ContactStatusInfoProps) {
  const parts: ReactNode[] = [];
  const effectiveRoute = getEffectiveContactRoute(contact);

  const editRoutingOverride = () => {
    const route = window.prompt(
      'Enter explicit path as comma-separated 1, 2, or 3 byte hops (for example "ae,f1" or "ae92,f13e").\nEnter 0 to force direct always.\nEnter -1 to force flooding always.\nLeave blank to clear the override and reset to flood until a new path is heard.',
      formatRoutingOverrideInput(contact)
    );
    if (route === null) {
      return;
    }

    api.setContactRoutingOverride(contact.public_key, route).then(
      () =>
        toast.success(
          route.trim() === '' ? 'Routing override cleared' : 'Routing override updated'
        ),
      (err: unknown) =>
        toast.error(err instanceof Error ? err.message : 'Failed to update routing override')
    );
  };

  if (contact.last_seen) {
    parts.push(`Last heard: ${formatTime(contact.last_seen)}`);
  }

  parts.push(
    <span
      key="path"
      className="cursor-pointer hover:text-primary hover:underline"
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyboardActivate}
      onClick={(e) => {
        e.stopPropagation();
        editRoutingOverride();
      }}
      title="Click to edit routing override"
    >
      {formatRouteLabel(effectiveRoute.pathLen)}
      {effectiveRoute.forced && <span className="text-destructive"> (forced)</span>}
    </span>
  );

  if (isValidLocation(contact.lat, contact.lon)) {
    const distFromUs =
      ourLat != null && ourLon != null && isValidLocation(ourLat, ourLon)
        ? calculateDistance(ourLat, ourLon, contact.lat, contact.lon)
        : null;
    parts.push(
      <span key="coords">
        <span
          className="font-mono cursor-pointer hover:text-primary hover:underline"
          role="button"
          tabIndex={0}
          onKeyDown={handleKeyboardActivate}
          onClick={(e) => {
            e.stopPropagation();
            const url =
              window.location.origin +
              window.location.pathname +
              getMapFocusHash(contact.public_key);
            window.open(url, '_blank');
          }}
          title="View on map"
        >
          {contact.lat!.toFixed(3)}, {contact.lon!.toFixed(3)}
        </span>
        {distFromUs !== null && ` (${formatDistance(distFromUs)})`}
      </span>
    );
  }

  if (parts.length === 0) return null;

  return (
    <span className="font-normal text-sm text-muted-foreground flex-shrink-0">
      (
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && ', '}
          {part}
        </span>
      ))}
      )
    </span>
  );
}
