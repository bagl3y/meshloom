import { Profiler } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import './eSlices';
import { CrackerPanel } from '../components/CrackerPanel';
import i18n from '../i18n';
import { recordRawPacket, resetRawPacketStore } from '../stores/rawPacketStore';
import type { RawPacket } from '../types';

vi.mock('meshcore-hashtag-cracker', () => ({
  GroupTextCracker: class {
    isGpuAvailable() {
      return false;
    }
    destroy() {}
    setWordlist() {}
    abort() {}
  },
}));

vi.mock('nosleep.js', () => ({
  default: class {
    enable() {}
    disable() {}
  },
}));

vi.mock('../api', () => ({
  api: {
    getUndecryptedPacketCount: vi.fn(),
  },
}));

vi.mock('../components/ui/sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

import { api } from '../api';

const mockedApi = vi.mocked(api);

function createGroupTextPacket(overrides: Partial<RawPacket> = {}): RawPacket {
  return {
    id: 99,
    observation_id: 99,
    timestamp: 1700000000,
    data: 'aabbccdd',
    payload_type: 'GROUP_TEXT',
    snr: 7.5,
    rssi: -80,
    decrypted: false,
    decrypted_info: null,
    ...overrides,
  };
}

describe('CrackerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRawPacketStore();
    mockedApi.getUndecryptedPacketCount.mockResolvedValue({ count: 0 });
  });

  it('allows clearing max length while editing', async () => {
    render(<CrackerPanel channels={[]} onChannelCreate={vi.fn()} visible={false} />);

    await waitFor(() => {
      expect(mockedApi.getUndecryptedPacketCount).toHaveBeenCalled();
    });

    const maxLengthInput = screen.getByLabelText(i18n.t('cracker.maxLength')) as HTMLInputElement;
    fireEvent.change(maxLengthInput, { target: { value: '' } });

    expect(maxLengthInput.value).toBe('');
  });

  it('does not re-render while collapsed when packets arrive', async () => {
    let commits = 0;
    render(
      <Profiler
        id="cracker-collapsed"
        onRender={() => {
          commits += 1;
        }}
      >
        <CrackerPanel channels={[]} onChannelCreate={vi.fn()} visible={false} />
      </Profiler>
    );

    await waitFor(() => {
      expect(mockedApi.getUndecryptedPacketCount).toHaveBeenCalled();
    });

    const before = commits;
    act(() => {
      recordRawPacket(createGroupTextPacket());
    });
    expect(commits).toBe(before);
    expect(screen.getByText(i18n.t('cracker.pending')).closest('span')).toHaveTextContent('0');
  });

  it('reads the current packet buffer when shown again', async () => {
    const { rerender } = render(
      <CrackerPanel channels={[]} onChannelCreate={vi.fn()} visible={false} />
    );

    await waitFor(() => {
      expect(mockedApi.getUndecryptedPacketCount).toHaveBeenCalled();
    });

    act(() => {
      recordRawPacket(createGroupTextPacket());
    });
    expect(screen.getByText(i18n.t('cracker.pending')).closest('span')).toHaveTextContent('0');

    rerender(<CrackerPanel channels={[]} onChannelCreate={vi.fn()} visible />);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('cracker.pending')).closest('span')).toHaveTextContent('1');
    });
  });
});
