import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SHOW_PATH_HOP_WIDTH_KEY,
  getSavedShowPathHopWidth,
  setSavedShowPathHopWidth,
} from '../utils/pathHopWidthPreference';

describe('pathHopWidthPreference utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to on when unset', () => {
    expect(getSavedShowPathHopWidth()).toBe(true);
  });

  it('returns true when enabled', () => {
    localStorage.setItem(SHOW_PATH_HOP_WIDTH_KEY, 'true');
    expect(getSavedShowPathHopWidth()).toBe(true);
  });

  it('returns false only when explicitly stored as false', () => {
    localStorage.setItem(SHOW_PATH_HOP_WIDTH_KEY, 'false');
    expect(getSavedShowPathHopWidth()).toBe(false);
  });

  it('defaults to on when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getSavedShowPathHopWidth()).toBe(true);
  });

  it('persists true and false without removing the key', () => {
    setSavedShowPathHopWidth(true);
    expect(localStorage.getItem(SHOW_PATH_HOP_WIDTH_KEY)).toBe('true');

    setSavedShowPathHopWidth(false);
    expect(localStorage.getItem(SHOW_PATH_HOP_WIDTH_KEY)).toBe('false');
  });
});
