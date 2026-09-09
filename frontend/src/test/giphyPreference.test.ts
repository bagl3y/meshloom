import { beforeEach, describe, expect, it } from 'vitest';

import {
  GIPHY_API_KEY_STORAGE,
  getSavedGiphyApiKey,
  setSavedGiphyApiKey,
} from '../utils/giphyPreference';

describe('giphyPreference utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty when unset', () => {
    expect(getSavedGiphyApiKey()).toBe('');
  });

  it('persists a trimmed key and clears it when emptied', () => {
    setSavedGiphyApiKey('  abc  ');
    expect(localStorage.getItem(GIPHY_API_KEY_STORAGE)).toBe('abc');
    expect(getSavedGiphyApiKey()).toBe('abc');

    setSavedGiphyApiKey('   ');
    expect(localStorage.getItem(GIPHY_API_KEY_STORAGE)).toBeNull();
    expect(getSavedGiphyApiKey()).toBe('');
  });
});
