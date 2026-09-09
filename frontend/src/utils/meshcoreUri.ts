/**
 * Official MeshCore share URIs only:
 *   meshcore://contact/add?name=&public_key=&type=
 *   meshcore://channel/add?name=&secret=&region_scope=
 *
 * Spec: docs.meshcore.io/qr_codes and meshcore-dev/MeshCore docs/qr_codes.md.
 * No other schemes or paths.
 */

export type MeshcoreContactType = 1 | 2 | 3 | 4;

export type ParsedMeshcoreUri =
  | {
      kind: 'contact';
      name: string;
      publicKey: string;
      type: MeshcoreContactType;
    }
  | {
      kind: 'channel';
      name: string;
      secret: string;
      regionScope?: string;
    };

const HEX32 = /^[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const CONTACT_TYPE = /^[1-4]$/;

function normalizeHex(value: string | null, pattern: RegExp): string | null {
  if (!value) return null;
  const hex = value.toLowerCase();
  return pattern.test(hex) ? hex : null;
}

function requiredName(value: string | null): string | null {
  const name = value?.trim() ?? '';
  return name.length > 0 ? name : null;
}

function parseContact(params: URLSearchParams): ParsedMeshcoreUri | null {
  const name = requiredName(params.get('name'));
  const publicKey = normalizeHex(params.get('public_key'), HEX64);
  const typeRaw = params.get('type') ?? '';
  if (!name || !publicKey || !CONTACT_TYPE.test(typeRaw)) return null;
  return { kind: 'contact', name, publicKey, type: Number(typeRaw) as MeshcoreContactType };
}

function parseChannel(params: URLSearchParams): ParsedMeshcoreUri | null {
  const name = requiredName(params.get('name'));
  const secret = normalizeHex(params.get('secret'), HEX32);
  if (!name || !secret) return null;
  const regionScope = params.get('region_scope')?.trim() || undefined;
  return regionScope
    ? { kind: 'channel', name, secret, regionScope }
    : { kind: 'channel', name, secret };
}

/** Parse an official contact/add or channel/add URI. Other schemes return null. */
export function parseMeshcoreUri(raw: string): ParsedMeshcoreUri | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol.toLowerCase() !== 'meshcore:') return null;
  const route = `${url.hostname}${url.pathname}`.replace(/\/+$/, '').toLowerCase();
  if (route === 'contact/add') return parseContact(url.searchParams);
  if (route === 'channel/add') return parseChannel(url.searchParams);
  return null;
}

/** Emit `meshcore://contact/add?...`. Null when name/key/type are not official. */
export function formatContactAddUri(input: {
  name: string;
  publicKey: string;
  type: MeshcoreContactType;
}): string | null {
  const name = requiredName(input.name);
  const publicKey = normalizeHex(input.publicKey, HEX64);
  if (!name || !publicKey) return null;
  if (input.type !== 1 && input.type !== 2 && input.type !== 3 && input.type !== 4) {
    return null;
  }
  const params = new URLSearchParams();
  params.set('name', name);
  params.set('public_key', publicKey);
  params.set('type', String(input.type));
  return `meshcore://contact/add?${params}`;
}

/** Emit `meshcore://channel/add?...`. Null when name/secret are not official. */
export function formatChannelAddUri(input: {
  name: string;
  secret: string;
  regionScope?: string;
}): string | null {
  const name = requiredName(input.name);
  const secret = normalizeHex(input.secret, HEX32);
  if (!name || !secret) return null;
  const params = new URLSearchParams();
  params.set('name', name);
  params.set('secret', secret);
  const regionScope = input.regionScope?.trim();
  if (regionScope) params.set('region_scope', regionScope);
  return `meshcore://channel/add?${params}`;
}
