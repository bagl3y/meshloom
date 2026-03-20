import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { RoomServerPanel } from '../components/RoomServerPanel';
import type { Contact } from '../types';

vi.mock('../api', () => ({
  api: {
    roomLogin: vi.fn(),
    roomStatus: vi.fn(),
    roomAcl: vi.fn(),
    roomLppTelemetry: vi.fn(),
    sendRepeaterCommand: vi.fn(),
  },
}));

vi.mock('../components/ui/sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

const { api: _rawApi } = await import('../api');
const mockApi = _rawApi as unknown as Record<string, Mock>;

const roomContact: Contact = {
  public_key: 'aa'.repeat(32),
  name: 'Ops Board',
  type: 3,
  flags: 0,
  direct_path: null,
  direct_path_len: -1,
  direct_path_hash_mode: 0,
  last_advert: null,
  lat: null,
  lon: null,
  last_seen: null,
  on_radio: false,
  last_contacted: null,
  last_read_at: null,
  first_seen: null,
};

describe('RoomServerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('keeps room controls available when login is not confirmed', async () => {
    mockApi.roomLogin.mockResolvedValueOnce({
      status: 'timeout',
      authenticated: false,
      message:
        'No login confirmation was heard from the room server. The control panel is still available; try logging in again if authenticated actions fail.',
    });
    const onAuthenticatedChange = vi.fn();

    render(<RoomServerPanel contact={roomContact} onAuthenticatedChange={onAuthenticatedChange} />);

    fireEvent.click(screen.getByText('Login with ACL / Guest'));

    await waitFor(() => {
      expect(screen.getByText('Room Server Controls')).toBeInTheDocument();
    });
    expect(screen.getByText(/control panel is still available/i)).toBeInTheDocument();
    expect(onAuthenticatedChange).toHaveBeenLastCalledWith(true);
  });
});
