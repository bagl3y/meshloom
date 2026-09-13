import { deriveKeyFromRoomName, getChannelHash } from 'meshcore-hashtag-cracker';

export function normalizeHashtagName(name: string): string {
  return name.startsWith('#') ? name.slice(1) : name;
}

export function deriveHashtagKeyHex(name: string): string {
  return deriveKeyFromRoomName(`#${normalizeHashtagName(name)}`).toLowerCase();
}

export function deriveChannelHashByte(keyHex: string): string {
  return getChannelHash(keyHex).toLowerCase();
}
