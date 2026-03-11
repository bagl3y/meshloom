import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ContactInfoPane } from '../components/ContactInfoPane';
import type { Contact, ContactDetail, NameOnlyContactDetail } from '../types';

const { getContactDetail, getNameOnlyContactDetail } = vi.hoisted(() => ({
  getContactDetail: vi.fn(),
  getNameOnlyContactDetail: vi.fn(),
}));

vi.mock('../api', () => ({
  api: {
    getContactDetail,
    getNameOnlyContactDetail,
  },
}));

vi.mock('../components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/ContactAvatar', () => ({
  ContactAvatar: () => <div data-testid="contact-avatar" />,
}));

vi.mock('../components/ui/sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

function createContact(overrides: Partial<Contact> = {}): Contact {
  return {
    public_key: 'AA'.repeat(32),
    name: 'Alice',
    type: 1,
    flags: 0,
    last_path: null,
    last_path_len: 0,
    out_path_hash_mode: 0,
    last_advert: null,
    lat: null,
    lon: null,
    last_seen: 1700000000,
    on_radio: false,
    last_contacted: null,
    last_read_at: null,
    first_seen: 1699990000,
    ...overrides,
  };
}

function createDetail(contact: Contact, overrides: Partial<ContactDetail> = {}): ContactDetail {
  return {
    contact,
    name_history: [],
    dm_message_count: 0,
    channel_message_count: 0,
    most_active_rooms: [],
    advert_paths: [],
    advert_frequency: null,
    nearest_repeaters: [],
    ...overrides,
  };
}

function createNameOnlyDetail(
  overrides: Partial<NameOnlyContactDetail> = {}
): NameOnlyContactDetail {
  return {
    name: 'Mystery',
    channel_message_count: 0,
    most_active_rooms: [],
    ...overrides,
  };
}

const baseProps = {
  fromChannel: false,
  onClose: () => {},
  contacts: [] as Contact[],
  config: null,
  favorites: [],
  onToggleFavorite: () => {},
};

describe('ContactInfoPane', () => {
  beforeEach(() => {
    getContactDetail.mockReset();
    getNameOnlyContactDetail.mockReset();
  });

  it('shows hop width when contact has a stored path hash mode', async () => {
    const contact = createContact({ out_path_hash_mode: 1 });
    getContactDetail.mockResolvedValue(createDetail(contact));

    render(<ContactInfoPane {...baseProps} contactKey={contact.public_key} />);

    await screen.findByText(contact.public_key);
    await waitFor(() => {
      expect(screen.getByText('Hop Width')).toBeInTheDocument();
      expect(screen.getByText('2-byte IDs')).toBeInTheDocument();
    });
  });

  it('does not show hop width for flood-routed contacts', async () => {
    const contact = createContact({ last_path_len: -1, out_path_hash_mode: -1 });
    getContactDetail.mockResolvedValue(createDetail(contact));

    render(<ContactInfoPane {...baseProps} contactKey={contact.public_key} />);

    await screen.findByText('Alice');
    await waitFor(() => {
      expect(screen.queryByText('Hop Width')).not.toBeInTheDocument();
      expect(screen.getByText('Flood')).toBeInTheDocument();
    });
  });

  it('shows forced routing override and learned route separately', async () => {
    const contact = createContact({
      last_path_len: 1,
      out_path_hash_mode: 0,
      route_override_path: 'ae92f13e',
      route_override_len: 2,
      route_override_hash_mode: 1,
    });
    getContactDetail.mockResolvedValue(createDetail(contact));

    render(<ContactInfoPane {...baseProps} contactKey={contact.public_key} />);

    await screen.findByText('Alice');
    await waitFor(() => {
      expect(screen.getByText('Routing')).toBeInTheDocument();
      expect(screen.getByText('(forced)')).toBeInTheDocument();
      expect(screen.getByText('Learned Route')).toBeInTheDocument();
      expect(screen.getByText('1 hop')).toBeInTheDocument();
    });
  });

  it('loads name-only channel stats and most active rooms', async () => {
    getNameOnlyContactDetail.mockResolvedValue(
      createNameOnlyDetail({
        name: 'Mystery',
        channel_message_count: 4,
        most_active_rooms: [
          {
            channel_key: 'ab'.repeat(16),
            channel_name: '#ops',
            message_count: 3,
          },
        ],
      })
    );

    render(<ContactInfoPane {...baseProps} contactKey="name:Mystery" fromChannel />);

    await screen.findByText('Mystery');
    await waitFor(() => {
      expect(getNameOnlyContactDetail).toHaveBeenCalledWith('Mystery');
      expect(screen.getByText('Messages')).toBeInTheDocument();
      expect(screen.getByText('Channel Messages')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('Most Active Rooms')).toBeInTheDocument();
      expect(screen.getByText('#ops')).toBeInTheDocument();
      expect(screen.getByText(/same sender name/i)).toBeInTheDocument();
    });
  });

  it('shows alias note in the channel attribution warning for keyed contacts', async () => {
    const contact = createContact();
    getContactDetail.mockResolvedValue(
      createDetail(contact, {
        name_history: [
          { name: 'Alice', first_seen: 1000, last_seen: 2000 },
          { name: 'AliceOld', first_seen: 900, last_seen: 999 },
        ],
      })
    );

    render(<ContactInfoPane {...baseProps} contactKey={contact.public_key} fromChannel />);

    await screen.findByText(contact.public_key);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Also Known As' })).toBeInTheDocument();
      expect(
        screen.getByText(/include messages attributed under the names listed in Also Known As/i)
      ).toBeInTheDocument();
    });
  });
});
