import type { SupportedLocale } from './locales';
import type { LocaleTranslations } from './resources';

export type TranslationValidationIssue = {
  locale: SupportedLocale;
  key: string;
  reason: 'missing-key' | 'extra-key' | 'blank-value' | 'placeholder-mismatch';
  expected?: string[];
  actual?: string[];
};

type TranslationResources = Record<SupportedLocale, LocaleTranslations>;
type FlatTranslations = Map<string, string>;

function flattenTranslations(value: unknown, prefix = '', output: FlatTranslations = new Map()): FlatTranslations {
  if (typeof value === 'string') {
    output.set(prefix, value);
    return output;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return output;
  for (const [key, child] of Object.entries(value)) {
    flattenTranslations(child, prefix ? `${prefix}.${key}` : key, output);
  }
  return output;
}

export function translationPlaceholders(value: string): string[] {
  const placeholders = new Set<string>();
  const pattern = /{{\s*([\w.-]+)(?:\s*,[^}]+)?\s*}}/g;
  for (const match of value.matchAll(pattern)) placeholders.add(match[1]);
  return [...placeholders].sort();
}

function equalStrings(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function validateTranslations(
  resources: TranslationResources,
  referenceLocale: SupportedLocale = 'en',
): TranslationValidationIssue[] {
  const issues: TranslationValidationIssue[] = [];
  const reference = flattenTranslations(resources[referenceLocale]);

  for (const [locale, translation] of Object.entries(resources) as Array<[SupportedLocale, LocaleTranslations]>) {
    const current = flattenTranslations(translation);

    for (const [key, referenceValue] of reference) {
      const value = current.get(key);
      if (value === undefined) {
        issues.push({ locale, key, reason: 'missing-key' });
        continue;
      }
      if (value.trim().length === 0) issues.push({ locale, key, reason: 'blank-value' });
      const expected = translationPlaceholders(referenceValue);
      const actual = translationPlaceholders(value);
      if (!equalStrings(expected, actual)) {
        issues.push({ locale, key, reason: 'placeholder-mismatch', expected, actual });
      }
    }

    for (const key of current.keys()) {
      if (!reference.has(key)) issues.push({ locale, key, reason: 'extra-key' });
    }
  }

  return issues;
}
