import { getStateKey } from './conversationState';

export const CONVERSATION_DRAFT_PREFIX = 'meshloom-conversation-draft:';

export function conversationDraftStorageKey(type: 'channel' | 'contact', id: string): string {
  return `${CONVERSATION_DRAFT_PREFIX}${getStateKey(type, id)}`;
}

export function loadConversationDraft(type: 'channel' | 'contact', id: string): string {
  try {
    return localStorage.getItem(conversationDraftStorageKey(type, id)) ?? '';
  } catch {
    return '';
  }
}

/** Persist a draft. An empty (or whitespace-only) draft deletes the key. */
export function saveConversationDraft(type: 'channel' | 'contact', id: string, text: string): void {
  const key = conversationDraftStorageKey(type, id);
  try {
    if (text.trim() === '') {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, text);
  } catch {
    // localStorage may be unavailable
  }
}
