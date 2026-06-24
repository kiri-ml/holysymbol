export const SUPPORTED_LOCALES = [
  {
    code: 'en',
    label: 'English',
  },
  {
    code: 'zh-Hans',
    label: '简体中文',
  },
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]['code'];
