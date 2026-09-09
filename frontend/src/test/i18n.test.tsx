import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { MessageInput } from '../components/MessageInput';
import i18n from '../i18n';
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LANGUAGE_STORAGE_KEY,
  applyDocumentLanguage,
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

  it('writes the active locale onto <html lang>', async () => {
    applyDocumentLanguage('fr');
    expect(document.documentElement.lang).toBe('fr');
    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    await i18n.changeLanguage('fr');
    expect(document.documentElement.lang).toBe('fr');
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
    expect(screen.getByRole('button', { name: i18n.t('chat.send') })).toBeInTheDocument();
  });

  it('keeps English and French catalogs on the same key set', () => {
    const flatten = (obj: unknown, prefix = ''): string[] => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return prefix ? [prefix] : [];
      }
      return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
        flatten(value, prefix ? `${prefix}.${key}` : key)
      );
    };
    const enKeys = new Set(flatten(i18n.getResourceBundle('en', 'translation')));
    const frKeys = new Set(flatten(i18n.getResourceBundle('fr', 'translation')));
    expect([...enKeys].filter((key) => !frKeys.has(key)).sort()).toEqual([]);
    expect([...frKeys].filter((key) => !enKeys.has(key)).sort()).toEqual([]);
  });
});
