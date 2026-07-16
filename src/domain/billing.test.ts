import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOURLY_BILLING,
  switchInstanceBillingType,
  updateInstanceBilling,
} from './billing';
import type { CharacterSnapshot, LeechBuyer, LeechInstance } from './types';

function snapshot(): CharacterSnapshot {
  return {
    id: 'snapshot-test',
    ign: 'Buyer',
    level: 50,
    expPercent: 0,
    capturedAt: '2026-06-09T00:00:00.000Z',
    source: 'manual',
  };
}

function buyer(id = 'buyer-test'): LeechBuyer {
  return {
    id,
    ign: 'Buyer',
    start: snapshot(),
  };
}

function instance(overrides: Partial<LeechInstance> = {}): LeechInstance {
  return {
    id: 'leech-test',
    name: 'Leech',
    billing: { type: 'ratio', expPerMesoRatio: 3.3, tiers: [] },
    buyers: [],
    createdAt: '2026-06-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('billing mode switching', () => {
  it('pauses a running hourly timer and buyer sessions when switching to ratio', () => {
    const now = new Date('2026-06-09T01:00:00.000Z').getTime();
    const switched = switchInstanceBillingType(instance({
      billing: {
        ...DEFAULT_HOURLY_BILLING,
        timer: {
          status: 'running',
          accumulatedMs: 1_800_000,
          lastStartedAt: '2026-06-09T00:30:00.000Z',
        },
      },
      buyers: [{
        ...buyer(),
        hourly: { sessions: [{ startedAt: '2026-06-09T00:30:00.000Z' }] },
      }],
    }), 'ratio', now);

    expect(switched.billing).toEqual({ type: 'ratio', expPerMesoRatio: 3.3, tiers: [] });
    expect(switched.inactiveBilling?.hourly?.timer).toEqual({
      status: 'paused',
      accumulatedMs: 3_600_000,
      lastStartedAt: undefined,
    });
    expect(switched.buyers[0].hourly?.sessions).toEqual([
      {
        startedAt: '2026-06-09T00:30:00.000Z',
        endedAt: '2026-06-09T01:00:00.000Z',
      },
    ]);
  });

  it('restores preserved hourly timer, buyer sessions, and pricing when switching back to hourly', () => {
    const ratioRun = switchInstanceBillingType(instance({
      billing: {
        type: 'hourly',
        hourlyRateMesos: 20_000_000,
        timer: {
          status: 'running',
          accumulatedMs: 0,
          lastStartedAt: '2026-06-09T00:00:00.000Z',
        },
      },
      buyers: [{
        ...buyer(),
        hourly: { sessions: [{ startedAt: '2026-06-09T00:00:00.000Z' }] },
      }],
    }), 'ratio', new Date('2026-06-09T01:00:00.000Z').getTime());

    const hourlyRun = switchInstanceBillingType(ratioRun, 'hourly');

    expect(hourlyRun.billing).toEqual({
      type: 'hourly',
      hourlyRateMesos: 20_000_000,
      timer: {
        status: 'paused',
        accumulatedMs: 3_600_000,
        lastStartedAt: undefined,
      },
    });
    expect(hourlyRun.buyers[0].hourly?.sessions).toEqual([
      {
        startedAt: '2026-06-09T00:00:00.000Z',
        endedAt: '2026-06-09T01:00:00.000Z',
      },
    ]);
  });

  it('preserves ratio settings across mode switches', () => {
    const updated = updateInstanceBilling(instance(), {
      type: 'ratio',
      expPerMesoRatio: 4.2,
      tiers: [{ minLevel: 120, expPerMesoRatio: 4.5 }],
    });
    const hourlyRun = switchInstanceBillingType(updated, 'hourly');
    const ratioRun = switchInstanceBillingType(hourlyRun, 'ratio');

    expect(ratioRun.billing).toEqual({
      type: 'ratio',
      expPerMesoRatio: 4.2,
      tiers: [{ minLevel: 120, expPerMesoRatio: 4.5 }],
    });
  });

  it('creates default hourly state on the first switch to hourly', () => {
    const switched = switchInstanceBillingType(instance({ buyers: [buyer()] }), 'hourly');

    expect(switched.billing).toEqual(DEFAULT_HOURLY_BILLING);
    expect(switched.buyers[0].hourly).toEqual({ sessions: [] });
  });
});
