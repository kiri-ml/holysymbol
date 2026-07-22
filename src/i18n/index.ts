import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALE_CODES, type SupportedLocale } from './locales';
import { i18nResources, translations } from './resources';
import { validateTranslations } from './validation';

const LANGUAGE_STORAGE_KEY = 'holy-symbol.language.v1';

if (import.meta.env.DEV) {
  const issues = validateTranslations(translations);
  if (issues.length > 0) {
    throw new Error(`Invalid translation resources: ${JSON.stringify(issues)}`);
  }
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: i18nResources,
    supportedLngs: SUPPORTED_LOCALE_CODES,
    fallbackLng: DEFAULT_LOCALE,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: [],
    },
    interpolation: {
      escapeValue: false,
    },
  });

function setLanguagePreference(language: SupportedLocale) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Local storage can fail in private windows or quota-limited contexts.
  }

  return i18n.changeLanguage(language);
}

export { i18n, setLanguagePreference };
