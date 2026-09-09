import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LOCALE, FALLBACK_LOCALE, getSavedLanguage } from '../utils/languagePreference';
import en from './locales/en.json';
import fr from './locales/fr.json';

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: getSavedLanguage(),
  fallbackLng: FALLBACK_LOCALE,
  supportedLngs: [DEFAULT_LOCALE, FALLBACK_LOCALE],
  interpolation: { escapeValue: false },
});

export default i18n;
