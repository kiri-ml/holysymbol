import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { SUPPORTED_LOCALES, type SupportedLocale } from './locales';
import { en } from './resources/en';
import { zh } from './resources/zh';

const LANGUAGE_STORAGE_KEY = 'holy-symbol.language.v1';

type TranslationShape<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : TranslationShape<T[K]>;
};

const resources = {
  en: {
    translation: en,
  },
  'zh-Hans': {
    translation: zh,
  },
} satisfies Record<SupportedLocale, { translation: TranslationShape<typeof en> }>;

function storedLanguage() {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (SUPPORTED_LOCALES.some((locale) => locale.code === stored)) return stored as SupportedLocale;
  } catch {
    // Local storage can fail in private windows or quota-limited contexts.
  }

  return 'en';
}

void i18n.use(initReactI18next).init({
  resources,
  lng: storedLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

i18n.on('languageChanged', (language) => {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Local storage can fail in private windows or quota-limited contexts.
  }
});

export { i18n };
