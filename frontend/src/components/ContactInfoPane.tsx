import { type ReactNode, useEffect, useState } from 'react';
import { api } from '../api';
import { formatTime } from '../utils/messageParser';
import {
  isValidLocation,
  calculateDistance,
  formatDistance,
  formatRouteLabel,
  getEffectiveContactRoute,
  hasRoutingOverride,
  parsePathHops,
} from '../utils/pathUtils';
import { getMapFocusHash } from '../utils/urlHash';
import { isFavorite } from '../utils/favorites';
import { handleKeyboardActivate } from '../utils/a11y';
import { ContactAvatar } from './ContactAvatar';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { toast } from './ui/sonner';
import type { Contact, ContactDetail, Favorite, RadioConfig } from '../types';

const CONTACT_TYPE_LABELS: Record<number, string> = {
  0: 'Unknown',
  1: 'Client',
  2: 'Repeater',
  3: 'Room',
  4: 'Sensor',
};

function formatPathHashMode(mode: number): string | null {
  if (mode < 0 || mode > 2) {
    return null;
  }
  return `${mode + 1}-byte IDs`;
}

interface ContactInfoPaneProps {
  contactKey: string | null;
  fromChannel?: boolean;
  onClose: () => void;
  contacts: Contact[];
  config: RadioConfig | null;
  favorites: Favorite[];
  onToggleFavorite: (type: 'channel' | 'contact', id: string) => void;
  onNavigateToChannel?: (channelKey: string) => void;
  blockedKeys?: string[];
  blockedNames?: string[];
  onToggleBlockedKey?: (key: string) => void;
  onToggleBlockedName?: (name: string) => void;
}

export function ContactInfoPane({
  contactKey,
  fromChannel = false,
  onClose,
  contacts,
  config,
  favorites,
  onToggleFavorite,
  onNavigateToChannel,
  blockedKeys = [],
  blockedNames = [],
  onToggleBlockedKey,
  onToggleBlockedName,
}: ContactInfoPaneProps) {
  const isNameOnly = contactKey?.startsWith('name:') ?? false;
  const nameOnlyValue = isNameOnly && contactKey ? contactKey.slice(5) : null;

  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Get live contact data from contacts array (real-time via WS)
  const liveContact =
    contactKey && !isNameOnly ? (contacts.find((c) => c.public_key === contactKey) ?? null) : null;

  useEffect(() => {
    if (!contactKey || isNameOnly) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    api
      .getContactDetail(contactKey)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to fetch contact detail:', err);
          toast.error('Failed to load contact info');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactKey, isNameOnly]);

  // Use live contact data where available, fall back to detail snapshot
  const contact = liveContact ?? detail?.contact ?? null;

  const distFromUs =
    contact &&
    config &&
    isValidLocation(config.lat, config.lon) &&
    isValidLocation(contact.lat, contact.lon)
      ? calculateDistance(config.lat, config.lon, contact.lat, contact.lon)
      : null;
  const effectiveRoute = contact ? getEffectiveContactRoute(contact) : null;
  const pathHashModeLabel =
    effectiveRoute && effectiveRoute.pathLen >= 0
      ? formatPathHashMode(effectiveRoute.pathHashMode)
      : null;
  const learnedRouteLabel = contact ? formatRouteLabel(contact.last_path_len, true) : null;

  return (
    <Sheet open={contactKey !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[400px] p-0 flex flex-col">
        <SheetHeader className="sr-only">
          <SheetTitle>Contact Info</SheetTitle>
          <SheetDescription>Contact details and actions</SheetDescription>
        </SheetHeader>

        {isNameOnly && nameOnlyValue ? (
          <div className="flex-1 overflow-y-auto">
            {/* Name-only header */}
            <div className="px-5 pt-5 pb-4 border-b border-border">
              <div className="flex items-start gap-4">
                <ContactAvatar name={nameOnlyValue} publicKey={`name:${nameOnlyValue}`} size={56} />
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold truncate">{nameOnlyValue}</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    We have not heard an advertisement associated with this name, so we cannot
                    identify their key.
                  </p>
                </div>
              </div>
            </div>

            {fromChannel && <ChannelAttributionWarning />}

            {/* Block by name toggle */}
            {onToggleBlockedName && (
              <div className="px-5 py-3 border-b border-border">
                <button
                  type="button"
                  className="text-sm flex items-center gap-2 hover:text-primary transition-colors"
                  onClick={() => onToggleBlockedName(nameOnlyValue)}
                >
                  {blockedNames.includes(nameOnlyValue) ? (
                    <>
                      <span className="text-destructive text-lg">&#x2718;</span>
                      <span>Unblock this name</span>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground text-lg">&#x2718;</span>
                      <span>Block this name</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : loading && !detail ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        ) : contact ? (
          <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-border">
              <div className="flex items-start gap-4">
                <ContactAvatar
                  name={contact.name}
                  publicKey={contact.public_key}
                  size={56}
                  contactType={contact.type}
                />
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold truncate">
                    {contact.name || contact.public_key.slice(0, 12)}
                  </h2>
                  <span
                    className="text-xs font-mono text-muted-foreground cursor-pointer hover:text-primary transition-colors block truncate"
                    role="button"
                    tabIndex={0}
                    onKeyDown={handleKeyboardActivate}
                    onClick={() => {
                      navigator.clipboard.writeText(contact.public_key);
                      toast.success('Public key copied!');
                    }}
                    title="Click to copy"
                  >
                    {contact.public_key}
                  </span>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                      {CONTACT_TYPE_LABELS[contact.type] ?? 'Unknown'}
                    </span>
                    {contact.on_radio && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        On Radio
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {fromChannel && <ChannelAttributionWarning />}

            {/* Info grid */}
            <div className="px-5 py-3 border-b border-border">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {contact.last_seen && (
                  <InfoItem label="Last Seen" value={formatTime(contact.last_seen)} />
                )}
                {contact.first_seen && (
                  <InfoItem label="First Heard" value={formatTime(contact.first_seen)} />
                )}
                {contact.last_contacted && (
                  <InfoItem label="Last Contacted" value={formatTime(contact.last_contacted)} />
                )}
                {distFromUs !== null && (
                  <InfoItem label="Distance" value={formatDistance(distFromUs)} />
                )}
                {effectiveRoute && (
                  <InfoItem
                    label="Routing"
                    value={
                      effectiveRoute.forced ? (
                        <span>
                          {formatRouteLabel(effectiveRoute.pathLen, true)}{' '}
                          <span className="text-destructive">(forced)</span>
                        </span>
                      ) : (
                        formatRouteLabel(effectiveRoute.pathLen, true)
                      )
                    }
                  />
                )}
                {contact && hasRoutingOverride(contact) && learnedRouteLabel && (
                  <InfoItem label="Learned Route" value={learnedRouteLabel} />
                )}
                {pathHashModeLabel && <InfoItem label="Hop Width" value={pathHashModeLabel} />}
              </div>
            </div>

            {/* GPS */}
            {isValidLocation(contact.lat, contact.lon) && (
              <div className="px-5 py-3 border-b border-border">
                <SectionLabel>Location</SectionLabel>
                <span
                  className="text-sm font-mono cursor-pointer hover:text-primary hover:underline transition-colors"
                  role="button"
                  tabIndex={0}
                  onKeyDown={handleKeyboardActivate}
                  onClick={() => {
                    const url =
                      window.location.origin +
                      window.location.pathname +
                      getMapFocusHash(contact.public_key);
                    window.open(url, '_blank');
                  }}
                  title="View on map"
                >
                  {contact.lat!.toFixed(5)}, {contact.lon!.toFixed(5)}
                </span>
              </div>
            )}

            {/* Favorite toggle */}
            <div className="px-5 py-3 border-b border-border">
              <button
                type="button"
                className="text-sm flex items-center gap-2 hover:text-primary transition-colors"
                onClick={() => onToggleFavorite('contact', contact.public_key)}
                title="Favorite contacts stay loaded on the radio for ACK support"
              >
                {isFavorite(favorites, 'contact', contact.public_key) ? (
                  <>
                    <span className="text-favorite text-lg">&#9733;</span>
                    <span>Remove from favorites</span>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground text-lg">&#9734;</span>
                    <span>Add to favorites</span>
                  </>
                )}
              </button>
            </div>

            {/* Block toggles */}
            {(onToggleBlockedKey || onToggleBlockedName) && (
              <div className="px-5 py-3 border-b border-border space-y-2">
                {onToggleBlockedKey && (
                  <button
                    type="button"
                    className="text-sm flex items-center gap-2 hover:text-primary transition-colors"
                    onClick={() => onToggleBlockedKey(contact.public_key)}
                  >
                    {blockedKeys.includes(contact.public_key.toLowerCase()) ? (
                      <>
                        <span className="text-destructive text-lg">&#x2718;</span>
                        <span>Unblock this key</span>
                      </>
                    ) : (
                      <>
                        <span className="text-muted-foreground text-lg">&#x2718;</span>
                        <span>Block this key</span>
                      </>
                    )}
                  </button>
                )}
                {onToggleBlockedName && contact.name && (
                  <button
                    type="button"
                    className="text-sm flex items-center gap-2 hover:text-primary transition-colors"
                    onClick={() => onToggleBlockedName(contact.name!)}
                  >
                    {blockedNames.includes(contact.name) ? (
                      <>
                        <span className="text-destructive text-lg">&#x2718;</span>
                        <span>Unblock name &ldquo;{contact.name}&rdquo;</span>
                      </>
                    ) : (
                      <>
                        <span className="text-muted-foreground text-lg">&#x2718;</span>
                        <span>Block name &ldquo;{contact.name}&rdquo;</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* AKA (Name History) - only show if more than one name */}
            {detail && detail.name_history.length > 1 && (
              <div className="px-5 py-3 border-b border-border">
                <SectionLabel>Also Known As</SectionLabel>
                <div className="space-y-1">
                  {detail.name_history.map((h) => (
                    <div key={h.name} className="flex justify-between items-center text-sm">
                      <span className="font-medium truncate">{h.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {formatTime(h.first_seen)} &ndash; {formatTime(h.last_seen)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Message Stats */}
            {detail && (detail.dm_message_count > 0 || detail.channel_message_count > 0) && (
              <div className="px-5 py-3 border-b border-border">
                <SectionLabel>Messages</SectionLabel>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {detail.dm_message_count > 0 && (
                    <InfoItem
                      label="Direct Messages"
                      value={detail.dm_message_count.toLocaleString()}
                    />
                  )}
                  {detail.channel_message_count > 0 && (
                    <InfoItem
                      label="Channel Messages"
                      value={detail.channel_message_count.toLocaleString()}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Most Active Rooms */}
            {detail && detail.most_active_rooms.length > 0 && (
              <div className="px-5 py-3 border-b border-border">
                <SectionLabel>Most Active Rooms</SectionLabel>
                <div className="space-y-1">
                  {detail.most_active_rooms.map((room) => (
                    <div
                      key={room.channel_key}
                      className="flex justify-between items-center text-sm"
                    >
                      <span
                        className={
                          onNavigateToChannel
                            ? 'cursor-pointer hover:text-primary transition-colors truncate'
                            : 'truncate'
                        }
                        role={onNavigateToChannel ? 'button' : undefined}
                        tabIndex={onNavigateToChannel ? 0 : undefined}
                        onKeyDown={onNavigateToChannel ? handleKeyboardActivate : undefined}
                        onClick={() => onNavigateToChannel?.(room.channel_key)}
                      >
                        {room.channel_name.startsWith('#') || room.channel_name === 'Public'
                          ? room.channel_name
                          : `#${room.channel_name}`}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {room.message_count.toLocaleString()} msg
                        {room.message_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nearest Repeaters */}
            {detail && detail.nearest_repeaters.length > 0 && (
              <div className="px-5 py-3 border-b border-border">
                <SectionLabel>Nearest Repeaters</SectionLabel>
                <div className="space-y-1">
                  {detail.nearest_repeaters.map((r) => (
                    <div key={r.public_key} className="flex justify-between items-center text-sm">
                      <span className="truncate">{r.name || r.public_key.slice(0, 12)}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {r.path_len === 0
                          ? 'direct'
                          : `${r.path_len} hop${r.path_len > 1 ? 's' : ''}`}{' '}
                        · {r.heard_count}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Advert Paths */}
            {detail && detail.advert_paths.length > 0 && (
              <div className="px-5 py-3">
                <SectionLabel>Recent Advert Paths</SectionLabel>
                <div className="space-y-1">
                  {detail.advert_paths.map((p) => (
                    <div
                      key={p.path + p.first_seen}
                      className="flex justify-between items-center text-sm"
                    >
                      <span className="font-mono text-xs truncate">
                        {p.path ? parsePathHops(p.path, p.path_len).join(' → ') : '(direct)'}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {p.heard_count}x · {formatTime(p.last_seen)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Contact not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
      {children}
    </h3>
  );
}

function ChannelAttributionWarning() {
  return (
    <div className="mx-5 my-3 px-3 py-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
      <p className="text-xs text-yellow-600 dark:text-yellow-400">
        Channel sender identity is based on best-effort name matching. Different nodes using the
        same name will be attributed to the same contact. Message counts and key-based statistics
        may be inaccurate.
      </p>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className="font-medium text-sm leading-tight">{value}</p>
    </div>
  );
}
