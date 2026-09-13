import { describe, expect, it } from 'vitest';

import {
  extractGroupTextFields,
  mergePriorityWordlist,
  partitionWordlistNames,
  tryHashtagCandidates,
  tryHashtagName,
} from '../utils/tryHashtagCandidates';

const GROUP_TEXT_PACKET =
  '1500d9b5d4330c3bfc80e2114278944c79dad5760f3b1baa407d7786765eabdf97f90d9c9d';

describe('GroupText candidate helpers', () => {
  it('extracts the GroupText channel hash, MAC, and ciphertext', () => {
    expect(extractGroupTextFields(GROUP_TEXT_PACKET)).toEqual({
      channelHash: 'd9',
      cipherMac: 'b5d4',
      ciphertext: '330c3bfc80e2114278944c79dad5760f3b1baa407d7786765eabdf97f90d9c9d',
    });
  });

  it('rejects malformed and non-GroupText packets', () => {
    expect(extractGroupTextFields('not-hex')).toBeNull();
    expect(extractGroupTextFields(`1100${GROUP_TEXT_PACKET.slice(4)}`)).toBeNull();
    expect(extractGroupTextFields('1500d9b5d4')).toBeNull();
  });

  it('decrypts an exact verbatim hashtag candidate', () => {
    expect(
      tryHashtagName(GROUP_TEXT_PACKET, '#test', {
        nowSec: 1_700_000_000,
        validSeconds: 60,
      })
    ).toEqual({
      ok: true,
      key: '9cd8fcf22a47333b591d96a2b848b73f',
      roomName: 'test',
      message: 'Alice: Hello',
    });

    expect(
      tryHashtagName(GROUP_TEXT_PACKET, 'Test', {
        nowSec: 1_700_000_000,
        validSeconds: 60,
      })
    ).toBeNull();
  });

  it('returns the first matching candidate and honors timestamp filtering', () => {
    expect(
      tryHashtagCandidates(GROUP_TEXT_PACKET, ['wrong', 'test', 'later'], {
        nowSec: 1_700_000_000,
        validSeconds: 60,
      })?.roomName
    ).toBe('test');

    expect(
      tryHashtagName(GROUP_TEXT_PACKET, 'test', {
        nowSec: 1_700_000_061,
        validSeconds: 60,
      })
    ).toBeNull();
    expect(
      tryHashtagName(GROUP_TEXT_PACKET, 'test', {
        nowSec: 1_700_000_061,
        validSeconds: 60,
        useTimestampFilter: false,
      })?.message
    ).toBe('Alice: Hello');
  });

  it('partitions cracker-safe dictionary names from verbatim names', () => {
    expect(
      partitionWordlistNames([
        '#meshcore',
        'two-words',
        '-leading',
        'double--dash',
        'Été',
        'MeshCore',
        'two words',
      ])
    ).toEqual({
      dictionary: ['meshcore', 'two-words'],
      verbatim: ['-leading', 'double--dash', 'Été', 'MeshCore', 'two words'],
    });
  });

  it('merges lowercase valid dictionary names with priority and deduplication', () => {
    expect(
      mergePriorityWordlist(
        ['MeshCore', '#test', 'two words', 'double--dash'],
        ['TEST', 'radio', '-invalid', 'meshcore']
      )
    ).toEqual(['meshcore', 'test', 'radio']);
  });
});
