import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ContactInfoPane } from '../components/ContactInfoPane';
import type { Contact, ContactDetail } from '../types';

const { getContactDetail } = vi.hoisted(() => ({
  getContactDetail: vi.fn(),
}));

vi.mock('../api', () => ({
  api: {
    getContactDetail,
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

function createDetail(contact: Contact): ContactDetail {
  return {
    contact,
    name_history: [],
    dm_message_count: 0,
    channel_message_count: 0,
    most_active_rooms: [],
    advert_paths: [],
    advert_frequency: null,
    nearest_repeaters: [],
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
  });

  it('shows hop width when contact has a stored path hash mode', async () => {
    const contact = createContact({ out_path_hash_mode: 1 });
    getContactDetail.mockResolvedValue(createDetail(contact));

    render(<ContactInfoPane {...baseProps} contactKey={contact.public_key} />);

    await screen.findByText('Alice');
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
});
