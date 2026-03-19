import { describe, expect, it } from 'vitest';

import {
  buildRawPacketStatsSnapshot,
  type RawPacketStatsSessionState,
} from '../utils/rawPacketStats';

function createSession(
  overrides: Partial<RawPacketStatsSessionState> = {}
): RawPacketStatsSessionState {
  return {
    sessionStartedAt: 700_000,
    totalObservedPackets: 4,
    trimmedObservationCount: 0,
    observations: [
      {
        observationKey: 'obs-1',
        timestamp: 850,
        payloadType: 'Advert',
        routeType: 'Flood',
        decrypted: false,
        rssi: -68,
        snr: 7,
        sourceKey: 'AA11',
        sourceLabel: 'AA11',
        pathTokenCount: 2,
        pathSignature: '01>02',
        hopByteWidth: 1,
      },
      {
        observationKey: 'obs-2',
        timestamp: 910,
        payloadType: 'TextMessage',
        routeType: 'Direct',
        decrypted: true,
        rssi: -74,
        snr: 5,
        sourceKey: 'BB22',
        sourceLabel: 'BB22',
        pathTokenCount: 0,
        pathSignature: null,
        hopByteWidth: null,
      },
      {
        observationKey: 'obs-3',
        timestamp: 960,
        payloadType: 'Advert',
        routeType: 'Flood',
        decrypted: false,
        rssi: -64,
        snr: 8,
        sourceKey: 'AA11',
        sourceLabel: 'AA11',
        pathTokenCount: 1,
        pathSignature: '02',
        hopByteWidth: 2,
      },
      {
        observationKey: 'obs-4',
        timestamp: 990,
        payloadType: 'Ack',
        routeType: 'Direct',
        decrypted: true,
        rssi: -88,
        snr: 3,
        sourceKey: null,
        sourceLabel: null,
        pathTokenCount: 0,
        pathSignature: null,
        hopByteWidth: null,
      },
    ],
    ...overrides,
  };
}

describe('buildRawPacketStatsSnapshot', () => {
  it('computes counts, rankings, and rolling-window coverage from session observations', () => {
    const stats = buildRawPacketStatsSnapshot(createSession(), '5m', 1_000);

    expect(stats.packetCount).toBe(4);
    expect(stats.uniqueSources).toBe(2);
    expect(stats.pathBearingCount).toBe(2);
    expect(stats.payloadBreakdown.slice(0, 3).map((item) => item.label)).toEqual([
      'Advert',
      'Ack',
      'TextMessage',
    ]);
    expect(stats.payloadBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'GroupText', count: 0 }),
        expect.objectContaining({ label: 'Control', count: 0 }),
      ])
    );
    expect(stats.hopByteWidthProfile).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'No path', count: 2 }),
        expect.objectContaining({ label: '1 byte / hop', count: 1 }),
        expect.objectContaining({ label: '2 bytes / hop', count: 1 }),
      ])
    );
    expect(stats.strongestNeighbors[0]).toMatchObject({ label: 'AA11', bestRssi: -64 });
    expect(stats.mostActiveNeighbors[0]).toMatchObject({ label: 'AA11', count: 2 });
    expect(stats.windowFullyCovered).toBe(true);
  });

  it('flags incomplete session coverage when detailed history has been trimmed', () => {
    const stats = buildRawPacketStatsSnapshot(
      createSession({
        trimmedObservationCount: 25,
      }),
      'session',
      1_000
    );

    expect(stats.windowFullyCovered).toBe(false);
    expect(stats.packetCount).toBe(4);
  });
});
