import { beforeEach, describe, expect, it } from 'vitest';

import {
  DISTANCE_UNIT_KEY,
  getSavedDistanceUnit,
  setSavedDistanceUnit,
} from '../utils/distanceUnits';

describe('distanceUnits utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to imperial when unset', () => {
    expect(getSavedDistanceUnit()).toBe('imperial');
  });

  it('returns the stored unit when valid', () => {
    localStorage.setItem(DISTANCE_UNIT_KEY, 'metric');
    expect(getSavedDistanceUnit()).toBe('metric');
  });

  it('falls back to imperial for invalid stored values', () => {
    localStorage.setItem(DISTANCE_UNIT_KEY, 'parsecs');
    expect(getSavedDistanceUnit()).toBe('imperial');
  });

  it('stores the selected distance unit', () => {
    setSavedDistanceUnit('smoots');
    expect(localStorage.getItem(DISTANCE_UNIT_KEY)).toBe('smoots');
  });
});
