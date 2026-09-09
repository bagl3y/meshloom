import { calculateDistance } from './pathUtils';

const EARTH_RADIUS_KM = 6371;
export const DEFAULT_LOCATE_RADIUS_KM = 20;
export const LOCATE_RADIUS_MARGIN = 1.2;
export const MIN_CALIBRATED_RADIUS_KM = 5;
export const MAX_CALIBRATED_RADIUS_KM = 50;

export interface LocateDisk {
  lat: number;
  lon: number;
  radiusKm: number;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Destination point from lat/lon given distance (km) and bearing (degrees). */
export function destinationPoint(
  lat: number,
  lon: number,
  distanceKm: number,
  bearingDeg: number
): { lat: number; lon: number } {
  const δ = distanceKm / EARTH_RADIUS_KM;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(lat);
  const λ1 = toRad(lon);
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * sinδ * cosφ1;
  const x = cosδ - sinφ1 * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);
  return { lat: toDeg(φ2), lon: ((toDeg(λ2) + 540) % 360) - 180 };
}

export function calibrateRadiusKm(distancesKm: number[]): number | null {
  const usable = distancesKm.filter((d) => Number.isFinite(d) && d > 0);
  if (usable.length === 0) return null;
  const raw = Math.max(...usable) * LOCATE_RADIUS_MARGIN;
  return Math.max(MIN_CALIBRATED_RADIUS_KM, Math.min(MAX_CALIBRATED_RADIUS_KM, raw));
}

/**
 * Approximate intersection of conservative coverage disks as a lat/lon ring.
 * Returns null when fewer than 3 sample points sit inside every disk.
 */
export function disksToIntersectionRing(
  disks: LocateDisk[],
  samples = 72
): [number, number][] | null {
  if (disks.length === 0) return null;
  const pts: [number, number][] = [];
  const slopKm = 0.05;
  for (const disk of disks) {
    for (let i = 0; i < samples; i++) {
      const point = destinationPoint(disk.lat, disk.lon, disk.radiusKm, (360 * i) / samples);
      const inside = disks.every((other) => {
        const distance = calculateDistance(point.lat, point.lon, other.lat, other.lon);
        return distance != null && distance <= other.radiusKm + slopKm;
      });
      if (inside) pts.push([point.lat, point.lon]);
    }
  }
  if (pts.length < 3) return null;
  const centroidLat = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
  const centroidLon = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
  return pts.sort((a, b) => {
    const angleA = Math.atan2(a[0] - centroidLat, a[1] - centroidLon);
    const angleB = Math.atan2(b[0] - centroidLat, b[1] - centroidLon);
    return angleA - angleB;
  });
}

export function snrToOpacity(snr: number | null | undefined): number {
  if (snr == null || Number.isNaN(snr)) return 0.7;
  const t = Math.max(0, Math.min(1, (snr + 16) / 24));
  return 0.4 + t * 0.55;
}
