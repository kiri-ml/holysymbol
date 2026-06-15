import { describe, expect, it } from 'vitest';
import { calculateBuyer, calculateEstimate, calculateInstance, endTimer, getBillableMs, pauseTimer, startTimer } from './calculator';
import { LEGENDS_EXP_TABLE, expGainedBetween, expToLevel, rawExpAt } from './expTable';
import type { CharacterSnapshot, LeechBuyer, LeechInstance, LeechTimer } from './types';

function snapshot(level: number, expPercent: number, capturedAt = '2026-06-09T00:00:00.000Z'): CharacterSnapshot {
  return {
    id: `snapshot-${level}-${expPercent}`,
    ign: 'Buyer',
    level,
    expPercent,
    capturedAt,
    source: 'manual',
  };
}

function buyer(start?: CharacterSnapshot, current?: CharacterSnapshot): LeechBuyer {
  return {
    id: 'buyer-test',
    ign: 'Buyer',
    start,
    current,
  };
}

function ratioInstance(testBuyer: LeechBuyer): LeechInstance {
  return {
    id: 'leech-test',
    name: 'Leech #1',
    billing: { type: 'ratio', expPerMesoRatio: 3.3 },
    buyers: [testBuyer],
    createdAt: '2026-06-09T00:00:00.000Z',
  };
}

describe('embedded MapleLegends EXP table', () => {
  it('contains selected rows from the embedded Legends reference table', () => {
    expect(expToLevel(1)).toBe(15);
    expect(expToLevel(2)).toBe(34);
    expect(expToLevel(3)).toBe(57);
    expect(expToLevel(6)).toBe(372);
    expect(expToLevel(10)).toBe(1_716);
    expect(expToLevel(50)).toBe(709_716);
    expect(expToLevel(51)).toBe(748_608);
    expect(expToLevel(100)).toBe(10_223_168);
    expect(expToLevel(150)).toBe(147_262_175);
    expect(expToLevel(199)).toBe(2_011_069_705);
    expect(expToLevel(200)).toBe(2_121_276_324);
  });

  it('contains accumulated EXP values matching Legends reference rows', () => {
    const rows = LEGENDS_EXP_TABLE;

    expect(rows).toHaveLength(200);
    expect(rows[0]).toEqual({ level: 1, expToLevel: 15, accumulatedExp: 0 });
    expect(rows[49]).toEqual({ level: 50, expToLevel: 709_716, accumulatedExp: 6_851_591 });
    expect(rows[99]).toEqual({ level: 100, expToLevel: 10_223_168, accumulatedExp: 180_455_178 });
    expect(rows[149]).toEqual({ level: 150, expToLevel: 147_262_175, accumulatedExp: 2_681_167_427 });
    expect(rows[198]).toEqual({ level: 199, expToLevel: 2_011_069_705, accumulatedExp: 36_692_254_111 });
    expect(rows[199]).toEqual({ level: 200, expToLevel: 2_121_276_324, accumulatedExp: 38_703_323_816 });
  });
});

describe('EXP and billing math', () => {
  it('calculates gained EXP across levels and percentages', () => {
    expect(expGainedBetween(1, 50, 2, 50)).toBe(24.5);
  });

  it('calculates ratio-priced buyer cost using EXP per meso', () => {
    const testBuyer = buyer(snapshot(50, 0), snapshot(51, 0, '2026-06-09T01:00:00.000Z'));
    const result = calculateBuyer(testBuyer, { type: 'ratio', expPerMesoRatio: 3.3 });

    expect(result.expGained).toBe(709_716);
    expect(result.ratioMesosDue).toBeCloseTo(709_716 / 3.3);
  });

  it('calculates instance totals', () => {
    const instance = ratioInstance(buyer(snapshot(50, 0), snapshot(51, 0)));
    const result = calculateInstance(instance);

    expect(result.completedBuyerCount).toBe(1);
    expect(result.totalExpGained).toBe(709_716);
    expect(result.totalMesosDue).toBeCloseTo(709_716 / 3.3);
  });

  it('estimates hourly cost from EPH and hourly rate', () => {
    const result = calculateEstimate({
      fromLevel: 50,
      fromExpPercent: 0,
      toLevel: 51,
      toExpPercent: 0,
      billingType: 'hourly',
      expPerMesoRatio: 3.3,
      hourlyRateMesos: 12_000_000,
      expPerHourMillions: 1.419432,
    });

    expect(result.expNeeded).toBe(709_716);
    expect(result.expectedDurationMs).toBeCloseTo(1_800_000);
    expect(result.hourlyMesosDue).toBeCloseTo(6_000_000);
  });

  it('uses explicit timer state for hourly billing', () => {
    const timer: LeechTimer = startTimer({ status: 'idle', accumulatedMs: 0 }, '2026-06-09T00:00:00.000Z');
    const paused = pauseTimer(timer, new Date('2026-06-09T01:00:00.000Z').getTime());
    expect(paused.accumulatedMs).toBe(3_600_000);

    const instance: LeechInstance = {
      id: 'hourly-test',
      name: 'Hourly',
      billing: {
        type: 'hourly',
        hourlyRateMesos: 12_000_000,
        expPerHourMillions: 35,
        timer: paused,
      },
      buyers: [buyer(snapshot(50, 0))],
      createdAt: '2026-06-09T00:00:00.000Z',
    };

    const result = calculateInstance(instance);
    expect(getBillableMs(paused)).toBe(3_600_000);
    expect(result.totalMesosDue).toBe(12_000_000);
  });

  it('does not make resumed hourly billing appear to go backward when the render clock is stale', () => {
    const resumed = startTimer(
      { status: 'paused', accumulatedMs: 3_600_000 },
      '2026-06-09T01:00:01.000Z',
    );
    const staleRenderNow = new Date('2026-06-09T01:00:00.500Z').getTime();

    expect(getBillableMs(resumed, staleRenderNow)).toBe(3_600_000);
  });

  it('splits hourly billing across started buyers', () => {
    const timer: LeechTimer = {
      status: 'paused',
      accumulatedMs: 3_600_000,
    };
    const buyers = [
      buyer(snapshot(50, 0)),
      { ...buyer(snapshot(51, 0)), id: 'buyer-test-2' },
    ];
    const instance: LeechInstance = {
      id: 'hourly-split-test',
      name: 'Hourly split',
      billing: {
        type: 'hourly',
        hourlyRateMesos: 12_000_000,
        expPerHourMillions: 35,
        timer,
      },
      buyers,
      createdAt: '2026-06-09T00:00:00.000Z',
    };

    const result = calculateInstance(instance);
    const buyerResult = calculateBuyer(buyers[0], instance.billing, Date.now(), buyers.length);

    expect(result.mesosPerBuyer).toBe(6_000_000);
    expect(result.totalMesosDue).toBe(12_000_000);
    expect(buyerResult.hourlyMesosDue).toBe(6_000_000);
  });

  it('ends a running timer by preserving elapsed time', () => {
    const timer = startTimer({ status: 'idle', accumulatedMs: 0 }, '2026-06-09T00:00:00.000Z');
    const ended = endTimer(timer, new Date('2026-06-09T02:00:00.000Z').getTime(), '2026-06-09T02:00:00.000Z');
    expect(ended.status).toBe('ended');
    expect(ended.accumulatedMs).toBe(7_200_000);
  });

  it('converts a level and percentage to raw accumulated EXP', () => {
    expect(rawExpAt(50, 50)).toBe(6_851_591 + 709_716 * 0.5);
  });
});
