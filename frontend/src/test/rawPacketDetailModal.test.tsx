import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RawPacketDetailModal } from '../components/RawPacketDetailModal';
import type { Channel, RawPacket } from '../types';

const BOT_CHANNEL: Channel = {
  key: 'eb50a1bcb3e4e5d7bf69a57c9dada211',
  name: '#bot',
  is_hashtag: true,
  on_radio: false,
  last_read_at: null,
};

const BOT_PACKET: RawPacket = {
  id: 1,
  observation_id: 10,
  timestamp: 1_700_000_000,
  data: '15833fa002860ccae0eed9ca78b9ab0775d477c1f6490a398bf4edc75240',
  decrypted: false,
  payload_type: 'GroupText',
  rssi: -72,
  snr: 5.5,
  decrypted_info: null,
};

describe('RawPacketDetailModal', () => {
  it('renders path hops as nowrap arrow-delimited groups and links hover state to the full packet hex', () => {
    render(<RawPacketDetailModal packet={BOT_PACKET} channels={[BOT_CHANNEL]} onClose={vi.fn()} />);

    const pathDescription = screen.getByText(
      'Historical route taken (3-byte hashes added as packet floods through network)'
    );
    const pathFieldBox = pathDescription.closest('[class*="rounded-lg"]');
    expect(pathFieldBox).not.toBeNull();

    const pathField = within(pathFieldBox as HTMLElement);
    expect(pathField.getByText('3FA002 →')).toHaveClass('whitespace-nowrap');
    expect(pathField.getByText('860CCA →')).toHaveClass('whitespace-nowrap');
    expect(pathField.getByText('E0EED9')).toHaveClass('whitespace-nowrap');

    const pathRun = screen.getByText('3F A0 02 86 0C CA E0 EE D9');
    const idleClassName = pathRun.className;

    fireEvent.mouseEnter(pathFieldBox as HTMLElement);
    expect(pathRun.className).not.toBe(idleClassName);

    fireEvent.mouseLeave(pathFieldBox as HTMLElement);
    expect(pathRun.className).toBe(idleClassName);
  });
});
