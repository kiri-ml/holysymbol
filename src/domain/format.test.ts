import { describe, expect, it } from 'vitest';
import { formatRatioRange } from './format';

describe('ratio range formatting', () => {
  it('formats an equal minimum and maximum as one ratio', () => {
    expect(formatRatioRange(3.3, 3.3)).toBe('1 : 3.3');
  });

  it('formats different bounds as a compact ratio range', () => {
    expect(formatRatioRange(3.3, 5.5)).toBe('1 : 3.3~5.5');
  });
});
