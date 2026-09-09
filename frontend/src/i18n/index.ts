import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  applyDocumentLanguage,
  getSavedLanguage,
} from '../utils/languagePreference';
import en from './locales/en.json';
import fr from './locales/fr.json';

function deepMerge(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const existing = out[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      out[key] = deepMerge(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function mergeSliceModules(
  base: Record<string, unknown>,
  modules: Record<string, unknown>
): Record<string, unknown> {
  let out = base;
  for (const mod of Object.values(modules)) {
    const overlay =
      mod && typeof mod === 'object' && 'default' in mod
        ? (mod as { default: Record<string, unknown> }).default
        : (mod as Record<string, unknown>);
    if (overlay && typeof overlay === 'object') {
      out = deepMerge(out, overlay);
    }
  }
  return out;
}

const enSlices = import.meta.glob('./locales/slices/*.en.json', { eager: true });
const frSlices = import.meta.glob('./locales/slices/*.fr.json', { eager: true });
const enMerged = mergeSliceModules(en as Record<string, unknown>, enSlices);
const frMerged = mergeSliceModules(fr as Record<string, unknown>, frSlices);

applyDocumentLanguage(getSavedLanguage());

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: frMerged },
      en: { translation: enMerged },
    },
    lng: getSavedLanguage(),
    fallbackLng: FALLBACK_LOCALE,
    supportedLngs: [DEFAULT_LOCALE, FALLBACK_LOCALE],
    interpolation: { escapeValue: false },
  })
  .then(() => {
    applyDocumentLanguage(i18n.language);
  });

i18n.on('languageChanged', (language) => {
  applyDocumentLanguage(language);
});

export default i18n;
