import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, CircleMarker as LeafletCircleMarker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Contact } from '../types';
import { formatTime } from '../utils/messageParser';
import { isValidLocation } from '../utils/pathUtils';
import { CONTACT_TYPE_REPEATER } from '../types';

interface MapViewProps {
  contacts: Contact[];
  /** Public key of contact to focus on and open popup */
  focusedKey?: string | null;
}

// Calculate marker color based on how recently the contact was heard
function getMarkerColor(lastSeen: number | null | undefined): string {
  if (lastSeen == null) return '#9ca3af';
  const now = Date.now() / 1000;
  const age = now - lastSeen;
  const hour = 3600;
  const day = 86400;

  if (age < hour) return '#22c55e'; // Bright green - less than 1 hour
  if (age < day) return '#4ade80'; // Light green - less than 1 day
  if (age < 3 * day) return '#a3e635'; // Yellow-green - less than 3 days
  return '#9ca3af'; // Gray - older (up to 7 days)
}

// Component to handle map bounds fitting
function MapBoundsHandler({
  contacts,
  focusedContact,
}: {
  contacts: Contact[];
  focusedContact: Contact | null;
}) {
  const map = useMap();
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    // If we have a focused contact, center on it immediately (even if already initialized)
    if (focusedContact && focusedContact.lat != null && focusedContact.lon != null) {
      map.setView([focusedContact.lat, focusedContact.lon], 12);
      setHasInitialized(true);
      return;
    }

    if (hasInitialized) return;

    const fitToContacts = () => {
      if (contacts.length === 0) {
        // No contacts with location - show world view
        map.setView([20, 0], 2);
        setHasInitialized(true);
        return;
      }

      if (contacts.length === 1) {
        // Single contact - center on it
        map.setView([contacts[0].lat!, contacts[0].lon!], 10);
        setHasInitialized(true);
        return;
      }

      // Multiple contacts - fit bounds
      const bounds: LatLngBoundsExpression = contacts.map(
        (c) => [c.lat!, c.lon!] as [number, number]
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      setHasInitialized(true);
    };

    // Try geolocation first
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Success - center on user location with reasonable zoom
          map.setView([position.coords.latitude, position.coords.longitude], 8);
          setHasInitialized(true);
        },
        () => {
          // Geolocation denied/failed - fit to contacts
          fitToContacts();
        },
        { timeout: 5000, maximumAge: 300000 }
      );
    } else {
      // No geolocation support - fit to contacts
      fitToContacts();
    }
  }, [map, contacts, hasInitialized, focusedContact]);

  return null;
}

export function MapView({ contacts, focusedKey }: MapViewProps) {
  const sevenDaysAgo = Date.now() / 1000 - 7 * 24 * 60 * 60;

  // Filter to contacts with GPS coordinates, heard within the last 7 days.
  // Always include the focused contact so "view on map" links work for older nodes.
  const mappableContacts = useMemo(() => {
    return contacts.filter(
      (c) =>
        isValidLocation(c.lat, c.lon) &&
        (c.public_key === focusedKey || (c.last_seen != null && c.last_seen > sevenDaysAgo))
    );
  }, [contacts, focusedKey, sevenDaysAgo]);

  // Find the focused contact by key
  const focusedContact = useMemo(() => {
    if (!focusedKey) return null;
    return mappableContacts.find((c) => c.public_key === focusedKey) || null;
  }, [focusedKey, mappableContacts]);

  const includesFocusedOutsideWindow =
    focusedContact != null &&
    (focusedContact.last_seen == null || focusedContact.last_seen <= sevenDaysAgo);

  // Track marker refs to open popup programmatically
  const markerRefs = useRef<Record<string, LeafletCircleMarker | null>>({});

  // Store ref for a marker
  const setMarkerRef = useCallback((key: string, ref: LeafletCircleMarker | null) => {
    markerRefs.current[key] = ref;
  }, []);

  // Open popup for focused contact after map is ready
  useEffect(() => {
    if (focusedContact && markerRefs.current[focusedContact.public_key]) {
      // Small delay to ensure map has finished rendering
      const timer = setTimeout(() => {
        markerRefs.current[focusedContact.public_key]?.openPopup();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [focusedContact]);

  return (
    <div className="flex flex-col h-full">
      {/* Info bar */}
      <div className="px-4 py-2 bg-muted/50 text-xs text-muted-foreground flex items-center justify-between">
        <span>
          Showing {mappableContacts.length} contact{mappableContacts.length !== 1 ? 's' : ''} heard
          in the last 7 days
          {includesFocusedOutsideWindow ? ' plus the focused contact' : ''}
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-[#22c55e]" aria-hidden="true" /> &lt;1h
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-[#4ade80]" aria-hidden="true" /> &lt;1d
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-[#a3e635]" aria-hidden="true" /> &lt;3d
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-[#9ca3af]" aria-hidden="true" /> older
          </span>
        </div>
      </div>

      {/* Map - z-index constrained to stay below modals/sheets */}
      <div
        className="flex-1 relative"
        style={{ zIndex: 0 }}
        role="img"
        aria-label="Map showing mesh node locations"
      >
        <MapContainer
          center={[20, 0]}
          zoom={2}
          className="h-full w-full"
          style={{ background: '#1a1a2e' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBoundsHandler contacts={mappableContacts} focusedContact={focusedContact} />

          {mappableContacts.map((contact) => {
            const isRepeater = contact.type === CONTACT_TYPE_REPEATER;
            const color = getMarkerColor(contact.last_seen);
            const displayName = contact.name || contact.public_key.slice(0, 12);
            const lastHeardLabel =
              contact.last_seen != null
                ? formatTime(contact.last_seen)
                : 'Never heard by this server';

            return (
              <CircleMarker
                key={contact.public_key}
                ref={(ref) => setMarkerRef(contact.public_key, ref)}
                center={[contact.lat!, contact.lon!]}
                radius={isRepeater ? 10 : 7}
                pathOptions={{
                  color: isRepeater ? color : '#000',
                  fillColor: color,
                  fillOpacity: 0.8,
                  weight: isRepeater ? 0 : 1,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-medium flex items-center gap-1">
                      {isRepeater && (
                        <span title="Repeater" aria-hidden="true">
                          🛜
                        </span>
                      )}
                      {displayName}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Last heard: {lastHeardLabel}</div>
                    <div className="text-xs text-gray-400 mt-1 font-mono">
                      {contact.lat!.toFixed(5)}, {contact.lon!.toFixed(5)}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
