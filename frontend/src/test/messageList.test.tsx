import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MessageList } from '../components/MessageList';
import type { Message } from '../types';

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    type: 'CHAN',
    conversation_key: 'C3B889530D4F02DB5662EA13C417F530',
    text: 'Alice: hello world',
    sender_timestamp: 1700000000,
    received_at: 1700000001,
    paths: null,
    txt_type: 0,
    signature: null,
    sender_key: null,
    outgoing: false,
    acked: 0,
    sender_name: null,
    ...overrides,
  };
}

describe('MessageList channel sender rendering', () => {
  it('renders explicit corrupt placeholder and warning avatar for unnamed corrupt channel packets', () => {
    render(
      <MessageList
        messages={[
          createMessage({
            text: "Nv\x0ek\x16ɩ'\x7fg:",
            sender_name: null,
            sender_key: null,
          }),
        ]}
        contacts={[]}
        loading={false}
      />
    );

    expect(screen.getByText('<No name -- corrupt packet?>')).toBeInTheDocument();
    expect(screen.getByTestId('corrupt-avatar')).toBeInTheDocument();
  });

  it('prefers stored sender_name for channel messages even when text is not sender-prefixed', () => {
    render(
      <MessageList
        messages={[
          createMessage({
            text: 'garbled payload with no sender prefix',
            sender_name: 'Alice',
            sender_key: 'ab'.repeat(32),
          }),
        ]}
        contacts={[]}
        loading={false}
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});
