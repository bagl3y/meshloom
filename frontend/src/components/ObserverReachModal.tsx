import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import { api, formatApiError } from '../api';
import { useDistanceUnit } from '../contexts/DistanceUnitContext';
import type { ObserverReachEntry, PacketObserverReachResponse } from '../types';
import { formatDistance } from '../utils/pathUtils';
import {
  OSM_RASTER_REFERRER_POLICY,
  OSM_RASTER_TILE_ATTRIBUTION,
  OSM_RASTER_TILE_URL,
} from '../utils/mapTiles';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [map]);
  return null;
}

function ObserverMiniMap({ observers }: { observers: ObserverReachEntry[] }) {
  const { t } = useTranslation();
  const valid = observers.filter(
    (item): item is ObserverReachEntry & { lat: number; lon: number } =>
      item.lat != null && item.lon != null
  );
  if (valid.length === 0) return null;
  const center: [number, number] = [valid[0].lat, valid[0].lon];
  return (
    <div
      className="h-48 rounded border border-border overflow-hidden"
      role="img"
      aria-label={t('messageList.observerReachMapAria')}
    >
      <MapContainer
        center={center}
        zoom={6}
        className="h-48 w-full"
        style={{ background: '#1a1a2e' }}
      >
        <InvalidateOnResize />
        <TileLayer
          attribution={OSM_RASTER_TILE_ATTRIBUTION}
          url={OSM_RASTER_TILE_URL}
          referrerPolicy={OSM_RASTER_REFERRER_POLICY}
        />
        {valid.map((observer, index) => (
          <CircleMarker
            key={`${observer.public_key ?? observer.name}-${index}`}
            center={[observer.lat, observer.lon]}
            radius={6}
            pathOptions={{
              color: '#000',
              fillColor: '#3b82f6',
              fillOpacity: 0.8,
              weight: 1,
            }}
          >
            <Popup>
              <span className="text-sm">{observer.name}</span>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

interface ObserverReachModalProps {
  packetHash: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ObserverReachModal({ packetHash, open, onOpenChange }: ObserverReachModalProps) {
  const { t } = useTranslation();
  const { distanceUnit } = useDistanceUnit();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PacketObserverReachResponse | null>(null);

  useEffect(() => {
    if (!open || !packetHash) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    void api
      .getPacketObserverReach(packetHash)
      .then((payload) => {
        if (cancelled) return;
        setDetail(payload);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(formatApiError(err, t));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, packetHash, t]);

  const observers = detail?.observers ?? [];
  const distanceLabel =
    detail?.max_distance_km != null
      ? formatDistance(detail.max_distance_km, distanceUnit)
      : t('messageList.observerReachDistanceUnavailable');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('messageList.observerReachTitle')}</DialogTitle>
          <DialogDescription>{t('messageList.observerReachCaveat')}</DialogDescription>
        </DialogHeader>
        {loading && (
          <p className="text-[0.8125rem] text-muted-foreground">
            {t('messageList.observerReachLoading')}
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && detail && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground font-medium">
                  {t('messageList.observerReachCount')}
                </div>
                <div className="text-sm tabular-nums">{detail.observer_count}</div>
              </div>
              <div>
                <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground font-medium">
                  {t('messageList.observerReachMaxHops')}
                </div>
                <div className="text-sm tabular-nums">
                  {detail.max_hops == null ? '—' : detail.max_hops}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground font-medium">
                  {t('messageList.observerReachMaxDistance')}
                </div>
                <div className="text-sm">{distanceLabel}</div>
              </div>
            </div>
            {detail.observer_count === 0 && (
              <p className="text-[0.8125rem] text-muted-foreground">
                {t('messageList.observerReachEmpty')}
              </p>
            )}
            {observers.length > 0 && (
              <ul className="max-h-40 overflow-auto rounded border border-border divide-y divide-border">
                {observers.map((observer, index) => (
                  <li
                    key={`${observer.public_key ?? observer.name}-${index}`}
                    className="px-2 py-1.5 text-sm flex items-center justify-between gap-2"
                  >
                    <span className="min-w-0 truncate">{observer.name}</span>
                    <span className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
                      {observer.hops != null
                        ? t('messageList.observerReachHops', { count: observer.hops })
                        : '—'}
                      {observer.snr != null ? ` · ${observer.snr.toFixed(1)} dB` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <ObserverMiniMap observers={observers} />
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('messageList.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
