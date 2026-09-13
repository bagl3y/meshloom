import { conversationMessageCache } from '../hooks/useConversationMessages';
import { resetRawPacketStore } from '../stores/rawPacketStore';
import { CONVERSATION_DRAFT_PREFIX } from './conversationDrafts';
import { LAST_VIEWED_CONVERSATION_KEY, getLastViewedConversation } from './lastViewedConversation';

function isContactScopedKey(key: string): boolean {
  return key.includes('contact-');
}

/** Clear contact-scoped client state after adopting a new radio identity. */
export function resetClientStateAfterIdentityAdopt(): void {
  conversationMessageCache.clear();
  resetRawPacketStore();

  try {
    const last = getLastViewedConversation();
    if (last?.type === 'contact') {
      localStorage.removeItem(LAST_VIEWED_CONVERSATION_KEY);
    }
  } catch {
    // localStorage may be unavailable
  }

  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (key.startsWith(CONVERSATION_DRAFT_PREFIX) && isContactScopedKey(key)) {
        keysToRemove.push(key);
      }
      if (key.includes('-server-password:') && isContactScopedKey(key)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage may be unavailable
  }

  // Push conversation prefs live on the server; no localStorage cleanup here.
}
