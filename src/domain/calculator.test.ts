import { describe, expect, it } from 'vitest';
import {
  calculateBuyer,
  calculateEstimate,
  calculateInstance,
  getBillableMs,
  getBuyerBillableMs,
  pauseBuyerHourlyTimer,
  pauseTimer,
  startBuyerHourlyTimer,
  startTimer,
} from './calculator';
import { LEGENDS_EXP_TABLE, expGainedBetween, expToLevel, rawExpAt } from './expTable';
import { normalizeInstances } from './persistence';
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
    billing: { type: 'ratio', expPerMesoRatio: 3.3, tiers: [] },
    buyers: [testBuyer],
    createdAt: '2026-06-09T00:00:00.000Z',
  };
}

function hourlyBilling(timer: LeechTimer = { status: 'paused', accumulatedMs: 0 }) {
  return {
    type: 'hourly' as const,
    hourlyRateMesos: 12_000_000,
    expPerHourMillions: 35,
    timer,
  };
}

function hourlySession(startedAt: string, endedAt?: string) {
  return { startedAt, endedAt };
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
    const result = calculateBuyer(testBuyer, { type: 'ratio', expPerMesoRatio: 3.3, tiers: [] });

    expect(result.expGained).toBe(709_716);
    expect(result.ratioMesosDue).toBeCloseTo(709_716 / 3.3);
  });

  it('splits ratio pricing when a buyer crosses a level tier', () => {
    const testBuyer = buyer(snapshot(50, 50), snapshot(51, 50, '2026-06-09T01:00:00.000Z'));
    const result = calculateBuyer(testBuyer, {
      type: 'ratio',
      expPerMesoRatio: 3,
      tiers: [{ minLevel: 51, expPerMesoRatio: 4 }],
    });

    expect(result.ratioMesosDue).toBeCloseTo((709_716 * 0.5) / 3 + (748_608 * 0.5) / 4);
  });

  it('uses all crossed tiers and starts a tier at zero percent of its threshold level', () => {
    const testBuyer = buyer(snapshot(50, 0), snapshot(53, 0, '2026-06-09T01:00:00.000Z'));
    const result = calculateBuyer(testBuyer, {
      type: 'ratio',
      expPerMesoRatio: 3,
      tiers: [
        { minLevel: 52, expPerMesoRatio: 5 },
        { minLevel: 51, expPerMesoRatio: 4 },
      ],
    });

    expect(result.ratioMesosDue).toBeCloseTo(709_716 / 3 + 748_608 / 4 + 789_631 / 5);
  });

  it('uses the tier ratio for a partial level that starts exactly at its threshold', () => {
    const testBuyer = buyer(snapshot(51, 0), snapshot(51, 25, '2026-06-09T01:00:00.000Z'));
    const result = calculateBuyer(testBuyer, {
      type: 'ratio',
      expPerMesoRatio: 3,
      tiers: [{ minLevel: 51, expPerMesoRatio: 4 }],
    });

    expect(result.ratioMesosDue).toBeCloseTo((748_608 * 0.25) / 4);
  });

  it('does not charge negative EXP when the current snapshot precedes the start snapshot', () => {
    const testBuyer = buyer(snapshot(51, 0), snapshot(50, 0, '2026-06-09T01:00:00.000Z'));
    const result = calculateBuyer(testBuyer, {
      type: 'ratio',
      expPerMesoRatio: 3,
      tiers: [{ minLevel: 51, expPerMesoRatio: 4 }],
    });

    expect(result.expGained).toBe(0);
    expect(result.ratioMesosDue).toBe(0);
  });

  it('calculates instance totals', () => {
    const instance = ratioInstance(buyer(snapshot(50, 0), snapshot(51, 0)));
    const result = calculateInstance(instance);

    expect(result.doneBuyerCount).toBe(0);
    expect(result.totalExpGained).toBe(709_716);
    expect(result.totalMesosDue).toBeCloseTo(709_716 / 3.3);
  });

  it('counts locked populated buyers as done', () => {
    const populatedBuyer = { ...buyer(snapshot(50, 0), snapshot(51, 0)), locked: true };
    const emptyBuyer = { ...buyer(), id: 'empty-buyer', ign: '', locked: true };
    const result = calculateInstance({
      ...ratioInstance(populatedBuyer),
      buyers: [populatedBuyer, emptyBuyer],
    });

    expect(result.buyerCount).toBe(1);
    expect(result.doneBuyerCount).toBe(1);
  });

  it('sums tiered buyer dues instead of applying one ratio to aggregate EXP', () => {
    const instance: LeechInstance = {
      ...ratioInstance(buyer(snapshot(50, 0), snapshot(51, 0))),
      billing: {
        type: 'ratio',
        expPerMesoRatio: 3,
        tiers: [{ minLevel: 51, expPerMesoRatio: 4 }],
      },
      buyers: [
        { ...buyer(snapshot(50, 0), snapshot(51, 0)), id: 'buyer-one' },
        { ...buyer(snapshot(51, 0), snapshot(52, 0)), id: 'buyer-two' },
      ],
    };

    expect(calculateInstance(instance).totalMesosDue).toBeCloseTo(709_716 / 3 + 748_608 / 4);
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

  it('charges one active hourly buyer the full rate', () => {
    const instance: LeechInstance = {
      id: 'hourly-test',
      name: 'Hourly',
      billing: hourlyBilling({ status: 'idle', accumulatedMs: 0 }),
      buyers: [{
        ...buyer(snapshot(50, 0)),
        hourly: { sessions: [hourlySession('2026-06-09T00:00:00.000Z', '2026-06-09T01:00:00.000Z')] },
      }],
      createdAt: '2026-06-09T00:00:00.000Z',
    };

    const result = calculateInstance(instance);
    expect(result.billableMs).toBe(3_600_000);
    expect(result.totalMesosDue).toBe(12_000_000);
  });

  it('keeps run-level timer helpers available for display timing', () => {
    const timer: LeechTimer = startTimer({ status: 'idle', accumulatedMs: 0 }, '2026-06-09T00:00:00.000Z');
    const paused = pauseTimer(timer, new Date('2026-06-09T01:00:00.000Z').getTime());
    expect(getBillableMs(paused)).toBe(3_600_000);
  });

  it('does not make resumed run timer display appear to go backward when the render clock is stale', () => {
    const resumed = startTimer({ status: 'paused', accumulatedMs: 3_600_000 }, '2026-06-09T01:00:01.000Z');
    const staleRenderNow = new Date('2026-06-09T01:00:00.500Z').getTime();

    expect(getBillableMs(resumed, staleRenderNow)).toBe(3_600_000);
  });

  it('splits fully overlapping hourly buyers evenly', () => {
    const buyers = [
      {
        ...buyer(snapshot(50, 0)),
        hourly: { sessions: [hourlySession('2026-06-09T00:00:00.000Z', '2026-06-09T01:00:00.000Z')] },
      },
      {
        ...buyer(snapshot(51, 0)),
        id: 'buyer-test-2',
        hourly: { sessions: [hourlySession('2026-06-09T00:00:00.000Z', '2026-06-09T01:00:00.000Z')] },
      },
    ];
    const instance: LeechInstance = {
      id: 'hourly-different-duration-test',
      name: 'Hourly different durations',
      billing: hourlyBilling({ status: 'paused', accumulatedMs: 3_600_000 }),
      buyers,
      createdAt: '2026-06-09T00:00:00.000Z',
    };

    const now = new Date('2026-06-09T01:00:00.000Z').getTime();
    const result = calculateInstance(instance);
    const firstBuyer = calculateBuyer(buyers[0], instance.billing, now, buyers);
    const secondBuyer = calculateBuyer(buyers[1], instance.billing, now, buyers);

    expect(getBuyerBillableMs(buyers[0])).toBe(3_600_000);
    expect(getBuyerBillableMs(buyers[1])).toBe(3_600_000);
    expect(firstBuyer.hourlyMesosDue).toBe(6_000_000);
    expect(secondBuyer.hourlyMesosDue).toBe(6_000_000);
    expect(result.totalMesosDue).toBe(12_000_000);
  });

  it('weights hourly split billing for a late join', () => {
    const buyers = [
      {
        ...buyer(snapshot(50, 0)),
        hourly: { sessions: [hourlySession('2026-06-09T00:00:00.000Z', '2026-06-09T01:00:00.000Z')] },
      },
      {
        ...buyer(snapshot(51, 0)),
        id: 'buyer-test-2',
        hourly: { sessions: [hourlySession('2026-06-09T00:30:00.000Z', '2026-06-09T01:00:00.000Z')] },
      },
    ];
    const billing = hourlyBilling({ status: 'running', accumulatedMs: 0 });
    const now = new Date('2026-06-09T01:00:00.000Z').getTime();

    const firstBuyer = calculateBuyer(buyers[0], billing, now, buyers);
    const secondBuyer = calculateBuyer(buyers[1], billing, now, buyers);

    expect(firstBuyer.hourlyMesosDue).toBe(9_000_000);
    expect(secondBuyer.hourlyMesosDue).toBe(3_000_000);
  });

  it('lock closes the buyer hourly session and stops charging them', () => {
    const testBuyer = {
      ...buyer(snapshot(50, 0)),
      hourly: { sessions: [hourlySession('2026-06-09T00:00:00.000Z')] },
    };
    const locked = pauseBuyerHourlyTimer(testBuyer, new Date('2026-06-09T00:30:00.000Z').getTime());
    const now = new Date('2026-06-09T01:00:00.000Z').getTime();
    const result = calculateBuyer(locked, hourlyBilling({ status: 'running', accumulatedMs: 0 }), now, [locked]);

    expect(getBuyerBillableMs(locked, now)).toBe(1_800_000);
    expect(result.hourlyMesosDue).toBe(6_000_000);
  });

  it('unlock during a running global timer closes an open session, then opens a new one', () => {
    const unlocked = startBuyerHourlyTimer({
      ...buyer(snapshot(50, 0)),
      hourly: {
        sessions: [hourlySession('2026-06-09T00:00:00.000Z')],
      },
    }, '2026-06-09T00:30:00.000Z');

    expect(unlocked.hourly?.sessions).toEqual([
      { startedAt: '2026-06-09T00:00:00.000Z', endedAt: '2026-06-09T00:30:00.000Z' },
      { startedAt: '2026-06-09T00:30:00.000Z' },
    ]);
  });

  it('includes elapsed time from open buyer sessions up to now', () => {
    const testBuyer = {
      ...buyer(snapshot(50, 0)),
      hourly: {
        sessions: [
          hourlySession('2026-06-09T00:00:00.000Z', '2026-06-09T00:30:00.000Z'),
          hourlySession('2026-06-09T01:00:00.000Z'),
        ],
      },
    };
    const now = new Date('2026-06-09T01:30:00.000Z').getTime();
    const result = calculateBuyer(testBuyer, hourlyBilling({ status: 'running', accumulatedMs: 0 }), now, [testBuyer]);

    expect(getBuyerBillableMs(testBuyer, now)).toBe(3_600_000);
    expect(result.hourlyMesosDue).toBe(12_000_000);
  });

  it('normalizes old or missing hourly buyer state to empty sessions', () => {
    const normalized = normalizeInstances([
      {
        id: 'old-hourly',
        name: 'Old hourly',
        billing: hourlyBilling({ status: 'paused', accumulatedMs: 3_600_000 }),
        buyers: [
          buyer(snapshot(50, 0)),
          { ...buyer(snapshot(51, 0)), id: 'buyer-test-2', hourly: { accumulatedMs: 3_600_000, runningSince: '2026-06-09T00:00:00.000Z' } },
        ],
        createdAt: '2026-06-09T00:00:00.000Z',
      },
    ], []);

    expect(normalized[0].buyers[0].hourly).toEqual({ sessions: [] });
    expect(normalized[0].buyers[1].hourly).toEqual({ sessions: [] });
  });

  it('normalizes legacy and malformed ratio tier data', () => {
    const normalized = normalizeInstances([{
      id: 'ratio-tier-normalization',
      name: 'Ratio tiers',
      billing: {
        type: 'ratio',
        expPerMesoRatio: 3.3,
        tiers: [
          { minLevel: 120, expPerMesoRatio: 4 },
          { minLevel: 80.4, expPerMesoRatio: 3.5 },
          { minLevel: 120, expPerMesoRatio: 4.2 },
          { minLevel: 'invalid', expPerMesoRatio: 5 },
        ],
      },
      buyers: [],
      createdAt: '2026-06-09T00:00:00.000Z',
    }, {
      id: 'legacy-ratio',
      name: 'Legacy ratio',
      billing: { type: 'ratio', expPerMesoRatio: 3.3 },
      buyers: [],
      createdAt: '2026-06-09T00:00:00.000Z',
    }], []);

    expect(normalized[0].billing).toEqual({
      type: 'ratio',
      expPerMesoRatio: 3.3,
      tiers: [
        { minLevel: 80, expPerMesoRatio: 3.5 },
        { minLevel: 120, expPerMesoRatio: 4.2 },
      ],
    });
    expect(normalized[1].billing).toEqual({ type: 'ratio', expPerMesoRatio: 3.3, tiers: [] });
  });

  it('converts a level and percentage to raw accumulated EXP', () => {
    expect(rawExpAt(50, 50)).toBe(6_851_591 + 709_716 * 0.5);
  });
});
