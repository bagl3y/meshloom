// Browser-local UI language. Default French on this fork; English is fallback.

export const LANGUAGE_STORAGE_KEY = 'remoteterm-language';

export const APP_LANGUAGES = ['fr', 'en'] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];

export const DEFAULT_LOCALE: AppLanguage = 'fr';
export const FALLBACK_LOCALE: AppLanguage = 'en';

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === 'fr' || value === 'en';
}

export function getSavedLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isAppLanguage(stored)) return stored;
  } catch {
    // localStorage may be unavailable
  }
  return DEFAULT_LOCALE;
}

export function setSavedLanguage(language: AppLanguage): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // localStorage may be unavailable
  }
}

export function applyDocumentLanguage(language: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.lang = isAppLanguage(language) ? language : DEFAULT_LOCALE;
}
