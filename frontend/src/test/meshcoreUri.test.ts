import { describe, it, expect } from 'vitest';
import { formatChannelAddUri, formatContactAddUri, parseMeshcoreUri } from '../utils/meshcoreUri';

const CONTACT_KEY = '9cd8fcf22a47333b591d96a2b848b73f457b1bb1a3ea2453a885f9e5787765b1';
const CHANNEL_SECRET = '8b3387e9c5cdea6ac9e5edbaa115cd72';

const DOCS_CONTACT =
  'meshcore://contact/add?name=Example+Contact&public_key=9cd8fcf22a47333b591d96a2b848b73f457b1bb1a3ea2453a885f9e5787765b1&type=1';
const DOCS_CHANNEL = 'meshcore://channel/add?name=Public&secret=8b3387e9c5cdea6ac9e5edbaa115cd72';

describe('parseMeshcoreUri', () => {
  it('parses the official contact/add example', () => {
    expect(parseMeshcoreUri(DOCS_CONTACT)).toEqual({
      kind: 'contact',
      name: 'Example Contact',
      publicKey: CONTACT_KEY,
      type: 1,
    });
  });

  it('parses the official channel/add example', () => {
    expect(parseMeshcoreUri(DOCS_CHANNEL)).toEqual({
      kind: 'channel',
      name: 'Public',
      secret: CHANNEL_SECRET,
    });
  });

  it('parses optional region_scope and normalizes hex case', () => {
    expect(
      parseMeshcoreUri(
        `meshcore://channel/add?name=%23cafe&secret=${CHANNEL_SECRET.toUpperCase()}&region_scope=%23Esperance`
      )
    ).toEqual({
      kind: 'channel',
      name: '#cafe',
      secret: CHANNEL_SECRET,
      regionScope: '#Esperance',
    });
  });

  it('accepts a trailing slash on the official paths', () => {
    expect(
      parseMeshcoreUri(`meshcore://contact/add/?name=Ada&public_key=${CONTACT_KEY}&type=2`)
    ).toEqual({
      kind: 'contact',
      name: 'Ada',
      publicKey: CONTACT_KEY,
      type: 2,
    });
  });

  it('rejects other schemes and unofficial meshcore paths', () => {
    expect(
      parseMeshcoreUri(`https://example.com/contact/add?name=Ada&public_key=${CONTACT_KEY}&type=1`)
    ).toBeNull();
    expect(parseMeshcoreUri('meshcore://settings')).toBeNull();
    expect(
      parseMeshcoreUri(`meshcore://contact/share?name=Ada&public_key=${CONTACT_KEY}&type=1`)
    ).toBeNull();
    expect(parseMeshcoreUri('not-a-uri')).toBeNull();
  });

  it('rejects missing or invalid required fields', () => {
    expect(
      parseMeshcoreUri(`meshcore://contact/add?name=Ada&public_key=${CONTACT_KEY}`)
    ).toBeNull();
    expect(
      parseMeshcoreUri(`meshcore://contact/add?name=Ada&public_key=${CONTACT_KEY}&type=9`)
    ).toBeNull();
    expect(parseMeshcoreUri(`meshcore://contact/add?name=Ada&public_key=abcd&type=1`)).toBeNull();
    expect(parseMeshcoreUri(`meshcore://channel/add?name=Public&secret=short`)).toBeNull();
    expect(parseMeshcoreUri(`meshcore://channel/add?name=&secret=${CHANNEL_SECRET}`)).toBeNull();
  });
});

describe('formatContactAddUri / formatChannelAddUri', () => {
  it('emits official contact/add and round-trips', () => {
    const uri = formatContactAddUri({
      name: 'Example Contact',
      publicKey: CONTACT_KEY.toUpperCase(),
      type: 1,
    });
    expect(uri).toBe(DOCS_CONTACT);
    expect(parseMeshcoreUri(uri!)).toEqual({
      kind: 'contact',
      name: 'Example Contact',
      publicKey: CONTACT_KEY,
      type: 1,
    });
  });

  it('emits official channel/add, including region_scope when set', () => {
    expect(formatChannelAddUri({ name: 'Public', secret: CHANNEL_SECRET.toUpperCase() })).toBe(
      DOCS_CHANNEL
    );
    expect(
      formatChannelAddUri({ name: 'Public', secret: CHANNEL_SECRET, regionScope: '#Esperance' })
    ).toBe(`${DOCS_CHANNEL}&region_scope=%23Esperance`);
  });

  it('returns null for unofficial emit inputs', () => {
    expect(formatContactAddUri({ name: '', publicKey: CONTACT_KEY, type: 1 })).toBeNull();
    expect(formatContactAddUri({ name: 'Ada', publicKey: 'abcd', type: 1 })).toBeNull();
    expect(formatChannelAddUri({ name: 'Public', secret: 'zz' })).toBeNull();
  });
});
