import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALE_CODES } from './locales';
import { translations } from './resources';
import { translationPlaceholders, validateTranslations } from './validation';

describe('translation resources', () => {
  it('defines exactly one resource for every supported locale', () => {
    expect(Object.keys(translations).sort()).toEqual([...SUPPORTED_LOCALE_CODES].sort());
  });

  it('matches the English key and interpolation contract', () => {
    expect(validateTranslations(translations)).toEqual([]);
  });

  it('extracts unique sorted interpolation placeholders', () => {
    expect(translationPlaceholders('Delete {{ name }} from {{run}} and {{name}}?')).toEqual(['name', 'run']);
  });
});
