import type { SupportedLocale } from '../locales';
import { de } from './de';
import { en, type LocaleTranslations } from './en';
import { es } from './es';
import { fr } from './fr';
import { ja } from './ja';
import { ko } from './ko';
import { nl } from './nl';
import { ptBR } from './pt-BR';
import { zhHans } from './zh-Hans';
import { zhHant } from './zh-Hant';

export const translations = {
  en,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  ko,
  ja,
  es,
  de,
  fr,
  'pt-BR': ptBR,
  nl,
} satisfies Record<SupportedLocale, LocaleTranslations>;

export const i18nResources = Object.fromEntries(
  Object.entries(translations).map(([locale, translation]) => [locale, { translation }]),
) as Record<SupportedLocale, { translation: LocaleTranslations }>;

export { en } from './en';
export type { LocaleTranslations } from './en';
