import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import './eSlices';
import { TracePane } from '../components/TracePane';
import i18n from '../i18n';
import type { Contact, RadioConfig, RadioTraceResponse } from '../types';
import { CONTACT_TYPE_REPEATER } from '../types';

function makeContact(
  publicKey: string,
  name: string | null,
  type = CONTACT_TYPE_REPEATER,
  overrides: Partial<Contact> = {}
): Contact {
  return {
    public_key: publicKey,
    name,
    type,
    flags: 0,
    direct_path: null,
    direct_path_len: -1,
    direct_path_hash_mode: -1,
    last_advert: null,
    lat: null,
    lon: null,
    last_seen: null,
    on_radio: false,
    favorite: false,
    last_contacted: null,
    last_read_at: null,
    first_seen: null,
    ...overrides,
  };
}

function addRepeaterAria(name: string) {
  return i18n.t('trace.addRepeaterAria', { name });
}

const addRepeaterPrefix = i18n.t('trace.addRepeaterAria', { name: '' }).trimEnd();

function isAddRepeaterButton(accessibleName: string) {
  return accessibleName.startsWith(addRepeaterPrefix);
}

const config: RadioConfig = {
  public_key: 'ff'.repeat(32),
  name: 'Base Radio',
  lat: 10,
  lon: 20,
  tx_power: 17,
  max_tx_power: 22,
  radio: { freq: 910.525, bw: 62.5, sf: 7, cr: 5 },
  path_hash_mode: 0,
  path_hash_mode_supported: true,
};

describe('TracePane', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows only full-key repeaters and filters by name or key', () => {
    render(
      <TracePane
        config={config}
        onRunTracePath={vi.fn()}
        contacts={[
          makeContact('11'.repeat(32), 'Relay Alpha'),
          makeContact('22'.repeat(6), 'Prefix Relay'),
          makeContact('33'.repeat(32), 'Client Node', 1),
          makeContact('44'.repeat(32), 'Relay Beta'),
        ]}
      />
    );

    expect(screen.getByText('Relay Alpha')).toBeInTheDocument();
    expect(screen.getByText('Relay Beta')).toBeInTheDocument();
    expect(screen.queryByText('Prefix Relay')).not.toBeInTheDocument();
    expect(screen.queryByText('Client Node')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(i18n.t('trace.searchAria')), {
      target: { value: 'beta' },
    });
    expect(screen.queryByText('Relay Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Relay Beta')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(i18n.t('trace.searchAria')), {
      target: { value: '111111' },
    });
    expect(screen.getByText('Relay Alpha')).toBeInTheDocument();
  });

  it('adds, reorders, removes, and sends a trace path with known repeaters', async () => {
    const relayA = makeContact('11'.repeat(32), 'Relay Alpha');
    const relayB = makeContact('22'.repeat(32), 'Relay Beta');
    const onRunTracePath = vi.fn(
      async (): Promise<RadioTraceResponse> => ({
        path_len: 2,
        timeout_seconds: 6,
        nodes: [
          {
            role: 'repeater',
            public_key: relayB.public_key,
            name: relayB.name,
            observed_hash: relayB.public_key.slice(0, 8),
            snr: 7.5,
          },
          {
            role: 'repeater',
            public_key: relayA.public_key,
            name: relayA.name,
            observed_hash: relayA.public_key.slice(0, 8),
            snr: 3.25,
          },
          {
            role: 'local',
            public_key: config.public_key,
            name: config.name,
            observed_hash: null,
            snr: 5.0,
          },
        ],
      })
    );

    render(
      <TracePane config={config} onRunTracePath={onRunTracePath} contacts={[relayA, relayB]} />
    );

    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('trace.addRepeaterAria', { name: 'Relay Alpha' }) })
    );
    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('trace.addRepeaterAria', { name: 'Relay Beta' }) })
    );

    expect(
      screen.getByText(i18n.t('trace.hopsSelected', { count: 2, bytes: 4 }))
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('trace.moveUp', { name: 'Relay Beta' }) })
    );
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.send') }));

    await waitFor(() => {
      expect(onRunTracePath).toHaveBeenCalledWith(4, [
        { public_key: relayB.public_key },
        { public_key: relayA.public_key },
      ]);
    });

    expect(
      screen.getByRole('heading', { name: i18n.t('trace.resultsWithTime', { time: '6.0' }) })
    ).toBeInTheDocument();
    expect(screen.getByText('+7.5 dB')).toBeInTheDocument();
    expect(screen.getByText('+5.0 dB')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('trace.remove', { name: 'Relay Alpha' }) })
    );
    expect(
      screen.getByText(i18n.t('trace.hopsSelected', { count: 1, bytes: 4 }))
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('trace.remove', { name: 'Relay Beta' }) })
    );
    expect(screen.getByText(i18n.t('trace.noHopsSelected'))).toBeInTheDocument();
  });

  it('reverse link appends the reversed hop chain to build a return path (issue #287)', async () => {
    const relayA = makeContact('11'.repeat(32), 'Relay Alpha');
    const relayB = makeContact('22'.repeat(32), 'Relay Beta');
    const relayC = makeContact('33'.repeat(32), 'Relay Charlie');
    const onRunTracePath = vi.fn(
      async (): Promise<RadioTraceResponse> => ({
        path_len: 0,
        timeout_seconds: 6,
        nodes: [],
      })
    );

    render(
      <TracePane
        config={config}
        onRunTracePath={onRunTracePath}
        contacts={[relayA, relayB, relayC]}
      />
    );

    // Single hop: Reverse link is a no-op (and disabled).
    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('trace.addRepeaterAria', { name: 'Relay Alpha' }) })
    );
    expect(screen.getByRole('button', { name: i18n.t('trace.reverseLink') })).toBeDisabled();

    // R1, R2, R3 -> append R2, R1 => R1, R2, R3, R2, R1.
    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('trace.addRepeaterAria', { name: 'Relay Beta' }) })
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: i18n.t('trace.addRepeaterAria', { name: 'Relay Charlie' }),
      })
    );
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.reverseLink') }));

    expect(
      screen.getByText(i18n.t('trace.hopsSelected', { count: 5, bytes: 4 }))
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.send') }));
    await waitFor(() => {
      expect(onRunTracePath).toHaveBeenCalledWith(4, [
        { public_key: relayA.public_key },
        { public_key: relayB.public_key },
        { public_key: relayC.public_key },
        { public_key: relayB.public_key },
        { public_key: relayA.public_key },
      ]);
    });
  });

  it('allows adding the same repeater multiple times from the picker row', () => {
    const relayA = makeContact('11'.repeat(32), 'Relay Alpha');

    render(<TracePane config={config} onRunTracePath={vi.fn()} contacts={[relayA]} />);

    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('trace.addRepeaterAria', { name: 'Relay Alpha' }) })
    );
    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('trace.addRepeaterAria', { name: 'Relay Alpha' }) })
    );

    expect(
      screen.getByText(i18n.t('trace.hopsSelected', { count: 2, bytes: 4 }))
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t('trace.addedTimes', { count: 2 }))).toBeInTheDocument();
  });

  it('adds custom hops from the modal and locks later custom hops to the same byte width', async () => {
    const relayA = makeContact('11'.repeat(32), 'Relay Alpha');
    const onRunTracePath = vi.fn(
      async (): Promise<RadioTraceResponse> => ({
        path_len: 2,
        timeout_seconds: 4.5,
        nodes: [
          {
            role: 'custom',
            public_key: null,
            name: null,
            observed_hash: 'ae',
            snr: 4.0,
          },
          {
            role: 'repeater',
            public_key: relayA.public_key,
            name: relayA.name,
            observed_hash: '11',
            snr: 2.0,
          },
          {
            role: 'local',
            public_key: config.public_key,
            name: config.name,
            observed_hash: null,
            snr: 3.0,
          },
        ],
      })
    );

    render(<TracePane config={config} onRunTracePath={onRunTracePath} contacts={[relayA]} />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.customPath') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.nByte', { count: 1 }) }));
    fireEvent.change(screen.getByLabelText(i18n.t('trace.repeaterPrefix')), {
      target: { value: 'ae' },
    });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.addCustomHop') }));

    expect(
      screen.getByText(i18n.t('trace.hopsSelected', { count: 1, bytes: 1 }))
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('trace.customHopBytes', { hex: 'AE', count: 1 }))
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('trace.addRepeaterAria', { name: 'Relay Alpha' }) })
    );
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.send') }));

    await waitFor(() => {
      expect(onRunTracePath).toHaveBeenCalledWith(1, [
        { hop_hex: 'ae' },
        { public_key: relayA.public_key },
      ]);
    });

    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.customPath') }));
    expect(
      screen.getByRole('button', { name: i18n.t('trace.nByte', { count: 2 }) })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('trace.nByte', { count: 4 }) })
    ).toBeDisabled();
    expect(screen.getByText(i18n.t('trace.customLocked', { bytes: 1 }))).toBeInTheDocument();
  });

  it('Traced lists only trace-used repeaters in MRU order, persisted locally (issue #286)', async () => {
    const relayA = makeContact('11'.repeat(32), 'Relay Alpha');
    const relayB = makeContact('22'.repeat(32), 'Relay Beta');
    const relayC = makeContact('33'.repeat(32), 'Relay Charlie');
    const onRunTracePath = vi.fn(
      async (): Promise<RadioTraceResponse> => ({
        path_len: 0,
        timeout_seconds: 6,
        nodes: [],
      })
    );

    const { unmount } = render(
      <TracePane
        config={config}
        onRunTracePath={onRunTracePath}
        contacts={[relayA, relayB, relayC]}
      />
    );

    const rowNames = () =>
      screen
        .queryAllByRole('button', { name: isAddRepeaterButton })
        .map((row) => row.getAttribute('aria-label'));

    // No history yet: Traced shows an explanatory empty state, not the full list.
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.sortTraced') }));
    expect(screen.getByText(i18n.t('trace.emptyTracedNone'))).toBeInTheDocument();
    expect(rowNames()).toEqual([]);

    // Build and run a trace with B from the A/Z list.
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.sortAlpha') }));
    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('trace.addRepeaterAria', { name: 'Relay Beta' }) })
    );
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.send') }));
    await waitFor(() => expect(onRunTracePath).toHaveBeenCalledTimes(1));

    // Traced lists only B; untraced A and C are filtered out.
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.sortTraced') }));
    expect(rowNames()).toEqual([addRepeaterAria('Relay Beta')]);

    // A second trace with C bumps it above B.
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.sortAlpha') }));
    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('trace.remove', { name: 'Relay Beta' }) })
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: i18n.t('trace.addRepeaterAria', { name: 'Relay Charlie' }),
      })
    );
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.send') }));
    await waitFor(() => expect(onRunTracePath).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.sortTraced') }));
    expect(rowNames()).toEqual([addRepeaterAria('Relay Charlie'), addRepeaterAria('Relay Beta')]);

    // Order persists across remounts via localStorage.
    unmount();
    render(
      <TracePane
        config={config}
        onRunTracePath={onRunTracePath}
        contacts={[relayA, relayB, relayC]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.sortTraced') }));
    expect(rowNames()).toEqual([addRepeaterAria('Relay Charlie'), addRepeaterAria('Relay Beta')]);
  });

  it('seeds Traced from stored recent traces when no usage history exists', () => {
    const relayA = makeContact('11'.repeat(32), 'Relay Alpha');
    const relayB = makeContact('22'.repeat(32), 'Relay Beta');
    localStorage.setItem(
      'remoteterm-recent-traces',
      JSON.stringify([
        {
          ranAt: 1,
          hops: [
            { kind: 'repeater', publicKey: relayB.public_key, displayName: 'Relay Beta' },
            { kind: 'custom', hopHex: 'ae', hopBytes: 1, displayName: 'AE (1B)' },
          ],
        },
      ])
    );

    render(<TracePane config={config} onRunTracePath={vi.fn()} contacts={[relayA, relayB]} />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.sortTraced') }));
    expect(
      screen
        .getAllByRole('button', { name: isAddRepeaterButton })
        .map((row) => row.getAttribute('aria-label'))
    ).toEqual([addRepeaterAria('Relay Beta')]);
  });

  it('Dist. hides repeaters without a known distance when the radio has a location', () => {
    const located = makeContact('11'.repeat(32), 'Relay Located', CONTACT_TYPE_REPEATER, {
      lat: 10.1,
      lon: 20.1,
    });
    const unlocated = makeContact('22'.repeat(32), 'Relay Mystery');

    render(<TracePane config={config} onRunTracePath={vi.fn()} contacts={[located, unlocated]} />);

    // A/Z shows both.
    expect(screen.getByText('Relay Located')).toBeInTheDocument();
    expect(screen.getByText('Relay Mystery')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.sortDistance') }));
    expect(screen.getByText('Relay Located')).toBeInTheDocument();
    expect(screen.queryByText('Relay Mystery')).not.toBeInTheDocument();

    // Without a local radio location, the filter is skipped (note explains instead).
    fireEvent.change(screen.getByLabelText(i18n.t('trace.searchAria')), {
      target: { value: 'mystery' },
    });
    expect(screen.getByText(i18n.t('trace.emptyDistanceNoMatch'))).toBeInTheDocument();
  });

  it('caps the rendered repeater list and reports the overflow', () => {
    const contacts = Array.from({ length: 70 }, (_, i) =>
      makeContact(i.toString(16).padStart(2, '0').repeat(32), `Relay ${String(i).padStart(3, '0')}`)
    );

    render(<TracePane config={config} onRunTracePath={vi.fn()} contacts={contacts} />);

    expect(screen.getAllByRole('button', { name: isAddRepeaterButton })).toHaveLength(60);
    expect(
      screen.getByText(i18n.t('trace.showingFirst', { shown: 60, total: 70 }))
    ).toBeInTheDocument();
  });

  it('drops an in-flight result after the draft path changes', async () => {
    const relayA = makeContact('11'.repeat(32), 'Relay Alpha');
    const relayB = makeContact('22'.repeat(32), 'Relay Beta');
    let resolveTrace: ((value: RadioTraceResponse) => void) | null = null;
    const onRunTracePath = vi.fn(
      () =>
        new Promise<RadioTraceResponse>((resolve) => {
          resolveTrace = resolve;
        })
    );

    render(
      <TracePane config={config} onRunTracePath={onRunTracePath} contacts={[relayA, relayB]} />
    );

    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('trace.addRepeaterAria', { name: 'Relay Alpha' }) })
    );
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trace.send') }));

    await waitFor(() => {
      expect(onRunTracePath).toHaveBeenCalledWith(4, [{ public_key: relayA.public_key }]);
    });

    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('trace.addRepeaterAria', { name: 'Relay Beta' }) })
    );

    expect(
      screen.getByText(i18n.t('trace.hopsSelected', { count: 2, bytes: 4 }))
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('trace.send') })).toBeEnabled();

    await act(async () => {
      resolveTrace?.({
        path_len: 1,
        timeout_seconds: 6,
        nodes: [
          {
            role: 'repeater',
            public_key: relayA.public_key,
            name: relayA.name,
            observed_hash: relayA.public_key.slice(0, 8),
            snr: 7.5,
          },
          {
            role: 'local',
            public_key: config.public_key,
            name: config.name,
            observed_hash: null,
            snr: 5.0,
          },
        ],
      });
    });

    expect(
      screen.queryByRole('heading', { name: i18n.t('trace.resultsWithTime', { time: '6.0' }) })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('+7.5 dB')).not.toBeInTheDocument();
    // The Results section stays hidden entirely until a result or error lands.
    expect(screen.queryByRole('heading', { name: /^results/i })).not.toBeInTheDocument();
  });
});
