import { describe, expect, it } from 'vitest';
import type { HourlyBilling, LeechInstance, RatioBilling } from '../../domain/types';
import {
  changeRunBillingType,
  renameRun,
  toggleRunHourlyTimer,
  updateRunHourlyBilling,
  updateRunRatioBilling,
} from './runCommands';

const createdAt = '2026-07-22T00:00:00.000Z';

function ratioRun(): LeechInstance {
  return {
    id: 'run-1',
    name: '',
    billing: { type: 'ratio', expPerMesoRatio: 3.3, tiers: [] },
    buyers: [],
    nextBuyerId: 0,
    createdAt,
  };
}

describe('run commands', () => {
  it('updates the active billing type only', () => {
    const ratio = ratioRun();
    const updated = updateRunRatioBilling(ratio, (billing) => ({ ...billing, expPerMesoRatio: 4 }));
    const ignored = updateRunHourlyBilling(updated, (billing) => ({ ...billing, hourlyRateMesos: 20_000_000 }));

    expect((updated.billing as RatioBilling).expPerMesoRatio).toBe(4);
    expect(ignored).toBe(updated);
  });

  it('uses an explicit timestamp when switching and starting hourly billing', () => {
    const switched = changeRunBillingType(ratioRun(), 'hourly', 1_000);
    const withBuyer: LeechInstance = {
      ...switched,
      buyers: [{
        id: 0,
        ign: 'Buyer',
        start: { ign: 'Buyer', level: 120, expPercent: 0, capturedAt: createdAt, source: 'api' },
      }],
      nextBuyerId: 1,
    };
    const running = toggleRunHourlyTimer(withBuyer, 2_000);

    expect(running.billing.type).toBe('hourly');
    const billing = running.billing as HourlyBilling;
    expect(billing.ledger.status).toBe('running');
    expect(billing.ledger.checkpointAt).toBe(2_000);
    expect(billing.ledger.accounts[0]?.active).toBe(true);
  });

  it('preserves unrelated run state when applying semantic updates', () => {
    const run = { ...ratioRun(), buyers: [{ id: 0, ign: 'Buyer' }] };
    const renamed = renameRun(run, 'New name');

    expect(renamed.name).toBe('New name');
    expect(renamed.buyers).toBe(run.buyers);
  });
});
