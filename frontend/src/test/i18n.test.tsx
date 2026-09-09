import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MessageInput } from '../components/MessageInput';
import i18n from '../i18n';
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LANGUAGE_STORAGE_KEY,
  getSavedLanguage,
  setSavedLanguage,
} from '../utils/languagePreference';

/**
 * Pattern: import the shared i18n instance (also loaded from `test/setup.ts`)
 * and query roles/text via `i18n.t('key')`. Default locale is `fr`; `en` is fallback.
 */
describe('i18n', () => {
  afterEach(async () => {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    await i18n.changeLanguage(DEFAULT_LOCALE);
  });

  it('defaults to French when no preference is stored', () => {
    expect(DEFAULT_LOCALE).toBe('fr');
    expect(FALLBACK_LOCALE).toBe('en');
    expect(getSavedLanguage()).toBe('fr');
  });

  it('persists the language preference', () => {
    setSavedLanguage('en');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(getSavedLanguage()).toBe('en');
  });

  it('exposes French chat labels by default', () => {
    expect(i18n.t('chat.send')).toBe('Envoyer');
    expect(i18n.t('sidebar.collapse')).toBe('Réduire la barre latérale');
  });

  it('falls back to English JSON when switched', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('chat.send')).toBe('Send');
    expect(i18n.t('path.unknown')).toBe('<UNKNOWN>');
  });

  it('renders the Send button from the active locale', async () => {
    render(<MessageInput onSend={async () => {}} disabled={false} conversationType="contact" />);
    expect(screen.getByRole('button', { name: i18n.t('chat.send') })).toBeInTheDocument();

    await i18n.changeLanguage('en');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hi' } });
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });
});
