/**
 * Tests for MeshCore Open rich-chat payload parsing (GIFs and reactions).
 *
 * Formats are ported from meshcore-open; see meshcoreOpenPayloads.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  REACTION_EMOJIS,
  attachOpenReaction,
  computeReactionHash,
  formatOpenReaction,
  formatGif,
  formatLocation,
  giphyUrlForId,
  locationMapUrl,
  parseGif,
  parseLocation,
  parseMeshCoreOneReaction,
  parseReaction,
  reactionEmojiIndex,
  reactionHashSourceFromFields,
  splitReplyMention,
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

  it('encodes the compact Open wire form', () => {
    expect(formatGif('abc123')).toBe('g:abc123');
    expect(parseGif(formatGif(' aB3_-xY '))).toBe('aB3_-xY');
  });

  it('accepts Open-compatible Giphy URLs', () => {
    expect(parseGif('https://media.giphy.com/media/abc123/giphy.gif')).toBe('abc123');
    expect(parseGif('media.giphy.com/media/abc123/giphy.gif')).toBe('abc123');
    expect(parseGif('https://media1.giphy.com/media/abc123/giphy.gif')).toBe('abc123');
    expect(parseGif('https://i.giphy.com/abc123.gif')).toBe('abc123');
    expect(parseGif('https://giphy.com/gifs/funny-cat-abc123')).toBe('abc123');
    expect(parseGif('https://giphy.com/gifs/abc123/')).toBe('abc123');
  });
});

describe('parseLocation / formatLocation', () => {
  it('parses an Open loc pin', () => {
    expect(parseLocation('m:43.580120,7.123450|FR-06-PSCL-Base|loc')).toEqual({
      lat: 43.58012,
      lon: 7.12345,
      label: 'FR-06-PSCL-Base',
      kind: 'loc',
    });
  });

  it('parses a poi marker and trims whitespace', () => {
    expect(parseLocation('  m:1.5,-2.25|Cafe|poi  ')).toEqual({
      lat: 1.5,
      lon: -2.25,
      label: 'Cafe',
      kind: 'poi',
    });
  });

  it('encodes six-decimal Open wire and replaces pipes in the label', () => {
    expect(formatLocation(43.58, 7.12, 'A|B')).toBe('m:43.580000,7.120000|A/B|loc');
    expect(parseLocation(formatLocation(43.58, 7.12, 'A|B')!)).toMatchObject({
      lat: 43.58,
      lon: 7.12,
      label: 'A/B',
      kind: 'loc',
    });
  });

  it('rejects unset 0,0 and out-of-range coordinates', () => {
    expect(formatLocation(0, 0, 'here')).toBeNull();
    expect(parseLocation('m:91,0|x|loc')).toBeNull();
    expect(parseLocation('m:43.5,7.1|x|nope')).toBeNull();
    expect(parseLocation('hello')).toBeNull();
  });

  it('builds an OpenStreetMap pin URL', () => {
    expect(locationMapUrl(43.58, 7.12)).toBe(
      'https://www.openstreetmap.org/?mlat=43.58&mlon=7.12#map=16/43.58/7.12'
    );
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

describe('splitReplyMention', () => {
  it('splits a reply-prefixed gif into mention + body (issue #291)', () => {
    // meshcore-open sends GIF replies as "@[senderName] g:<id>".
    expect(splitReplyMention('@[Alice] g:abc123')).toEqual({
      mention: '@[Alice]',
      body: 'g:abc123',
    });
  });

  it('the split body parses as a gif while the whole string does not', () => {
    const whole = '@[Alice] g:abc123';
    expect(parseGif(whole)).toBeNull(); // anchored regex rejects the prefix
    const split = splitReplyMention(whole);
    expect(split && parseGif(split.body)).toBe('abc123');
  });

  it('splits a reply-prefixed reaction', () => {
    expect(splitReplyMention('@[Bob] r:1a2b:00')).toEqual({
      mention: '@[Bob]',
      body: 'r:1a2b:00',
    });
  });

  it('trims surrounding whitespace and preserves names with spaces', () => {
    expect(splitReplyMention('  @[Node One]   g:xy  ')).toEqual({
      mention: '@[Node One]',
      body: 'g:xy',
    });
  });

  it('returns null without a leading reply mention', () => {
    expect(splitReplyMention('g:abc123')).toBeNull();
    expect(splitReplyMention('hello world')).toBeNull();
    expect(splitReplyMention('@[Alice]')).toBeNull(); // mention only, no body
    expect(splitReplyMention('text @[Alice] g:abc')).toBeNull(); // not a leading mention
  });
});

describe('parseMeshCoreOneReaction', () => {
  it('parses a channel reaction "{emoji}@[sender]\\n{hash}" (issue #354)', () => {
    expect(parseMeshCoreOneReaction('\u{1F44D}@[AlphaNode]\nb45pc4ek')).toEqual({
      emoji: '\u{1F44D}',
      targetHash: 'b45pc4ek',
      targetSender: 'AlphaNode',
    });
  });

  it('parses a DM reaction with no target sender', () => {
    expect(parseMeshCoreOneReaction('\u{1F44D}\nb45pc4ek')).toEqual({
      emoji: '\u{1F44D}',
      targetHash: 'b45pc4ek',
    });
  });

  it('parses the newer "@[sender]{emoji}" ordering', () => {
    expect(parseMeshCoreOneReaction('@[Node One]\u{1F92F}\ntpmh79ve')).toEqual({
      emoji: '\u{1F92F}',
      targetHash: 'tpmh79ve',
      targetSender: 'Node One',
    });
  });

  it('keeps emoji modifiers (variation selector, ZWJ, skin tone)', () => {
    expect(parseMeshCoreOneReaction('\u2764\ufe0f@[Bob]\nb45pc4ek')?.emoji).toBe('\u2764\ufe0f');
    expect(parseMeshCoreOneReaction('\u{1F44D}\u{1F3FD}\nb45pc4ek')?.emoji).toBe(
      '\u{1F44D}\u{1F3FD}'
    );
  });

  it('rejects non-reaction text', () => {
    expect(parseMeshCoreOneReaction('hello\nworld123')).toBeNull(); // no emoji
    expect(parseMeshCoreOneReaction('\u{1F44D}\nb45pc4e')).toBeNull(); // hash too short
    expect(parseMeshCoreOneReaction('\u{1F44D}\nb45pc4eu')).toBeNull(); // "u" not Crockford
    expect(parseMeshCoreOneReaction('\u{1F44D} b45pc4ek')).toBeNull(); // single line
    expect(parseMeshCoreOneReaction('\u{1F44D}@[Bob]\nb45pc4ek\nmore')).toBeNull();
    expect(parseMeshCoreOneReaction('r:1a2b:00')).toBeNull();
  });
});

describe('computeReactionHash / formatOpenReaction', () => {
  // Dart VM String.hashCode (seed 0, kHashBits=30) then & 0xFFFF.
  // Matches meshcore-open ReactionHelper, not Sestriere.
  it('hashes a channel message as timestamp+name+first5', () => {
    expect(computeReactionHash(1700000000, 'Alice', 'hello')).toBe('b0ba');
  });

  it('omits senderName for DMs', () => {
    expect(computeReactionHash(1700000000, null, 'hello')).toBe('033f');
    expect(computeReactionHash(1700000000, null, 'hello')).not.toBe(
      computeReactionHash(1700000000, 'Alice', 'hello')
    );
  });

  it('uses only the first five UTF-16 units of text', () => {
    expect(computeReactionHash(1700000000, 'Alice', 'hello world')).toBe(
      computeReactionHash(1700000000, 'Alice', 'hello')
    );
    expect(computeReactionHash(1, 'A', 'hi')).toBe('1b7d');
  });

  it('hashes UTF-16 code units (accents, emoji), not UTF-8 bytes', () => {
    expect(computeReactionHash(1700000000, 'Alizé', 'hello')).toBe('94d9');
    expect(computeReactionHash(1700000000, 'Alice', '👍yes')).toBe('b080');
  });

  it('formats a sendable r:HASH:INDEX that parseReaction accepts', () => {
    const wire = formatOpenReaction(1700000000, 'Alice', 'hello', '👍');
    expect(wire).toBe('r:b0ba:00');
    expect(parseReaction(wire!)).toEqual({ emoji: '👍', targetHash: 'b0ba' });
  });

  it('returns null for an emoji outside the Open table', () => {
    expect(formatOpenReaction(1700000000, 'Alice', 'hello', '🥑')).toBeNull();
    expect(reactionEmojiIndex('🥑')).toBeNull();
    expect(reactionEmojiIndex('👍')).toBe('00');
  });
});

describe('reactionHashSourceFromFields / attachOpenReaction', () => {
  const getSource = (msg: {
    type: 'PRIV' | 'CHAN';
    sender_timestamp: number | null;
    sender_name: string | null;
    text: string;
  }) => reactionHashSourceFromFields(msg);

  it('strips the stored channel "Name: " prefix before hashing', () => {
    const source = reactionHashSourceFromFields({
      type: 'CHAN',
      sender_timestamp: 1700000000,
      sender_name: 'Alice',
      text: 'Alice: hello',
    });
    expect(source).toEqual({ timestampSeconds: 1700000000, senderName: 'Alice', text: 'hello' });
    expect(computeReactionHash(source!.timestampSeconds, source!.senderName, source!.text)).toBe(
      'b0ba'
    );
  });

  it('omits senderName for PRIV even when sender_name is stored', () => {
    expect(
      reactionHashSourceFromFields({
        type: 'PRIV',
        sender_timestamp: 1700000000,
        sender_name: 'Alice',
        text: 'hello',
      })
    ).toEqual({ timestampSeconds: 1700000000, senderName: null, text: 'hello' });
  });

  it('returns null without a sender timestamp', () => {
    expect(
      reactionHashSourceFromFields({
        type: 'CHAN',
        sender_timestamp: null,
        sender_name: 'Alice',
        text: 'Alice: hello',
      })
    ).toBeNull();
  });

  it('attaches an inbound Open reaction to the newest matching target', () => {
    const messages = [
      {
        type: 'CHAN' as const,
        sender_timestamp: 1700000000,
        sender_name: 'Alice',
        text: 'Alice: hello',
      },
      {
        type: 'CHAN' as const,
        sender_timestamp: 1700000001,
        sender_name: 'Bob',
        text: 'Bob: later',
      },
      {
        type: 'CHAN' as const,
        sender_timestamp: 1700000000,
        sender_name: 'Alice',
        text: 'Alice: hello',
      },
    ];
    const wire = formatOpenReaction(1700000000, 'Alice', 'hello', '🔥');
    const attached = attachOpenReaction(messages, wire!, getSource);
    expect(attached?.targetIndex).toBe(2);
    expect(attached?.reaction).toEqual({ emoji: '🔥', targetHash: 'b0ba' });
  });

  it('does not attach MeshCore One inbound text via the Open hash', () => {
    const messages = [
      {
        type: 'CHAN' as const,
        sender_timestamp: 1700000000,
        sender_name: 'Alice',
        text: 'Alice: hello',
      },
    ];
    expect(attachOpenReaction(messages, '\u{1F44D}@[Alice]\nb45pc4ek', getSource)).toBeNull();
    expect(parseMeshCoreOneReaction('\u{1F44D}@[Alice]\nb45pc4ek')?.emoji).toBe('\u{1F44D}');
  });
});
