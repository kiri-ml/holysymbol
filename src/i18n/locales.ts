export const SUPPORTED_LOCALES = [
  {
    code: 'en',
    label: 'English',
  },
  {
    code: 'zh-Hans',
    label: '简体中文',
  },
  {
    code: 'zh-Hant',
    label: '繁體中文',
  },
  {
    code: 'ko',
    label: '한국어',
  },
  {
    code: 'ja',
    label: '日本語',
  },
  {
    code: 'es',
    label: 'Español',
  },
  {
    code: 'de',
    label: 'Deutsch',
  },
  {
    code: 'fr',
    label: 'Français',
  },
  {
    code: 'pt-BR',
    label: 'Português',
  },
  {
    code: 'nl',
    label: 'Nederlands',
  },
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]['code'];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const SUPPORTED_LOCALE_CODES = SUPPORTED_LOCALES.map((locale) => locale.code);

export function isSupportedLocale(language: string): language is SupportedLocale {
  return SUPPORTED_LOCALE_CODES.includes(language as SupportedLocale);
}
