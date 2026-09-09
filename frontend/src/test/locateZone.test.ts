import { describe, expect, it } from 'vitest';

import {
  calibrateRadiusKm,
  destinationPoint,
  disksToIntersectionRing,
  snrToOpacity,
} from '../utils/locateZone';
import { calculateDistance } from '../utils/pathUtils';

describe('locateZone', () => {
  it('keeps destination points at the requested distance', () => {
    const dest = destinationPoint(48.85, 2.35, 20, 90);
    expect(calculateDistance(48.85, 2.35, dest.lat, dest.lon)).toBeCloseTo(20, 1);
  });

  it('builds an intersection ring for overlapping disks', () => {
    const ring = disksToIntersectionRing([
      { lat: 48.85, lon: 2.35, radiusKm: 20 },
      { lat: 48.9, lon: 2.4, radiusKm: 20 },
    ]);
    expect(ring).not.toBeNull();
    expect(ring!.length).toBeGreaterThanOrEqual(3);
  });

  it('returns null when disks do not overlap', () => {
    expect(
      disksToIntersectionRing([
        { lat: 48.85, lon: 2.35, radiusKm: 5 },
        { lat: 40.0, lon: -74.0, radiusKm: 5 },
      ])
    ).toBeNull();
  });

  it('calibrates radius from neighbor distances with a margin', () => {
    expect(calibrateRadiusKm([10, 4])).toBeCloseTo(12);
    expect(calibrateRadiusKm([])).toBeNull();
  });

  it('maps SNR to opacity without changing radius', () => {
    expect(snrToOpacity(8)).toBeGreaterThan(snrToOpacity(-12));
  });
});
