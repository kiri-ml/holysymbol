import { describe, expect, it } from 'vitest';
import type { RatioReceipt } from './ratioReceipt';
import { calculateRatioReceipt } from './ratioReceiptCalculation';

const base: RatioReceipt = {
  ign: 'Buyer123',
  startLevel: 120,
  startExpPercent: 25.5,
  endLevel: 121,
  endExpPercent: 10.2,
  ratio: 3.3,
  tiers: [],
};

describe('calculateRatioReceipt', () => {
  it('derives EXP gained and mesos due from the receipt inputs', () => {
    const result = calculateRatioReceipt(base);
    expect(result.expGained).toBeGreaterThan(0);
    expect(result.mesosDue).toBeCloseTo(result.expGained / base.ratio);
  });

  it('charges each EXP segment at its applicable tier ratio', () => {
    const tiered = { ...base, endLevel: 122, tiers: [{ minLevel: 121, expPerMesoRatio: 4 }] };
    const result = calculateRatioReceipt(tiered);
    expect(result.mesosDue).toBeGreaterThan(0);
    expect(result.mesosDue).not.toBeCloseTo(result.expGained / base.ratio);
  });

  it('returns zero when progress has not advanced', () => {
    const result = calculateRatioReceipt({ ...base, endLevel: base.startLevel, endExpPercent: base.startExpPercent });
    expect(result).toEqual({ expGained: 0, mesosDue: 0 });
  });

  it('clamps reversed progress to zero', () => {
    const result = calculateRatioReceipt({ ...base, endLevel: 119, endExpPercent: 99.99 });
    expect(result).toEqual({ expGained: 0, mesosDue: 0 });
  });

  it('does not calculate a charge for a zero ratio', () => {
    expect(calculateRatioReceipt({ ...base, ratio: 0 }).mesosDue).toBeUndefined();
  });

  it('supports the encoded field maxima', () => {
    const result = calculateRatioReceipt({
      ...base,
      startLevel: 1,
      startExpPercent: 0,
      endLevel: 200,
      endExpPercent: 99.99,
      ratio: 11.24,
    });
    expect(result.expGained).toBeGreaterThan(0);
    expect(result.mesosDue).toBeGreaterThan(0);
  });
});
