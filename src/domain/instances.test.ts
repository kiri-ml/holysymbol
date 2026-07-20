import { describe, expect, it } from 'vitest';
import { createInstanceWithBillingSettings } from './instances';
import type { LeechInstance } from './types';

const identity = {
  id: 'leech-copy',
  name: 'Jul 21, 10:30',
  createdAt: '2026-07-21T02:30:00.000Z',
};

describe('creating a run from existing billing settings', () => {
  it('copies ratio settings into a new buyer-free run', () => {
    const source: LeechInstance = {
      id: 'leech-source',
      name: 'Original',
      createdAt: '2026-07-20T02:30:00.000Z',
      lastCurrentRefreshedAt: '2026-07-20T03:30:00.000Z',
      billing: {
        type: 'ratio',
        expPerMesoRatio: 3.3,
        tiers: [{ minLevel: 120, expPerMesoRatio: 4.2 }],
      },
      inactiveBilling: {
        hourly: {
          type: 'hourly',
          hourlyRateMesos: 15_000_000,
          timer: { status: 'paused', accumulatedMs: 1_800_000 },
        },
      },
      buyers: [{ id: 'buyer', ign: 'Buyer' }],
    };

    const newInstance = createInstanceWithBillingSettings(source, identity);

    expect(newInstance).toEqual({
      ...identity,
      billing: {
        type: 'ratio',
        expPerMesoRatio: 3.3,
        tiers: [{ minLevel: 120, expPerMesoRatio: 4.2 }],
      },
      inactiveBilling: {
        ratio: {
          type: 'ratio',
          expPerMesoRatio: 3.3,
          tiers: [{ minLevel: 120, expPerMesoRatio: 4.2 }],
        },
        hourly: {
          type: 'hourly',
          hourlyRateMesos: 15_000_000,
          timer: { status: 'idle', accumulatedMs: 0 },
        },
      },
      buyers: [],
    });
    expect(newInstance).not.toHaveProperty('lastCurrentRefreshedAt');
    expect(newInstance.billing).not.toBe(source.billing);
    if (newInstance.billing.type === 'ratio' && source.billing.type === 'ratio') {
      expect(newInstance.billing.tiers).not.toBe(source.billing.tiers);
    }
    expect(newInstance.inactiveBilling?.hourly).not.toBe(source.inactiveBilling?.hourly);
  });

  it('copies active and saved pricing while resetting hourly timers', () => {
    const source: LeechInstance = {
      id: 'leech-source',
      name: 'Original',
      createdAt: '2026-07-20T02:30:00.000Z',
      billing: {
        type: 'hourly',
        hourlyRateMesos: 18_000_000,
        timer: { status: 'running', accumulatedMs: 900_000, lastStartedAt: '2026-07-20T03:00:00.000Z' },
      },
      inactiveBilling: {
        ratio: { type: 'ratio', expPerMesoRatio: 4, tiers: [{ minLevel: 150, expPerMesoRatio: 4.5 }] },
        hourly: {
          type: 'hourly',
          hourlyRateMesos: 18_000_000,
          timer: { status: 'paused', accumulatedMs: 900_000 },
        },
      },
      buyers: [{ id: 'buyer', ign: 'Buyer', hourly: { sessions: [{ startedAt: '2026-07-20T03:00:00.000Z' }] } }],
    };

    const newInstance = createInstanceWithBillingSettings(source, identity);

    expect(newInstance.billing).toEqual({
      type: 'hourly',
      hourlyRateMesos: 18_000_000,
      timer: { status: 'idle', accumulatedMs: 0 },
    });
    expect(newInstance.inactiveBilling).toEqual({
      ratio: { type: 'ratio', expPerMesoRatio: 4, tiers: [{ minLevel: 150, expPerMesoRatio: 4.5 }] },
      hourly: newInstance.billing,
    });
    expect(newInstance.buyers).toEqual([]);
    expect(newInstance.inactiveBilling?.ratio).not.toBe(source.inactiveBilling?.ratio);
    expect(newInstance.inactiveBilling?.ratio?.tiers).not.toBe(source.inactiveBilling?.ratio?.tiers);
  });
});
