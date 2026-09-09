import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { RoomServerPanel, resetRoomCacheForTests } from '../components/RoomServerPanel';
import i18n from '../i18n';
import fEn from '../i18n/locales/slices/f.en.json';
import fFr from '../i18n/locales/slices/f.fr.json';

i18n.addResourceBundle('en', 'translation', fEn, true, true);
i18n.addResourceBundle('fr', 'translation', fFr, true, true);
import { resetRememberedServerPasswordsForTests } from '../hooks/useRememberedServerPassword';
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
const { toast } = await import('../components/ui/sonner');
const mockToast = toast as unknown as Record<string, Mock>;

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
  favorite: false,
  last_contacted: null,
  last_read_at: null,
  first_seen: null,
};

describe('RoomServerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetRoomCacheForTests();
    resetRememberedServerPasswordsForTests();
  });

  it('keeps room controls available when login is not confirmed', async () => {
    mockApi.roomLogin.mockResolvedValueOnce({
      status: 'timeout',
      authenticated: false,
      message: i18n.t('room.loginUnconfirmedFallback'),
    });
    const onAuthenticatedChange = vi.fn();

    render(<RoomServerPanel contact={roomContact} onAuthenticatedChange={onAuthenticatedChange} />);

    fireEvent.click(screen.getByText(i18n.t('room.loginGuest')));

    await waitFor(() => {
      expect(screen.getByText(i18n.t('room.showTools'))).toBeInTheDocument();
    });
    expect(screen.getByText(i18n.t('room.showTools'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('room.retryExistingAccess'))).toBeInTheDocument();
    expect(mockToast.warning).toHaveBeenCalledWith(i18n.t('room.loginUnconfirmed'), {
      description: i18n.t('room.loginUnconfirmedFallback'),
    });
    expect(onAuthenticatedChange).toHaveBeenLastCalledWith(true);
  });

  it('retains the last password for one-click retry after unlocking the panel', async () => {
    mockApi.roomLogin
      .mockResolvedValueOnce({
        status: 'timeout',
        authenticated: false,
        message: 'No reply heard',
      })
      .mockResolvedValueOnce({
        status: 'ok',
        authenticated: true,
        message: null,
      });

    render(<RoomServerPanel contact={roomContact} />);

    fireEvent.change(screen.getByLabelText(i18n.t('repeater.passwordAria')), {
      target: { value: 'secret-room-password' },
    });
    fireEvent.click(screen.getByText(i18n.t('repeater.loginPassword')));

    await waitFor(() => {
      expect(screen.getByText(i18n.t('repeater.retryPassword'))).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(i18n.t('repeater.retryPassword')));

    await waitFor(() => {
      expect(mockApi.roomLogin).toHaveBeenNthCalledWith(
        1,
        roomContact.public_key,
        'secret-room-password'
      );
      expect(mockApi.roomLogin).toHaveBeenNthCalledWith(
        2,
        roomContact.public_key,
        'secret-room-password'
      );
    });
  });

  it('returns to an empty login form when re-entering the password', async () => {
    mockApi.roomLogin.mockResolvedValueOnce({
      status: 'timeout',
      authenticated: false,
      message: 'No reply heard',
    });

    render(<RoomServerPanel contact={roomContact} />);

    fireEvent.click(screen.getByLabelText(i18n.t('repeater.rememberPassword')));
    fireEvent.change(screen.getByLabelText(i18n.t('repeater.passwordAria')), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByText(i18n.t('repeater.loginPassword')));

    await waitFor(() => {
      expect(screen.getByText(i18n.t('repeater.reenterPassword'))).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(i18n.t('repeater.reenterPassword')));

    await waitFor(() => {
      expect(screen.getByText(i18n.t('repeater.loginPassword'))).toBeInTheDocument();
    });
    expect(screen.getByLabelText(i18n.t('repeater.passwordAria'))).toHaveValue('');
    expect(screen.queryByText(i18n.t('repeater.reenterPassword'))).not.toBeInTheDocument();
    expect(localStorage.getItem(`remoteterm-server-password:room:${roomContact.public_key}`)).toBe(
      null
    );
  });

  it('shows only a success toast after a confirmed login', async () => {
    mockApi.roomLogin.mockResolvedValueOnce({
      status: 'ok',
      authenticated: true,
      message: null,
    });

    render(<RoomServerPanel contact={roomContact} />);

    fireEvent.click(screen.getByText(i18n.t('room.loginGuest')));

    await waitFor(() => {
      expect(screen.getByText(i18n.t('room.showTools'))).toBeInTheDocument();
    });

    expect(screen.queryByText(i18n.t('room.loginConfirmed'))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('repeater.retryPassword'))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('room.retryExistingAccess'))).not.toBeInTheDocument();
    expect(mockToast.success).toHaveBeenCalledWith(i18n.t('room.loginConfirmed'));
  });
  it('auto-logs in once when a password is already remembered', async () => {
    localStorage.setItem(
      `remoteterm-server-password:room:${roomContact.public_key}`,
      JSON.stringify({ password: 'remembered-password' })
    );
    mockApi.roomLogin.mockResolvedValue({ status: 'ok', authenticated: true, message: null });

    const { rerender } = render(<RoomServerPanel contact={roomContact} />);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('room.showTools'))).toBeInTheDocument();
    });
    rerender(<RoomServerPanel contact={roomContact} />);

    expect(mockApi.roomLogin).toHaveBeenCalledTimes(1);
    expect(mockApi.roomLogin).toHaveBeenCalledWith(roomContact.public_key, 'remembered-password');
  });

  it('does not auto-log in when no password is remembered', async () => {
    render(<RoomServerPanel contact={roomContact} />);

    await waitFor(() => {
      expect(screen.getByText(i18n.t('repeater.loginPassword'))).toBeInTheDocument();
    });
    expect(mockApi.roomLogin).not.toHaveBeenCalled();
  });

  it('does not retry the auto-login after it fails', async () => {
    localStorage.setItem(
      `remoteterm-server-password:room:${roomContact.public_key}`,
      JSON.stringify({ password: 'remembered-password' })
    );
    mockApi.roomLogin.mockRejectedValue(new Error('room server unreachable'));

    const { rerender } = render(<RoomServerPanel contact={roomContact} />);

    await waitFor(() => {
      expect(mockApi.roomLogin).toHaveBeenCalledTimes(1);
    });
    rerender(<RoomServerPanel contact={roomContact} />);
    await waitFor(() => {
      expect(screen.getByText(i18n.t('repeater.retryPassword'))).toBeInTheDocument();
    });

    expect(mockApi.roomLogin).toHaveBeenCalledTimes(1);
  });

  it('re-issues the login when Sync Now is clicked', async () => {
    mockApi.roomLogin.mockResolvedValue({ status: 'ok', authenticated: true, message: null });

    render(<RoomServerPanel contact={roomContact} />);

    fireEvent.click(screen.getByText(i18n.t('room.loginGuest')));
    await waitFor(() => {
      expect(screen.getByText(i18n.t('room.syncNow'))).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(i18n.t('room.syncNow')));

    await waitFor(() => {
      expect(mockApi.roomLogin).toHaveBeenCalledTimes(2);
    });
  });
});
