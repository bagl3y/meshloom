import { afterEach, describe, expect, it } from 'vitest';

import { conversationMessageCache } from '../hooks/useConversationMessages';
import { getRawPackets, seedRawPacketStore } from '../stores/rawPacketStore';
import { CONVERSATION_DRAFT_PREFIX } from '../utils/conversationDrafts';
import { resetClientStateAfterIdentityAdopt } from '../utils/identityAdoptReset';
import {
  LAST_VIEWED_CONVERSATION_KEY,
  saveLastViewedConversation,
} from '../utils/lastViewedConversation';

describe('resetClientStateAfterIdentityAdopt', () => {
  afterEach(() => {
    localStorage.clear();
    conversationMessageCache.clear();
  });

  it('clears contact-scoped drafts and last-viewed contacts without touching channels', () => {
    localStorage.setItem(`${CONVERSATION_DRAFT_PREFIX}contact-aabb`, 'hello');
    localStorage.setItem(`${CONVERSATION_DRAFT_PREFIX}channel-public`, 'keep');
    saveLastViewedConversation({ type: 'contact', id: 'aabb', name: 'Alice' });
    conversationMessageCache.set('aabb', { messages: [], hasOlderMessages: false });
    seedRawPacketStore({
      packets: [{ id: 1, observation_id: 1 } as never],
    });

    resetClientStateAfterIdentityAdopt();

    expect(localStorage.getItem(`${CONVERSATION_DRAFT_PREFIX}contact-aabb`)).toBeNull();
    expect(localStorage.getItem(`${CONVERSATION_DRAFT_PREFIX}channel-public`)).toBe('keep');
    expect(localStorage.getItem(LAST_VIEWED_CONVERSATION_KEY)).toBeNull();
    expect(conversationMessageCache.get('aabb')).toBeUndefined();
    expect(getRawPackets()).toHaveLength(0);
  });
});
