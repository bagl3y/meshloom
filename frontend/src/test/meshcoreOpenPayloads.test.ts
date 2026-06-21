/**
 * Tests for MeshCore Open rich-chat payload parsing (GIFs and reactions).
 *
 * Formats are ported from meshcore-open; see meshcoreOpenPayloads.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  REACTION_EMOJIS,
  giphyUrlForId,
  parseGif,
  parseReaction,
} from '../utils/meshcoreOpenPayloads';

describe('parseGif', () => {
  it('parses a g:<id> payload', () => {
    expect(parseGif('g:abc123')).toBe('abc123');
  });

  it('accepts ids with underscores and dashes', () => {
    expect(parseGif('g:aB3_-xY')).toBe('aB3_-xY');
  });

  it('trims surrounding whitespace', () => {
    expect(parseGif('  g:abc123  ')).toBe('abc123');
  });

  it('returns null for non-gif text', () => {
    expect(parseGif('hello world')).toBeNull();
    expect(parseGif('g:')).toBeNull();
    expect(parseGif('g:abc 123')).toBeNull();
    expect(parseGif('prefix g:abc')).toBeNull();
    expect(parseGif('g:abc!')).toBeNull();
  });

  it('builds the Giphy media URL', () => {
    expect(giphyUrlForId('abc123')).toBe('https://media.giphy.com/media/abc123/giphy.gif');
  });
});

describe('parseReaction', () => {
  it('decodes the first emoji (index 00)', () => {
    const result = parseReaction('r:1a2b:00');
    expect(result).toEqual({ emoji: REACTION_EMOJIS[0], targetHash: '1a2b' });
    expect(result?.emoji).toBe('👍');
  });

  it('decodes a non-zero index', () => {
    // index 0x06 -> first smiley (after the 6 quick emojis)
    const result = parseReaction('r:ffff:06');
    expect(result?.emoji).toBe(REACTION_EMOJIS[6]);
    expect(result?.targetHash).toBe('ffff');
  });

  it('trims surrounding whitespace', () => {
    expect(parseReaction('  r:1a2b:00  ')?.emoji).toBe('👍');
  });

  it('returns null for an out-of-range index', () => {
    // 0xff (255) is beyond the emoji list length
    expect(parseReaction('r:1a2b:ff')).toBeNull();
  });

  it('returns null for malformed reactions', () => {
    expect(parseReaction('r:1a2b')).toBeNull();
    expect(parseReaction('r:1a2:00')).toBeNull(); // hash too short
    expect(parseReaction('r:1A2B:00')).toBeNull(); // uppercase hex not accepted
    expect(parseReaction('r:1a2b:0')).toBeNull(); // index too short
    expect(parseReaction('hello')).toBeNull();
  });

  it('exposes a stable, deduplication-free emoji index range', () => {
    // 6 quick + 64 smileys + 33 gestures + 32 hearts + 49 objects
    expect(REACTION_EMOJIS.length).toBe(184);
    // every defined index decodes to a string
    for (let i = 0; i < REACTION_EMOJIS.length; i++) {
      const hex = i.toString(16).padStart(2, '0');
      expect(parseReaction(`r:0000:${hex}`)?.emoji).toBe(REACTION_EMOJIS[i]);
    }
  });
});
