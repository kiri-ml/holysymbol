import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALE_CODES, type SupportedLocale } from './locales';
import { de } from './resources/de';
import { en, type LocaleTranslations } from './resources/en';
import { es } from './resources/es';
import { fr } from './resources/fr';
import { ja } from './resources/ja';
import { ko } from './resources/ko';
import { nl } from './resources/nl';
import { ptBR } from './resources/pt-BR';
import { zhHans } from './resources/zh-Hans';
import { zhHant } from './resources/zh-Hant';

const LANGUAGE_STORAGE_KEY = 'holy-symbol.language.v1';

const resources = {
  en: {
    translation: en,
  },
  'zh-Hans': {
    translation: zhHans,
  },
  'zh-Hant': {
    translation: zhHant,
  },
  ko: {
    translation: ko,
  },
  ja: {
    translation: ja,
  },
  es: {
    translation: es,
  },
  de: {
    translation: de,
  },
  fr: {
    translation: fr,
  },
  'pt-BR': {
    translation: ptBR,
  },
  nl: {
    translation: nl,
  },
} satisfies Record<SupportedLocale, { translation: LocaleTranslations }>;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
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
