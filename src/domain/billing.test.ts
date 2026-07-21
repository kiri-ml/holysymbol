import { describe, expect, it } from 'vitest';
import { DEFAULT_HOURLY_BILLING, switchInstanceBillingType, updateInstanceBilling } from './billing';
import type { CharacterSnapshot, LeechBuyer, LeechInstance } from './types';

function snapshot(): CharacterSnapshot {
  return { ign: 'Buyer', level: 50, expPercent: 0, capturedAt: '2026-06-09T00:00:00.000Z', source: 'manual' };
}

function buyer(id = 0): LeechBuyer {
  return { id, ign: 'Buyer', start: snapshot() };
}

function instance(overrides: Partial<LeechInstance> = {}): LeechInstance {
  return {
    id: 'leech-test',
    name: 'Leech',
    billing: { type: 'ratio', expPerMesoRatio: 3.3, tiers: [] },
    buyers: [],
    nextBuyerId: 0,
    createdAt: '2026-06-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('billing mode switching', () => {
  it('checkpoints and pauses a running hourly ledger when switching to ratio', () => {
    const switched = switchInstanceBillingType(instance({
      billing: {
        type: 'hourly',
        hourlyRateMesos: 20_000_000,
        ledger: {
          status: 'running',
          accumulatedMs: 1_800_000,
          checkpointAt: 1_000,
          accounts: { 0: { accruedMs: 1_800_000, active: true } },
        },
      },
      buyers: [buyer()],
    }), 'ratio', 1_801_000);

    expect(switched.billing.type).toBe('ratio');
    expect(switched.inactiveBilling?.hourly?.ledger).toEqual({
      status: 'paused',
      accumulatedMs: 3_600_000,
      checkpointAt: undefined,
      accounts: { 0: { accruedMs: 3_600_000, active: false } },
    });
  });

  it('restores preserved hourly pricing and paused ledger', () => {
    const hourly = switchInstanceBillingType(instance({
      inactiveBilling: {
        hourly: {
          type: 'hourly',
          hourlyRateMesos: 20_000_000,
          ledger: { status: 'paused', accumulatedMs: 3_600_000, accounts: { 0: { accruedMs: 3_600_000, active: false } } },
        },
      },
    }), 'hourly');

    expect(hourly.billing).toEqual(hourly.inactiveBilling?.hourly);
  });

  it('preserves ratio settings across mode switches', () => {
    const updated = updateInstanceBilling(instance(), {
      type: 'ratio', expPerMesoRatio: 4.2, tiers: [{ minLevel: 120, expPerMesoRatio: 4.5 }],
    });
    const ratioRun = switchInstanceBillingType(switchInstanceBillingType(updated, 'hourly'), 'ratio');
    expect(ratioRun.billing).toEqual({ type: 'ratio', expPerMesoRatio: 4.2, tiers: [{ minLevel: 120, expPerMesoRatio: 4.5 }] });
  });

  it('creates an empty default hourly ledger on first switch', () => {
    const switched = switchInstanceBillingType(instance({ buyers: [buyer()] }), 'hourly');
    expect(switched.billing).toEqual(DEFAULT_HOURLY_BILLING);
    expect(switched.buyers[0]).not.toHaveProperty('hourly');
  });
});
