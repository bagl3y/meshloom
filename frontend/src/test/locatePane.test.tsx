import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LocatePane } from '../components/LocatePane';
import i18n from '../i18n';
import type { LocateResponse } from '../types';
import { ApiError } from '../api';

const { locate, getDirectoryNodeNeighbors, repeaterNeighbors } = vi.hoisted(() => ({
  locate: vi.fn(),
  getDirectoryNodeNeighbors: vi.fn(),
  repeaterNeighbors: vi.fn(),
}));

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    api: {
      ...actual.api,
      locate,
      getDirectoryNodeNeighbors,
      repeaterNeighbors,
    },
  };
});

vi.mock('../components/LocateZoneMap', () => ({
  LocateZoneMap: () => <div data-testid="locate-zone-map" />,
}));

function emptyLocate(overrides: Partial<LocateResponse> = {}): LocateResponse {
  return {
    query: 'ghost',
    identity: {
      public_key: 'aa'.repeat(32),
      name: 'Ghost',
      contact_type: 1,
      inferred: false,
      last_seen: null,
    },
    source: null,
    directory_enabled: false,
    default_radius_km: 20,
    anchors: [],
    unresolved_hops: [],
    declared_gps: null,
    heard_locally_0hop: false,
    radio_has_gps: false,
    empty_reason: 'directory_off',
    ...overrides,
  };
}

describe('LocatePane', () => {
  beforeEach(() => {
    locate.mockReset();
    getDirectoryNodeNeighbors.mockReset();
    repeaterNeighbors.mockReset();
  });

  it('shows a CoreScope CTA when never heard and directory is off', async () => {
    locate.mockResolvedValue(emptyLocate());
    const onOpenDirectorySettings = vi.fn();

    render(
      <LocatePane
        contacts={[]}
        locateKey={'aa'.repeat(32)}
        directoryEnabled={false}
        onSelectLocate={vi.fn()}
        onOpenDirectorySettings={onOpenDirectorySettings}
      />
    );

    expect(await screen.findByTestId('locate-directory-cta')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('locate.enableDirectory') }));
    expect(onOpenDirectorySettings).toHaveBeenCalled();
  });

  it('shows an empty state when CoreScope has no observers', async () => {
    locate.mockResolvedValue(
      emptyLocate({
        directory_enabled: true,
        empty_reason: 'no_anchors',
      })
    );

    render(
      <LocatePane
        contacts={[]}
        locateKey={'aa'.repeat(32)}
        directoryEnabled
        onSelectLocate={vi.fn()}
      />
    );

    expect(await screen.findByTestId('locate-empty')).toHaveTextContent(
      i18n.t('locate.noObservers')
    );
  });

  it('lets the user pick among ambiguous candidates', async () => {
    locate.mockRejectedValue(
      new ApiError('ambiguous', 409, {
        reason: 'ambiguous',
        query: 'abc123',
        candidates: [
          { public_key: 'aa'.repeat(32), name: 'One' },
          { public_key: 'bb'.repeat(32), name: 'Two' },
        ],
      })
    );
    const onSelectLocate = vi.fn();

    render(<LocatePane contacts={[]} locateKey="abc123" onSelectLocate={onSelectLocate} />);

    expect(await screen.findByTestId('locate-candidates')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /One/ }));
    expect(onSelectLocate).toHaveBeenCalledWith('aa'.repeat(32));
  });

  it('submits a new search from the form', async () => {
    const onSelectLocate = vi.fn();
    render(<LocatePane contacts={[]} onSelectLocate={onSelectLocate} />);

    fireEvent.change(screen.getByLabelText(i18n.t('locate.searchPlaceholder')), {
      target: { value: 'abcd' },
    });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('locate.search') }));
    expect(onSelectLocate).toHaveBeenCalledWith('abcd');
    await waitFor(() => {
      expect(locate).not.toHaveBeenCalled();
    });
  });
});
