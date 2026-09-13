import { beforeEach, describe, expect, it } from 'vitest';

import {
  CARTO_API_KEY_STORAGE,
  getSavedCartoApiKey,
  setSavedCartoApiKey,
} from '../utils/cartoPreference';

describe('cartoPreference utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty when unset', () => {
    expect(getSavedCartoApiKey()).toBe('');
  });

  it('persists a trimmed key and clears it when emptied', () => {
    setSavedCartoApiKey('  abc  ');
    expect(localStorage.getItem(CARTO_API_KEY_STORAGE)).toBe('abc');
    expect(getSavedCartoApiKey()).toBe('abc');

    setSavedCartoApiKey('   ');
    expect(localStorage.getItem(CARTO_API_KEY_STORAGE)).toBeNull();
    expect(getSavedCartoApiKey()).toBe('');
  });
});
