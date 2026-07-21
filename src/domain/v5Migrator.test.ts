import { describe, expect, it } from 'vitest';
import { migrateV5Instances } from './v5Migrator';
import type { HourlyBilling } from './types';

describe('v5 migrator', () => {
  it('preserves an explicitly empty dataset and rejects invalid non-array data', () => {
    expect(migrateV5Instances([], 0)).toEqual([]);
    expect(migrateV5Instances(null, 0)).toBeUndefined();
    expect(migrateV5Instances([null, 'bad'], 0)).toBeUndefined();
  });

  it('maps UUID buyers and allocates overlapping sessions at one captured time', () => {
    const now = Date.parse('2026-06-09T01:00:00.000Z');
    const migrated = migrateV5Instances([{
      id: 'legacy', name: 'Legacy', createdAt: 'invalid',
      billing: { type: 'hourly', hourlyRateMesos: 12, timer: { status: 'running', accumulatedMs: 0, lastStartedAt: '2026-06-09T00:00:00.000Z' } },
      buyers: [
        { id: 'uuid-a', ign: 'A', start: { id: 'ignored', ign: 'A', level: 120, expPercent: 0, capturedAt: '2026-06-09T00:00:00.000Z', source: 'manual' }, hourly: { sessions: [{ startedAt: '2026-06-09T00:00:00.000Z' }] } },
        { id: 'uuid-b', ign: 'B', start: { level: 120 }, hourly: { sessions: [{ startedAt: '2026-06-09T00:30:00.000Z' }, { startedAt: 'bad' }] } },
      ],
    }], now)!;
    const billing = migrated[0].billing as HourlyBilling;
    expect(migrated[0].buyers.map((buyer) => buyer.id)).toEqual([0, 1]);
    expect(migrated[0].createdAt).toBe(new Date(now).toISOString());
    expect(billing.ledger.accounts[0].accruedMs).toBe(2_700_000);
    expect(billing.ledger.accounts[1].accruedMs).toBe(900_000);
    expect(billing.ledger.checkpointAt).toBe(now);
  });

  it('normalizes ratio runs and never runs inactive hourly billing', () => {
    const migrated = migrateV5Instances([{
      id: 'ratio', name: 'Ratio', billing: { type: 'ratio', expPerMesoRatio: -1 }, buyers: [],
      inactiveBilling: { hourly: { type: 'hourly', timer: { status: 'running', accumulatedMs: 10, lastStartedAt: '2026-06-09T00:00:00.000Z' } } },
      createdAt: '2026-06-09T00:00:00.000Z',
    }], Date.parse('2026-06-09T01:00:00.000Z'))!;
    expect(migrated[0].billing).toEqual({ type: 'ratio', expPerMesoRatio: 0, tiers: [] });
    expect(migrated[0].inactiveBilling?.hourly?.ledger).toMatchObject({ status: 'paused', checkpointAt: undefined });
  });

  it('ignores fame in legacy snapshots', () => {
    const migrated = migrateV5Instances([{
      id: 'legacy-fame', name: 'Legacy fame',
      billing: { type: 'ratio', expPerMesoRatio: 3.3 },
      buyers: [{
        id: 'buyer', ign: 'Buyer',
        start: {
          ign: 'Buyer', level: 120, expPercent: 1, fame: 999,
          capturedAt: '2026-06-09T00:00:00.000Z', source: 'api',
        },
      }],
      createdAt: '2026-06-09T00:00:00.000Z',
    }], Date.parse('2026-06-09T00:00:00.000Z'))!;
    expect(migrated[0].buyers[0].start).not.toHaveProperty('fame');
  });
});
