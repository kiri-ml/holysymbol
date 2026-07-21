import { describe, expect, it } from 'vitest';
import {
  calculateBuyer,
  calculateEstimate,
  calculateInstance,
  getBillableMs,
  getBuyerBillableMs,
  pauseHourlyBilling,
  removeHourlyAccount,
  setHourlyAccountActive,
  startHourlyBilling,
} from './calculator';
import { LEGENDS_EXP_TABLE, expGainedBetween, expToLevel, rawExpAt } from './expTable';
import { encodeInstances, migrateV5Instances, normalizeInstances } from './persistence';
import type { CharacterSnapshot, HourlyBilling, HourlyLedger, LeechBuyer, LeechInstance } from './types';

function snapshot(level: number, expPercent: number, capturedAt = '2026-06-09T00:00:00.000Z'): CharacterSnapshot {
  return {
    ign: 'Buyer',
    level,
    expPercent,
    capturedAt,
    source: 'manual',
  };
}

function buyer(start?: CharacterSnapshot, current?: CharacterSnapshot): LeechBuyer {
  return {
    id: 0,
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
    nextBuyerId: 1,
    createdAt: '2026-06-09T00:00:00.000Z',
  };
}

function hourlyBilling(ledger: HourlyLedger = { status: 'paused', accumulatedMs: 0, accounts: {} }): HourlyBilling {
  return {
    type: 'hourly' as const,
    hourlyRateMesos: 12_000_000,
    ledger,
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
    const emptyBuyer = { ...buyer(), id: 1, ign: '', locked: true };
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
        { ...buyer(snapshot(50, 0), snapshot(51, 0)), id: 1 },
        { ...buyer(snapshot(51, 0), snapshot(52, 0)), id: 2 },
      ],
      nextBuyerId: 3,
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

  it('splits running time and checkpoints a late join', () => {
    const start = Date.UTC(2026, 5, 9, 0, 0);
    let billing = startHourlyBilling(hourlyBilling(), [0], start);
    billing = setHourlyAccountActive(billing, 1, true, start + 1_800_000);

    expect(getBuyerBillableMs(billing, 0, start + 3_600_000)).toBe(2_700_000);
    expect(getBuyerBillableMs(billing, 1, start + 3_600_000)).toBe(900_000);
    expect(getBillableMs(billing.ledger, start + 3_600_000)).toBe(3_600_000);
  });

  it('pauses by finalizing shares and stops live projection', () => {
    const start = Date.UTC(2026, 5, 9, 0, 0);
    const running = startHourlyBilling(hourlyBilling(), [0], start);
    const paused = pauseHourlyBilling(running, start + 3_600_000);

    expect(paused.ledger.status).toBe('paused');
    expect(paused.ledger.checkpointAt).toBeUndefined();
    expect(getBuyerBillableMs(paused, 0, start + 7_200_000)).toBe(3_600_000);
  });

  it('deletes one account without redistributing remaining accrued time', () => {
    const start = Date.UTC(2026, 5, 9, 0, 0);
    const running = startHourlyBilling(hourlyBilling(), [0, 1], start);
    const beforeDelete = getBuyerBillableMs(running, 0, start + 3_600_000);
    const deleted = removeHourlyAccount(running, 1, start + 3_600_000);

    expect(getBuyerBillableMs(deleted, 0, start + 3_600_000)).toBe(beforeDelete);
    expect(deleted.ledger.accounts[1]).toBeUndefined();
    expect(getBuyerBillableMs(deleted, 0, start + 5_400_000)).toBe(3_600_000);
  });

  it('calculates due from accrued and live ledger milliseconds at the current rate', () => {
    const testBuyer = buyer(snapshot(50, 0));
    const billing = hourlyBilling({
      status: 'running',
      accumulatedMs: 1_800_000,
      checkpointAt: 1_000,
      accounts: { [testBuyer.id]: { accruedMs: 1_800_000, active: true } },
    });
    const result = calculateBuyer(testBuyer, billing, 1_801_000);

    expect(result.hourlyMesosDue).toBe(12_000_000);
  });

  it('migrates v5 overlapping sessions into stable ledger shares', () => {
    const now = Date.parse('2026-06-09T01:00:00.000Z');
    const migrated = migrateV5Instances([{
      id: 'legacy',
      name: 'Legacy',
      billing: {
        type: 'hourly',
        hourlyRateMesos: 12_000_000,
        timer: { status: 'running', accumulatedMs: 0, lastStartedAt: '2026-06-09T00:00:00.000Z' },
      },
      buyers: [
        { ...buyer(snapshot(50, 0)), id: 'buyer-test', hourly: { sessions: [{ startedAt: '2026-06-09T00:00:00.000Z' }] } },
        { ...buyer(snapshot(51, 0)), id: 'buyer-test-2', hourly: { sessions: [{ startedAt: '2026-06-09T00:30:00.000Z' }] } },
      ],
      createdAt: '2026-06-09T00:00:00.000Z',
    }], [], now);
    const billing = migrated[0].billing as HourlyBilling;

    expect(billing.ledger.accounts[0].accruedMs).toBe(2_700_000);
    expect(billing.ledger.accounts[1].accruedMs).toBe(900_000);
    expect(migrated[0].buyers.map((item) => item.id)).toEqual([0, 1]);
    expect(migrated[0].nextBuyerId).toBe(2);
    expect(billing.ledger.checkpointAt).toBe(now);
    expect(migrated[0].buyers[0]).not.toHaveProperty('hourly');
  });

  it('normalizes compact v6 ledgers', () => {
    const normalized = normalizeInstances([{
      i: 'v6', n: 'V6', b: { t: 'h', r: 12_000_000, l: { s: 'r', t: 500, c: 1_000, a: { 0: { m: 250, r: 1 } } } },
      u: [{ i: 0, n: 'Buyer' }], d: 1, c: Date.parse('2026-06-09T00:00:00.000Z'),
    }], []);

    expect(normalized[0].billing).toEqual(hourlyBilling({
      status: 'running', accumulatedMs: 500, checkpointAt: 1_000, accounts: { 0: { accruedMs: 250, active: true } },
    }));
  });

  it('preserves the numeric high-water mark and discards invalid buyer ids', () => {
    const normalized = normalizeInstances([{
      i: 'numeric-v6', n: 'Numeric V6', b: { t: 'r', r: 3.3 },
      u: [{ i: 2, n: 'First' }, { i: 2, n: 'Duplicate' }, { i: -1, n: 'Invalid' }],
      d: 10, c: Date.parse('2026-06-09T00:00:00.000Z'),
    }], []);

    expect(normalized[0].buyers.map((item) => item.id)).toEqual([2]);
    expect(normalized[0].nextBuyerId).toBe(10);
  });

  it('encodes hourly ledgers with compact keys and omits inactive flags', () => {
    const encoded = encodeInstances([{
      id: 'v6',
      name: 'V6',
      billing: hourlyBilling({
        status: 'running',
        accumulatedMs: 500,
        checkpointAt: 1_000,
        accounts: { 0: { accruedMs: 250, active: true }, 1: { accruedMs: 100, active: false } },
      }),
      buyers: [],
      nextBuyerId: 2,
      createdAt: '2026-06-09T00:00:00.000Z',
    }]) as Array<{ b: unknown }>;

    expect(encoded[0].b).toEqual({
      t: 'h',
      r: 12_000_000,
      l: { s: 'r', t: 500, c: 1_000, a: { 0: { m: 250, r: 1 }, 1: { m: 100 } } },
    });
  });

  it('encodes snapshots as tuples and hoists latest-known metadata onto the buyer', () => {
    const encoded = encodeInstances([{
      id: 'snapshot-tuples',
      name: 'Snapshot tuples',
      billing: { type: 'ratio', expPerMesoRatio: 3.3, tiers: [] },
      buyers: [{
        id: 0,
        ign: 'Buyer',
        start: {
          ign: 'Buyer', level: 120, expPercent: 10, job: 'Bishop', guild: 'OldGuild', fame: 10,
          capturedAt: '2026-06-09T00:00:00.123Z', source: 'api',
        },
        current: {
          ign: 'Buyer', level: 121, expPercent: 20, guild: 'NewGuild',
          capturedAt: '2026-06-09T01:00:00.456Z', source: 'manual',
        },
      }],
      nextBuyerId: 1,
      createdAt: '2026-06-09T00:00:00.000Z',
    }]) as Array<{ u: Array<Record<string, unknown>> }>;
    const storedBuyer = encoded[0].u[0];
    const decodedBuyer = normalizeInstances(encoded, [])[0].buyers[0];

    expect(storedBuyer).toMatchObject({
      i: 0, n: 'Buyer', j: 'Bishop', g: 'NewGuild',
      s: [120, 10, 0, 0],
      c: [121, 20, 3_600, 1],
    });
    expect(JSON.stringify(storedBuyer)).not.toContain('snapshot_');
    const legacyObjectBuyer = {
      i: 0, n: 'Buyer',
      s: { i: 'snapshot_550e8400-e29b-41d4-a716-446655440000', n: 'Buyer', l: 120, e: 10, j: 'Bishop', g: 'OldGuild', f: 10, t: Date.parse('2026-06-09T00:00:00.123Z'), s: 'a' },
      c: { i: 'snapshot_550e8400-e29b-41d4-a716-446655440000', n: 'Buyer', l: 121, e: 20, g: 'NewGuild', t: Date.parse('2026-06-09T01:00:00.456Z'), s: 'm' },
    };
    expect(JSON.stringify(storedBuyer).length).toBeLessThan(JSON.stringify(legacyObjectBuyer).length);
    expect(storedBuyer).not.toHaveProperty('f');
    expect(decodedBuyer.start).toMatchObject({ ign: 'Buyer', source: 'api' });
    expect(decodedBuyer.start).not.toMatchObject({ job: 'Bishop', guild: 'NewGuild' });
    expect(decodedBuyer.current).toMatchObject({ ign: 'Buyer', job: 'Bishop', guild: 'NewGuild', source: 'manual' });
    expect(decodedBuyer.current).not.toHaveProperty('fame', 10);
  });

  it('round-trips the complete compact v6 payload with epoch timestamps', () => {
    const start = {
      ign: 'SameIGN', level: 120, expPercent: 12.5,
      job: 'Bishop', guild: 'Guild', fame: 42,
      capturedAt: '2026-06-09T00:00:00.123Z', source: 'api' as const,
    };
    const original: LeechInstance = {
      id: 'run-id',
      name: 'Compact run',
      billing: { type: 'ratio', expPerMesoRatio: 3.3, tiers: [{ minLevel: 120, expPerMesoRatio: 4.2 }] },
      inactiveBilling: {
        ratio: { type: 'ratio', expPerMesoRatio: 3.3, tiers: [{ minLevel: 120, expPerMesoRatio: 4.2 }] },
        hourly: hourlyBilling({ status: 'paused', accumulatedMs: 500, accounts: { 0: { accruedMs: 250, active: false } } }),
      },
      buyers: [{ id: 0, ign: 'SameIGN', locked: true, start, current: { ...start, source: 'manual' } }],
      nextBuyerId: 1,
      createdAt: '2026-06-09T00:00:00.456Z',
      lastCurrentRefreshedAt: '2026-06-09T01:00:00.789Z',
    };
    const encoded = encodeInstances([original]) as Array<Record<string, unknown>>;
    const decoded = normalizeInstances(encoded, []);

    expect(Object.keys(encoded[0]).sort()).toEqual(['b', 'c', 'd', 'i', 'n', 'r', 'u', 'x']);
    expect(encoded[0].c).toBe(Math.floor(Date.parse(original.createdAt) / 1000));
    expect(encoded[0].r).toBe(3_600);
    expect(JSON.stringify(encoded).length).toBeLessThan(JSON.stringify([original]).length);
    expect(decoded[0]).toMatchObject({
      ...original,
      buyers: [{
        id: 0,
        ign: 'SameIGN',
        locked: true,
        start: {
          ign: 'SameIGN', level: 120, expPercent: 12.5,
          capturedAt: '2026-06-09T00:00:00.000Z', source: 'api',
          job: undefined, guild: undefined,
        },
        current: {
          ign: 'SameIGN', level: 120, expPercent: 12.5,
          capturedAt: '2026-06-09T00:00:00.000Z', source: 'manual',
          job: 'Bishop', guild: 'Guild',
        },
      }],
      createdAt: '2026-06-09T00:00:00.000Z',
      lastCurrentRefreshedAt: '2026-06-09T01:00:00.000Z',
    });
    expect(decoded[0].buyers[0].start).not.toHaveProperty('fame');
    expect(decoded[0].buyers[0].current).not.toHaveProperty('fame');
  });

  it('normalizes legacy and malformed ratio tier data', () => {
    const normalized = normalizeInstances([{
      i: 'ratio-tier-normalization', n: 'Ratio tiers',
      b: { t: 'r', r: 3.3, q: [[120, 4], [80.4, 3.5], [120, 4.2], ['invalid', 5]] },
      u: [], d: 0, c: 0,
    }, {
      i: 'ratio', n: 'Ratio', b: { t: 'r', r: 3.3 }, u: [], d: 0, c: 0,
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
