import { describe, expect, it } from 'vitest';

import { safePushUrlHash } from '../utils/pushUrlHash';

describe('safePushUrlHash', () => {
  it('keeps in-app hash routes', () => {
    expect(safePushUrlHash('#contact/aa')).toBe('#contact/aa');
    expect(safePushUrlHash('#raw')).toBe('#raw');
  });

  it('rejects non-hash navigation targets', () => {
    expect(safePushUrlHash('https://evil.example/phish')).toBe('');
    expect(safePushUrlHash('/settings/radio')).toBe('');
    expect(safePushUrlHash('')).toBe('');
    expect(safePushUrlHash(undefined)).toBe('');
  });
});
