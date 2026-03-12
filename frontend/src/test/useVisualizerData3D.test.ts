import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PayloadType } from '@michaelhart/meshcore-decoder';

import type { Contact, RadioConfig, RawPacket } from '../types';
import { CONTACT_TYPE_REPEATER } from '../types';
import { buildLinkKey } from '../utils/visualizerUtils';

const { packetFixtures } = vi.hoisted(() => ({
  packetFixtures: new Map<string, unknown>(),
}));

vi.mock('../utils/visualizerUtils', async () => {
  const actual = await vi.importActual<typeof import('../utils/visualizerUtils')>(
    '../utils/visualizerUtils'
  );

  return {
    ...actual,
    parsePacket: vi.fn((hexData: string) => packetFixtures.get(hexData) ?? null),
  };
});

import { useVisualizerData3D } from '../components/visualizer/useVisualizerData3D';

function createConfig(publicKey: string): RadioConfig {
  return {
    public_key: publicKey,
    name: 'Me',
    lat: 0,
    lon: 0,
    tx_power: 0,
    max_tx_power: 0,
    radio: { freq: 0, bw: 0, sf: 0, cr: 0 },
    path_hash_mode: 0,
    path_hash_mode_supported: true,
    advert_location_source: 'off',
  };
}

function createContact(publicKey: string, name: string, type = 1): Contact {
  return {
    public_key: publicKey,
    name,
    type,
    flags: 0,
    last_path: null,
    last_path_len: 0,
    out_path_hash_mode: 0,
    route_override_path: null,
    route_override_len: null,
    route_override_hash_mode: null,
    last_advert: null,
    lat: null,
    lon: null,
    last_seen: null,
    on_radio: false,
    last_contacted: null,
    last_read_at: null,
    first_seen: null,
  };
}

function createPacket(data: string): RawPacket {
  return {
    id: 1,
    observation_id: 1,
    timestamp: 1_700_000_000,
    data,
    payload_type: 'TEXT',
    snr: null,
    rssi: null,
    decrypted: false,
    decrypted_info: null,
  };
}

function renderVisualizerData({
  packets,
  contacts,
  config,
  showAmbiguousPaths = false,
  showAmbiguousNodes = false,
}: {
  packets: RawPacket[];
  contacts: Contact[];
  config: RadioConfig;
  showAmbiguousPaths?: boolean;
  showAmbiguousNodes?: boolean;
}) {
  return renderHook(() =>
    useVisualizerData3D({
      packets,
      contacts,
      config,
      repeaterAdvertPaths: [],
      showAmbiguousPaths,
      showAmbiguousNodes,
      useAdvertPathHints: false,
      splitAmbiguousByTraffic: false,
      chargeStrength: -200,
      letEmDrift: false,
      particleSpeedMultiplier: 1,
      observationWindowSec: 15,
      pruneStaleNodes: false,
      pruneStaleMinutes: 5,
    })
  );
}

afterEach(() => {
  packetFixtures.clear();
});

describe('useVisualizerData3D', () => {
  it('marks compressed hidden-repeater routes as dashed links instead of direct solid links', async () => {
    const selfKey = 'ffffffffffff0000000000000000000000000000000000000000000000000000';
    const aliceKey = 'aaaaaaaaaaaa0000000000000000000000000000000000000000000000000000';

    packetFixtures.set('dm-hidden-hop', {
      payloadType: PayloadType.TextMessage,
      messageHash: 'dm-hidden-hop',
      pathBytes: ['32'],
      srcHash: 'aaaaaaaaaaaa',
      dstHash: 'ffffffffffff',
      advertPubkey: null,
      groupTextSender: null,
      anonRequestPubkey: null,
    });

    const { result } = renderVisualizerData({
      packets: [createPacket('dm-hidden-hop')],
      contacts: [createContact(aliceKey, 'Alice')],
      config: createConfig(selfKey),
    });

    await waitFor(() => expect(result.current.links.size).toBe(1));

    const link = result.current.links.get(buildLinkKey('aaaaaaaaaaaa', 'self'));
    expect(link).toBeDefined();
    expect(link?.hasHiddenIntermediate).toBe(true);
    expect(link?.hasDirectObservation).toBe(false);
  });

  it('does not append self after a resolved outgoing DM destination', async () => {
    const selfKey = 'ffffffffffff0000000000000000000000000000000000000000000000000000';
    const bobKey = 'bbbbbbbbbbbb0000000000000000000000000000000000000000000000000000';
    const repeaterKey = '3232323232320000000000000000000000000000000000000000000000000000';

    packetFixtures.set('dm-outgoing-known-dst', {
      payloadType: PayloadType.TextMessage,
      messageHash: 'dm-outgoing-known-dst',
      pathBytes: ['323232323232'],
      srcHash: 'ffffffffffff',
      dstHash: 'bbbbbbbbbbbb',
      advertPubkey: null,
      groupTextSender: null,
      anonRequestPubkey: null,
    });

    const { result } = renderVisualizerData({
      packets: [createPacket('dm-outgoing-known-dst')],
      contacts: [
        createContact(bobKey, 'Bob'),
        createContact(repeaterKey, 'Relay', CONTACT_TYPE_REPEATER),
      ],
      config: createConfig(selfKey),
      showAmbiguousPaths: true,
    });

    await waitFor(() => expect(result.current.links.size).toBe(2));

    expect(result.current.links.has(buildLinkKey('self', '323232323232'))).toBe(true);
    expect(result.current.links.has(buildLinkKey('323232323232', 'bbbbbbbbbbbb'))).toBe(true);
    expect(result.current.links.has(buildLinkKey('self', 'bbbbbbbbbbbb'))).toBe(false);
  });

  it('does not create a fake self edge for an unresolved outgoing direct DM', async () => {
    const selfKey = 'ffffffffffff0000000000000000000000000000000000000000000000000000';

    packetFixtures.set('dm-outgoing-unknown-dst', {
      payloadType: PayloadType.TextMessage,
      messageHash: 'dm-outgoing-unknown-dst',
      pathBytes: [],
      srcHash: 'ffffffffffff',
      dstHash: 'cccccccccccc',
      advertPubkey: null,
      groupTextSender: null,
      anonRequestPubkey: null,
    });

    const { result } = renderVisualizerData({
      packets: [createPacket('dm-outgoing-unknown-dst')],
      contacts: [],
      config: createConfig(selfKey),
    });

    await waitFor(() => expect(result.current.stats.processed).toBe(1));

    expect(result.current.links.size).toBe(0);
    expect(Array.from(result.current.nodes.keys())).toEqual(['self']);
  });
});
