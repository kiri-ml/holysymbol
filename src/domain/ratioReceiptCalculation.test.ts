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
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]).toMatchObject({
      startLevel: 120,
      startExpPercent: 25.5,
      endLevel: 121,
      endExpPercent: 10.2,
      ratio: 3.3,
    });
  });

  it('charges each EXP segment at its applicable tier ratio', () => {
    const tiered = { ...base, endLevel: 122, tiers: [{ minLevel: 121, expPerMesoRatio: 4 }] };
    const result = calculateRatioReceipt(tiered);
    expect(result.mesosDue).toBeGreaterThan(0);
    expect(result.mesosDue).not.toBeCloseTo(result.expGained / base.ratio);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]).toMatchObject({ endLevel: 121, endExpPercent: 0, ratio: 3.3 });
    expect(result.segments[1]).toMatchObject({ startLevel: 121, startExpPercent: 0, ratio: 4 });
    expect(result.segments.reduce((total, segment) => total + segment.expGained, 0)).toBeCloseTo(result.expGained);
    expect(result.segments.reduce((total, segment) => total + segment.mesosDue, 0)).toBeCloseTo(result.mesosDue!);
  });

  it('applies tiers at the start and ignores tiers at or after the end', () => {
    const result = calculateRatioReceipt({
      ...base,
      tiers: [
        { minLevel: 100, expPerMesoRatio: 3.5 },
        { minLevel: 121, expPerMesoRatio: 4 },
        { minLevel: 150, expPerMesoRatio: 5 },
      ],
      endLevel: 121,
      endExpPercent: 0,
    });
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]).toMatchObject({ ratio: 3.5, endLevel: 121, endExpPercent: 0 });
  });

  it('returns zero when progress has not advanced', () => {
    const result = calculateRatioReceipt({ ...base, endLevel: base.startLevel, endExpPercent: base.startExpPercent });
    expect(result).toEqual({ expGained: 0, mesosDue: 0, segments: [] });
  });

  it('clamps reversed progress to zero', () => {
    const result = calculateRatioReceipt({ ...base, endLevel: 119, endExpPercent: 99.99 });
    expect(result).toEqual({ expGained: 0, mesosDue: 0, segments: [] });
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
      ratio: 11.25,
    });
    expect(result.expGained).toBeGreaterThan(0);
    expect(result.mesosDue).toBeGreaterThan(0);
  });
});
