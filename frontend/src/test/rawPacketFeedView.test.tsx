import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RawPacketFeedView } from '../components/RawPacketFeedView';
import type { RawPacketStatsSessionState } from '../utils/rawPacketStats';
import type { Contact, RawPacket } from '../types';

function createSession(
  overrides: Partial<RawPacketStatsSessionState> = {}
): RawPacketStatsSessionState {
  return {
    sessionStartedAt: 1_700_000_000_000,
    totalObservedPackets: 3,
    trimmedObservationCount: 0,
    observations: [
      {
        observationKey: 'obs-1',
        timestamp: 1_700_000_000,
        payloadType: 'Advert',
        routeType: 'Flood',
        decrypted: false,
        rssi: -70,
        snr: 6,
        sourceKey: 'AA11',
        sourceLabel: 'AA11',
        pathTokenCount: 1,
        pathSignature: '01',
      },
      {
        observationKey: 'obs-2',
        timestamp: 1_700_000_030,
        payloadType: 'TextMessage',
        routeType: 'Direct',
        decrypted: true,
        rssi: -66,
        snr: 7,
        sourceKey: 'BB22',
        sourceLabel: 'BB22',
        pathTokenCount: 0,
        pathSignature: null,
      },
      {
        observationKey: 'obs-3',
        timestamp: 1_700_000_050,
        payloadType: 'Ack',
        routeType: 'Direct',
        decrypted: true,
        rssi: -80,
        snr: 4,
        sourceKey: 'BB22',
        sourceLabel: 'BB22',
        pathTokenCount: 0,
        pathSignature: null,
      },
    ],
    ...overrides,
  };
}

function createContact(overrides: Partial<Contact> = {}): Contact {
  return {
    public_key: 'aa11bb22cc33' + '0'.repeat(52),
    name: 'Alpha',
    type: 1,
    flags: 0,
    direct_path: null,
    direct_path_len: 0,
    direct_path_hash_mode: 0,
    last_advert: 1_700_000_000,
    lat: null,
    lon: null,
    last_seen: null,
    on_radio: false,
    last_contacted: null,
    last_read_at: null,
    first_seen: null,
    ...overrides,
  };
}

describe('RawPacketFeedView', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens a stats drawer with window controls and grouped summaries', () => {
    render(
      <RawPacketFeedView packets={[]} rawPacketStatsSession={createSession()} contacts={[]} />
    );

    expect(screen.getByText('Raw Packet Feed')).toBeInTheDocument();
    expect(screen.queryByText('Packet Types')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show stats/i }));

    expect(screen.getByLabelText('Stats window')).toBeInTheDocument();
    expect(screen.getByText('Packet Types')).toBeInTheDocument();
    expect(screen.getByText('Most-Heard Neighbors')).toBeInTheDocument();
    expect(screen.getByText('Traffic Timeline')).toBeInTheDocument();
  });

  it('shows stats by default on desktop', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query === '(min-width: 768px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );

    render(
      <RawPacketFeedView packets={[]} rawPacketStatsSession={createSession()} contacts={[]} />
    );

    expect(screen.getByText('Packet Types')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hide stats/i })).toBeInTheDocument();
  });

  it('refreshes coverage when packet or session props update without counter deltas', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:30Z'));

    const initialPackets: RawPacket[] = [];
    const nextPackets: RawPacket[] = [
      {
        id: 1,
        timestamp: 1_704_067_255,
        data: '00',
        decrypted: false,
        payload_type: 'Unknown',
        rssi: null,
        snr: null,
        observation_id: 1,
        decrypted_info: null,
      },
    ];
    const initialSession = createSession({
      sessionStartedAt: Date.parse('2024-01-01T00:00:00Z'),
      totalObservedPackets: 10,
      trimmedObservationCount: 1,
      observations: [
        {
          observationKey: 'obs-1',
          timestamp: 1_704_067_220,
          payloadType: 'Advert',
          routeType: 'Flood',
          decrypted: false,
          rssi: -70,
          snr: 6,
          sourceKey: 'AA11',
          sourceLabel: 'AA11',
          pathTokenCount: 1,
          pathSignature: '01',
        },
      ],
    });

    const { rerender } = render(
      <RawPacketFeedView
        packets={initialPackets}
        rawPacketStatsSession={initialSession}
        contacts={[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /show stats/i }));
    fireEvent.change(screen.getByLabelText('Stats window'), { target: { value: '1m' } });
    expect(screen.getByText(/only covered for 10 sec/i)).toBeInTheDocument();

    vi.setSystemTime(new Date('2024-01-01T00:01:10Z'));
    rerender(
      <RawPacketFeedView
        packets={nextPackets}
        rawPacketStatsSession={initialSession}
        contacts={[]}
      />
    );
    expect(screen.getByText(/only covered for 50 sec/i)).toBeInTheDocument();

    vi.setSystemTime(new Date('2024-01-01T00:01:30Z'));
    const nextSession = {
      ...initialSession,
      sessionStartedAt: Date.parse('2024-01-01T00:01:00Z'),
      observations: [
        {
          ...initialSession.observations[0],
          timestamp: 1_704_067_280,
        },
      ],
    };
    rerender(
      <RawPacketFeedView packets={nextPackets} rawPacketStatsSession={nextSession} contacts={[]} />
    );
    expect(screen.getByText(/only covered for 10 sec/i)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('resolves neighbor labels from matching contacts when identity is available', () => {
    render(
      <RawPacketFeedView
        packets={[]}
        rawPacketStatsSession={createSession({
          totalObservedPackets: 1,
          observations: [
            {
              observationKey: 'obs-1',
              timestamp: 1_700_000_000,
              payloadType: 'Advert',
              routeType: 'Flood',
              decrypted: false,
              rssi: -70,
              snr: 6,
              sourceKey: 'AA11BB22CC33',
              sourceLabel: 'AA11BB22CC33',
              pathTokenCount: 1,
              pathSignature: '01',
            },
          ],
        })}
        contacts={[createContact()]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /show stats/i }));
    fireEvent.change(screen.getByLabelText('Stats window'), { target: { value: 'session' } });
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
  });

  it('marks unresolved neighbor identities explicitly', () => {
    render(
      <RawPacketFeedView
        packets={[]}
        rawPacketStatsSession={createSession({
          totalObservedPackets: 1,
          observations: [
            {
              observationKey: 'obs-1',
              timestamp: 1_700_000_000,
              payloadType: 'Advert',
              routeType: 'Flood',
              decrypted: false,
              rssi: -70,
              snr: 6,
              sourceKey: 'DEADBEEF1234',
              sourceLabel: 'DEADBEEF1234',
              pathTokenCount: 1,
              pathSignature: '01',
            },
          ],
        })}
        contacts={[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /show stats/i }));
    fireEvent.change(screen.getByLabelText('Stats window'), { target: { value: 'session' } });
    expect(screen.getAllByText('Identity not resolvable').length).toBeGreaterThan(0);
  });
});
