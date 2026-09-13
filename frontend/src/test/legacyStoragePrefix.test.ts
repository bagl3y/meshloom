import { afterEach, describe, expect, it } from 'vitest';

import { migrateLegacyLocalStoragePrefix } from '../utils/legacyStoragePrefix';

describe('migrateLegacyLocalStoragePrefix', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('copies leftover Remote Terminal keys onto the Meshloom prefix', () => {
    localStorage.setItem('remoteterm-theme', 'light');
    localStorage.setItem('meshloom-language', 'fr');
    localStorage.setItem('remoteterm-language', 'en');

    migrateLegacyLocalStoragePrefix();

    expect(localStorage.getItem('meshloom-theme')).toBe('light');
    expect(localStorage.getItem('meshloom-language')).toBe('fr');
    expect(localStorage.getItem('remoteterm-theme')).toBeNull();
    expect(localStorage.getItem('remoteterm-language')).toBeNull();
  });
});
