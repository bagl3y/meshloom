import { Fragment, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Polyline } from 'react-leaflet';
import type { LatLngBoundsExpression, CircleMarker as LeafletCircleMarker } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Contact, RadioConfig, RawPacket } from '../types';
import { formatTime } from '../utils/messageParser';
import { isValidLocation } from '../utils/pathUtils';
import { CONTACT_TYPE_REPEATER } from '../types';
import {
  parsePacket,
  getPacketLabel,
  PARTICLE_COLOR_MAP,
  dedupeConsecutive,
} from '../utils/visualizerUtils';
import { getRawPacketObservationKey } from '../utils/rawPacketIdentity';

interface MapViewProps {
  contacts: Contact[];
  /** Public key of contact to focus on and open popup */
  focusedKey?: string | null;
  rawPackets?: RawPacket[];
  config?: RadioConfig | null;
}

const MAP_RECENCY_COLORS = {
  recent: '#06b6d4',
  today: '#2563eb',
  stale: '#f59e0b',
  old: '#64748b',
} as const;
const MAP_MARKER_STROKE = '#0f172a';
const MAP_REPEATER_RING = '#f8fafc';

// --- Packet visualization constants ---
const THREE_DAYS_SEC = 3 * 24 * 60 * 60;
const PARTICLE_LIFETIME_MS = 3000;
const PARTICLE_TAIL_LENGTH = 0.25; // fraction of progress to trail behind
const PARTICLE_RADIUS = 8;
const PARTICLE_TAIL_WIDTH = 5;
const MAX_MAP_PARTICLES = 200;

// --- Helpers ---

function getMarkerColor(lastSeen: number | null | undefined): string {
  if (lastSeen == null) return MAP_RECENCY_COLORS.old;
  const now = Date.now() / 1000;
  const age = now - lastSeen;
  const hour = 3600;
  const day = 86400;

  if (age < hour) return MAP_RECENCY_COLORS.recent;
  if (age < day) return MAP_RECENCY_COLORS.today;
  if (age < 3 * day) return MAP_RECENCY_COLORS.stale;
  return MAP_RECENCY_COLORS.old;
}

/** Resolve a hop token to a single contact with GPS, or null. */
function resolveHopToGps(hopToken: string, prefixIndex: Map<string, Contact[]>): Contact | null {
  const matches = prefixIndex.get(hopToken.toLowerCase());
  if (!matches || matches.length !== 1) return null;
  const c = matches[0];
  return isValidLocation(c.lat, c.lon) ? c : null;
}

/** Collect public keys of all unambiguously resolved GPS-bearing contacts from a parsed packet. */
function resolvePacketContacts(
  parsed: ReturnType<typeof parsePacket>,
  prefixIndex: Map<string, Contact[]>,
  myLatLon: [number, number] | null,
  config?: RadioConfig | null
): Set<string> {
  const keys = new Set<string>();
  if (!parsed) return keys;

  // Source
  const sourcePrefixes = parsed.advertPubkey
    ? [parsed.advertPubkey.slice(0, 12).toLowerCase()]
    : parsed.srcHash
      ? [parsed.srcHash.toLowerCase()]
      : [];
  for (const prefix of sourcePrefixes) {
    const matches = prefixIndex.get(prefix);
    if (matches?.length === 1 && isValidLocation(matches[0].lat, matches[0].lon)) {
      keys.add(matches[0].public_key);
    }
  }

  // Intermediate hops
  for (const hop of parsed.pathBytes) {
    if (hop.length < 4) continue;
    const matches = prefixIndex.get(hop.toLowerCase());
    if (matches?.length === 1 && isValidLocation(matches[0].lat, matches[0].lon)) {
      keys.add(matches[0].public_key);
    }
  }

  // Self
  if (myLatLon && config?.public_key) {
    keys.add(config.public_key.toLowerCase());
  }

  // Destination
  if (parsed.dstHash) {
    const matches = prefixIndex.get(parsed.dstHash.toLowerCase());
    if (matches?.length === 1 && isValidLocation(matches[0].lat, matches[0].lon)) {
      keys.add(matches[0].public_key);
    }
  }

  return keys;
}

interface MapParticle {
  id: number;
  path: [number, number][]; // lat/lon waypoints
  color: string;
  startedAt: number;
}

// --- Map bounds handler ---

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
    if (focusedContact && focusedContact.lat != null && focusedContact.lon != null) {
      map.setView([focusedContact.lat, focusedContact.lon], 12);
      setHasInitialized(true);
      return;
    }

    if (hasInitialized) return;

    const fitToContacts = () => {
      if (contacts.length === 0) {
        map.setView([20, 0], 2);
        setHasInitialized(true);
        return;
      }

      if (contacts.length === 1) {
        map.setView([contacts[0].lat!, contacts[0].lon!], 10);
        setHasInitialized(true);
        return;
      }

      const bounds: LatLngBoundsExpression = contacts.map(
        (c) => [c.lat!, c.lon!] as [number, number]
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      setHasInitialized(true);
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          map.setView([position.coords.latitude, position.coords.longitude], 8);
          setHasInitialized(true);
        },
        () => {
          fitToContacts();
        },
        { timeout: 5000, maximumAge: 300000 }
      );
    } else {
      fitToContacts();
    }
  }, [map, contacts, hasInitialized, focusedContact]);

  return null;
}

// --- Canvas particle overlay ---

function ParticleOverlay({ particles }: { particles: MapParticle[] }) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const container = map.getContainer();
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '450'; // above tiles, below popups
    container.appendChild(canvas);
    canvasRef.current = canvas;

    const resize = () => {
      const size = map.getSize();
      canvas.width = size.x * window.devicePixelRatio;
      canvas.height = size.y * window.devicePixelRatio;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
    };
    resize();
    map.on('resize', resize);
    map.on('zoom', resize);

    return () => {
      cancelAnimationFrame(animRef.current);
      map.off('resize', resize);
      map.off('zoom', resize);
      container.removeChild(canvas);
      canvasRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const now = Date.now();
      const dpr = window.devicePixelRatio;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      for (const particle of particles) {
        const elapsed = now - particle.startedAt;
        if (elapsed < 0 || elapsed > PARTICLE_LIFETIME_MS) continue;
        const progress = elapsed / PARTICLE_LIFETIME_MS;
        const path = particle.path;
        if (path.length < 2) continue;

        // Calculate total path length in pixels for even speed
        const pixelPath = path.map((ll) => map.latLngToContainerPoint(L.latLng(ll[0], ll[1])));
        const segLengths: number[] = [];
        let totalLen = 0;
        for (let i = 1; i < pixelPath.length; i++) {
          const dx = pixelPath[i].x - pixelPath[i - 1].x;
          const dy = pixelPath[i].y - pixelPath[i - 1].y;
          const len = Math.sqrt(dx * dx + dy * dy);
          segLengths.push(len);
          totalLen += len;
        }
        if (totalLen === 0) continue;

        // Interpolate head position
        const headDist = progress * totalLen;
        const tailDist = Math.max(0, headDist - PARTICLE_TAIL_LENGTH * totalLen);

        const pointAtDist = (d: number): { x: number; y: number } => {
          let accum = 0;
          for (let i = 0; i < segLengths.length; i++) {
            if (accum + segLengths[i] >= d) {
              const t = segLengths[i] > 0 ? (d - accum) / segLengths[i] : 0;
              return {
                x: pixelPath[i].x + (pixelPath[i + 1].x - pixelPath[i].x) * t,
                y: pixelPath[i].y + (pixelPath[i + 1].y - pixelPath[i].y) * t,
              };
            }
            accum += segLengths[i];
          }
          const last = pixelPath[pixelPath.length - 1];
          return { x: last.x, y: last.y };
        };

        const head = pointAtDist(headDist);
        const tail = pointAtDist(tailDist);

        // Draw tail as a gradient line from transparent to opaque
        const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
        grad.addColorStop(0, particle.color + '00');
        grad.addColorStop(1, particle.color + 'cc');
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);

        // Sample intermediate points along the tail for curved paths
        const steps = 8;
        for (let s = 1; s <= steps; s++) {
          const d = tailDist + ((headDist - tailDist) * s) / steps;
          const pt = pointAtDist(d);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = PARTICLE_TAIL_WIDTH;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Draw head blob with glow
        const fade = progress > 0.8 ? 1 - (progress - 0.8) / 0.2 : 1;
        const alpha = Math.round(fade * 230)
          .toString(16)
          .padStart(2, '0');
        // Outer glow
        ctx.beginPath();
        ctx.arc(head.x, head.y, PARTICLE_RADIUS + 4, 0, Math.PI * 2);
        ctx.fillStyle =
          particle.color +
          Math.round(fade * 40)
            .toString(16)
            .padStart(2, '0');
        ctx.fill();
        // Core blob
        ctx.beginPath();
        ctx.arc(head.x, head.y, PARTICLE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = particle.color + alpha;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 12 * fade;
        ctx.fill();
        ctx.shadowBlur = 0;
        // Bright center
        ctx.beginPath();
        ctx.arc(head.x, head.y, PARTICLE_RADIUS * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff' + alpha;
        ctx.fill();
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [map, particles]);

  // Redraw on map move/zoom
  useEffect(() => {
    const redraw = () => {}; // Animation loop already redraws every frame
    map.on('move', redraw);
    map.on('zoom', redraw);
    return () => {
      map.off('move', redraw);
      map.off('zoom', redraw);
    };
  }, [map]);

  return null;
}

// --- Main component ---

export function MapView({ contacts, focusedKey, rawPackets, config }: MapViewProps) {
  const [sevenDaysAgo] = useState(() => Date.now() / 1000 - 7 * 24 * 60 * 60);
  const [showPackets, setShowPackets] = useState(false);
  const [discoveryMode, setDiscoveryMode] = useState(false);
  const [discoveredKeys, setDiscoveredKeys] = useState<Set<string>>(new Set());
  const [particles, setParticles] = useState<MapParticle[]>([]);
  const particleIdRef = useRef(0);
  const seenObservationsRef = useRef(new Set<string>());

  // Build prefix index for hop resolution
  const prefixIndex = useMemo(() => {
    const index = new Map<string, Contact[]>();
    for (const c of contacts) {
      const pubkey = c.public_key.toLowerCase();
      // Index at every prefix length from 1 to 12 characters (matching visualizer logic)
      for (let len = 1; len <= 12 && len <= pubkey.length; len++) {
        const prefix = pubkey.slice(0, len);
        const arr = index.get(prefix);
        if (arr) arr.push(c);
        else index.set(prefix, [c]);
      }
    }
    return index;
  }, [contacts]);

  // Self GPS
  const myLatLon = useMemo<[number, number] | null>(() => {
    if (!config || !isValidLocation(config.lat, config.lon)) return null;
    return [config.lat, config.lon];
  }, [config]);

  // Determine time window for packet visualization
  const threeDaysAgoSec = useMemo(() => Date.now() / 1000 - THREE_DAYS_SEC, []);

  // Filter contacts for map display
  const mappableContacts = useMemo(() => {
    if (showPackets && discoveryMode) {
      // Discovery mode: only show nodes that have appeared in resolved packets
      return contacts.filter(
        (c) => isValidLocation(c.lat, c.lon) && discoveredKeys.has(c.public_key)
      );
    }
    if (showPackets) {
      // Packet mode: show only last 3 days
      return contacts.filter(
        (c) =>
          isValidLocation(c.lat, c.lon) &&
          (c.public_key === focusedKey || (c.last_seen != null && c.last_seen > threeDaysAgoSec))
      );
    }
    return contacts.filter(
      (c) =>
        isValidLocation(c.lat, c.lon) &&
        (c.public_key === focusedKey || (c.last_seen != null && c.last_seen > sevenDaysAgo))
    );
  }, [
    contacts,
    focusedKey,
    sevenDaysAgo,
    threeDaysAgoSec,
    showPackets,
    discoveryMode,
    discoveredKeys,
  ]);

  // Resolve a path of hop tokens to geographic waypoints (only unambiguous + has GPS)
  const resolvePacketPath = useCallback(
    (parsed: ReturnType<typeof parsePacket>): [number, number][] | null => {
      if (!parsed) return null;

      const waypoints: [number, number][] = [];

      // Source: advertPubkey, srcHash, or groupTextSender resolved by name
      let sourceContact: Contact | null = null;
      if (parsed.advertPubkey) {
        const prefix = parsed.advertPubkey.slice(0, 12).toLowerCase();
        const matches = prefixIndex.get(prefix);
        if (matches?.length === 1 && isValidLocation(matches[0].lat, matches[0].lon)) {
          sourceContact = matches[0];
        }
      } else if (parsed.srcHash) {
        sourceContact = resolveHopToGps(parsed.srcHash, prefixIndex);
      }

      if (sourceContact) {
        waypoints.push([sourceContact.lat!, sourceContact.lon!]);
      }

      // Intermediate hops (path bytes)
      for (const hop of parsed.pathBytes) {
        // Only resolve 2+ byte hops (4+ hex chars) to avoid ambiguous 1-byte hops
        if (hop.length < 4) continue;
        const contact = resolveHopToGps(hop, prefixIndex);
        if (contact) {
          waypoints.push([contact.lat!, contact.lon!]);
        }
      }

      // Destination: self (our radio), or dstHash
      if (myLatLon) {
        waypoints.push(myLatLon);
      } else if (parsed.dstHash) {
        const dest = resolveHopToGps(parsed.dstHash, prefixIndex);
        if (dest) {
          waypoints.push([dest.lat!, dest.lon!]);
        }
      }

      // Dedupe consecutive identical waypoints
      const deduped = dedupeConsecutive(waypoints.map((w) => `${w[0]},${w[1]}`));
      if (deduped.length < 2) return null;

      return deduped.map((s) => {
        const [lat, lon] = s.split(',').map(Number);
        return [lat, lon] as [number, number];
      });
    },
    [prefixIndex, myLatLon]
  );

  // Process new packets into particles and track discovered contacts
  useEffect(() => {
    if (!showPackets || !rawPackets?.length) return;

    const now = Date.now();
    const newParticles: MapParticle[] = [];
    const newDiscovered = new Set<string>();

    for (const pkt of rawPackets) {
      // Skip old packets
      if (pkt.timestamp < threeDaysAgoSec) continue;

      // Deduplicate by observation
      const obsKey = getRawPacketObservationKey(pkt);
      if (seenObservationsRef.current.has(obsKey)) continue;
      seenObservationsRef.current.add(obsKey);

      const parsed = parsePacket(pkt.data);
      if (!parsed) continue;

      const path = resolvePacketPath(parsed);
      if (!path) continue;

      // Collect all unambiguously resolved contacts from this packet for discovery mode
      const resolvedContacts = resolvePacketContacts(parsed, prefixIndex, myLatLon, config);
      for (const key of resolvedContacts) newDiscovered.add(key);

      newParticles.push({
        id: particleIdRef.current++,
        path,
        color: PARTICLE_COLOR_MAP[getPacketLabel(parsed.payloadType)],
        startedAt: now,
      });
    }

    if (newDiscovered.size > 0) {
      setDiscoveredKeys((prev) => {
        const next = new Set(prev);
        for (const k of newDiscovered) next.add(k);
        return next.size !== prev.size ? next : prev;
      });
    }

    if (newParticles.length === 0) return;

    setParticles((prev) => {
      const combined = [...prev, ...newParticles];
      // Prune expired and cap total
      const alive = combined.filter((p) => now - p.startedAt < PARTICLE_LIFETIME_MS);
      return alive.slice(-MAX_MAP_PARTICLES);
    });
  }, [rawPackets, showPackets, resolvePacketPath, threeDaysAgoSec, prefixIndex, myLatLon, config]);

  // Prune expired particles periodically
  useEffect(() => {
    if (!showPackets) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setParticles((prev) => prev.filter((p) => now - p.startedAt < PARTICLE_LIFETIME_MS));
    }, 1000);
    return () => clearInterval(interval);
  }, [showPackets]);

  // Reset discovered set when exiting discovery mode
  useEffect(() => {
    if (!discoveryMode) setDiscoveredKeys(new Set());
  }, [discoveryMode]);

  // Clear state when toggling off
  useEffect(() => {
    if (!showPackets) {
      setParticles([]);
      setDiscoveredKeys(new Set());
      setDiscoveryMode(false);
      seenObservationsRef.current.clear();
    }
  }, [showPackets]);

  // Find the focused contact by key
  const focusedContact = useMemo(() => {
    if (!focusedKey) return null;
    return mappableContacts.find((c) => c.public_key === focusedKey) || null;
  }, [focusedKey, mappableContacts]);

  const includesFocusedOutsideWindow =
    focusedContact != null &&
    (focusedContact.last_seen == null ||
      focusedContact.last_seen <= (showPackets ? threeDaysAgoSec : sevenDaysAgo));

  // Track marker refs to open popup programmatically
  const markerRefs = useRef<Record<string, LeafletCircleMarker | null>>({});

  const setMarkerRef = useCallback((key: string, ref: LeafletCircleMarker | null) => {
    if (ref === null) {
      delete markerRefs.current[key];
      return;
    }
    markerRefs.current[key] = ref;
  }, []);

  useEffect(() => {
    const currentKeys = new Set(mappableContacts.map((contact) => contact.public_key));
    for (const key of Object.keys(markerRefs.current)) {
      if (!currentKeys.has(key)) {
        delete markerRefs.current[key];
      }
    }
  }, [mappableContacts]);

  useEffect(() => {
    if (focusedContact && markerRefs.current[focusedContact.public_key]) {
      const timer = setTimeout(() => {
        markerRefs.current[focusedContact.public_key]?.openPopup();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [focusedContact]);

  // Gather unique link paths for static route lines when packet viz is on
  const routeLines = useMemo(() => {
    if (!showPackets) return [];
    const seen = new Set<string>();
    const lines: { path: [number, number][]; color: string }[] = [];
    for (const p of particles) {
      const key = p.path.map((w) => `${w[0]},${w[1]}`).join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push({ path: p.path, color: p.color });
    }
    return lines;
  }, [showPackets, particles]);

  const timeWindowLabel = showPackets ? '3 days' : '7 days';
  const infoLabel =
    showPackets && discoveryMode
      ? `${mappableContacts.length} node${mappableContacts.length !== 1 ? 's' : ''} discovered from live traffic`
      : `Showing ${mappableContacts.length} contact${mappableContacts.length !== 1 ? 's' : ''} heard in the last ${timeWindowLabel}${includesFocusedOutsideWindow ? ' plus the focused contact' : ''}`;

  return (
    <div className="flex flex-col h-full">
      {/* Info bar */}
      <div className="px-4 py-2 bg-muted/50 text-xs text-muted-foreground flex items-center justify-between">
        <span>{infoLabel}</span>
        <div className="flex items-center gap-3">
          {!showPackets && (
            <>
              <span className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: MAP_RECENCY_COLORS.recent }}
                  aria-hidden="true"
                />{' '}
                &lt;1h
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: MAP_RECENCY_COLORS.today }}
                  aria-hidden="true"
                />{' '}
                &lt;1d
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: MAP_RECENCY_COLORS.stale }}
                  aria-hidden="true"
                />{' '}
                &lt;3d
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: MAP_RECENCY_COLORS.old }}
                  aria-hidden="true"
                />{' '}
                older
              </span>
            </>
          )}
          {showPackets && (
            <>
              <span className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: PARTICLE_COLOR_MAP['AD'] }}
                  aria-hidden="true"
                />
                Ad
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: PARTICLE_COLOR_MAP['GT'] }}
                  aria-hidden="true"
                />
                Ch
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: PARTICLE_COLOR_MAP['DM'] }}
                  aria-hidden="true"
                />
                DM
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: PARTICLE_COLOR_MAP['ACK'] }}
                  aria-hidden="true"
                />
                ACK
              </span>
            </>
          )}
          <span className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-full border-2"
              style={{ borderColor: MAP_REPEATER_RING, backgroundColor: MAP_RECENCY_COLORS.today }}
              aria-hidden="true"
            />{' '}
            repeater
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={showPackets}
              onChange={(e) => setShowPackets(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-[0.6875rem]">Visualize packets</span>
          </label>
          {showPackets && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={discoveryMode}
                onChange={(e) => setDiscoveryMode(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-[0.6875rem]">Discover nodes</span>
            </label>
          )}
        </div>
      </div>

      {/* Map */}
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

          {/* Faint route lines for active packet paths */}
          {showPackets &&
            routeLines.map((line, i) => (
              <Polyline
                key={i}
                positions={line.path}
                pathOptions={{ color: line.color, weight: 1, opacity: 0.15, dashArray: '4 6' }}
              />
            ))}

          {mappableContacts.map((contact) => {
            const isRepeater = contact.type === CONTACT_TYPE_REPEATER;
            const color = getMarkerColor(contact.last_seen);
            const displayName = contact.name || contact.public_key.slice(0, 12);
            const lastHeardLabel =
              contact.last_seen != null
                ? formatTime(contact.last_seen)
                : 'Never heard by this server';
            const radius = isRepeater ? 10 : 7;

            return (
              <Fragment key={contact.public_key}>
                <CircleMarker
                  key={contact.public_key}
                  ref={(ref) => setMarkerRef(contact.public_key, ref)}
                  center={[contact.lat!, contact.lon!]}
                  radius={radius}
                  pathOptions={{
                    color: isRepeater ? MAP_REPEATER_RING : MAP_MARKER_STROKE,
                    fillColor: color,
                    fillOpacity: 0.9,
                    weight: isRepeater ? 3 : 2,
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
              </Fragment>
            );
          })}

          {showPackets && <ParticleOverlay particles={particles} />}
        </MapContainer>
      </div>
    </div>
  );
}
