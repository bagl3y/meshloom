import { describe, expect, it } from 'vitest';

import {
  deriveChannelHashByte,
  deriveHashtagKeyHex,
  normalizeHashtagName,
} from '../utils/hashtagKey';

describe('hashtag key helpers', () => {
  it('strips exactly one leading hash without changing spelling', () => {
    expect(normalizeHashtagName('#Mesh Core')).toBe('Mesh Core');
    expect(normalizeHashtagName('##double')).toBe('#double');
    expect(normalizeHashtagName('été')).toBe('été');
  });

  it('matches the golden #test key and channel hash byte', () => {
    const key = deriveHashtagKeyHex('#test');

    expect(key).toBe('9cd8fcf22a47333b591d96a2b848b73f');
    expect(deriveChannelHashByte(key)).toBe('d9');
  });

  it('hashes accents and exact spelling verbatim', () => {
    expect(deriveHashtagKeyHex('#été')).not.toBe(deriveHashtagKeyHex('#ete'));
    expect(deriveHashtagKeyHex('#Test')).not.toBe(deriveHashtagKeyHex('#test'));
  });
});
