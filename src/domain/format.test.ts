import { describe, expect, it } from 'vitest';
import { formatMonogram, formatRatioRange } from './format';

describe('ratio range formatting', () => {
  it('formats an equal minimum and maximum as one ratio', () => {
    expect(formatRatioRange(3.3, 3.3)).toBe('1 : 3.3');
  });

  it('formats different bounds as a compact ratio range', () => {
    expect(formatRatioRange(3.3, 5.5)).toBe('1 : 3.3~5.5');
  });
});

describe('monogram formatting', () => {
  it('ignores whitespace and preserves narrow characters and punctuation', () => {
    expect(formatMonogram('a dog')).toBe('adog');
    expect(formatMonogram('[click')).toBe('[cli');
  });

  it('counts wide characters and emoji as two columns', () => {
    expect(formatMonogram('中文测试')).toBe('中文');
    expect(formatMonogram('🙂ab')).toBe('🙂ab');
    expect(formatMonogram('中文测试', 6)).toBe('中文测');
  });

  it('keeps accented graphemes intact', () => {
    expect(formatMonogram('e\u0301cole')).toBe('e\u0301col');
  });

  it('uses a dash when no visible label remains', () => {
    expect(formatMonogram('   ')).toBe('—');
  });
});
