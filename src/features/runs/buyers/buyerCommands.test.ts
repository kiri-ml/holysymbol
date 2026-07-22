import { describe, expect, it } from 'vitest';
import type { CharacterSnapshot, HourlyBilling, LeechInstance } from '../../../domain/types';
import {
  addBuyerFromSnapshot,
  applyBuyerCurrentSnapshots,
  removeBuyerFromRun,
  setBuyerCompleted,
  setBuyerSnapshot,
} from './buyerCommands';

const capturedAt = '2026-07-22T00:00:00.000Z';

function snapshot(ign: string, level = 120): CharacterSnapshot {
  return { ign, level, expPercent: 0, capturedAt, source: 'api' };
}

function hourlyRun(): LeechInstance {
  const billing: HourlyBilling = {
    type: 'hourly',
    hourlyRateMesos: 12_000_000,
    ledger: { status: 'running', accumulatedMs: 0, checkpointAt: 1_000, accounts: {} },
  };
  return {
    id: 'run-1',
    name: 'Run',
    billing,
    buyers: [],
    nextBuyerId: 0,
    createdAt: capturedAt,
  };
}

describe('buyer commands', () => {
  it('allocates buyer IDs from the latest run and activates new hourly buyers', () => {
    const existing = addBuyerFromSnapshot(hourlyRun(), snapshot('First'), 2_000);
    const next = addBuyerFromSnapshot(existing, snapshot('Second'), 3_000);

    expect(next.buyers.map((buyer) => buyer.id)).toEqual([0, 1]);
    expect(next.nextBuyerId).toBe(2);
    expect(next.billing.type).toBe('hourly');
    if (next.billing.type === 'hourly') {
      expect(next.billing.ledger.accounts[1]).toEqual({ accruedMs: 0, active: true });
    }
  });

  it('updates only the targeted buyer when an async snapshot result is applied', () => {
    const run = {
      ...hourlyRun(),
      buyers: [
        { id: 0, ign: 'First', start: snapshot('First') },
        { id: 1, ign: 'Second', locked: true, start: snapshot('Second') },
      ],
      nextBuyerId: 2,
    };
    const next = setBuyerSnapshot(run, 0, 'current', snapshot('First', 125), 2_000);

    expect(next.buyers[0].current?.level).toBe(125);
    expect(next.buyers[1]).toBe(run.buyers[1]);
  });

  it('applies batch snapshots to the latest buyers without replacing unrelated state', () => {
    const run: LeechInstance = {
      ...hourlyRun(),
      name: 'Concurrent rename',
      buyers: [
        { id: 0, ign: 'First', start: snapshot('First') },
        { id: 1, ign: 'Second', locked: true, start: snapshot('Second') },
      ],
      nextBuyerId: 2,
    };
    const snapshots = new Map([['first', snapshot('First', 130)]]);
    const next = applyBuyerCurrentSnapshots(run, snapshots, '2026-07-22T01:00:00.000Z');

    expect(next.name).toBe('Concurrent rename');
    expect(next.buyers[0].current?.level).toBe(130);
    expect(next.buyers[1].current).toBeUndefined();
    expect(next.lastCurrentRefreshedAt).toBe('2026-07-22T01:00:00.000Z');
  });

  it('checkpoints hourly billing when completing and removing buyers', () => {
    const withBuyer = addBuyerFromSnapshot(hourlyRun(), snapshot('First'), 1_000);
    const completed = setBuyerCompleted(withBuyer, 0, true, 2_000);
    const removed = removeBuyerFromRun(completed, 0, 3_000);

    expect(completed.buyers[0].locked).toBe(true);
    expect(completed.billing.type).toBe('hourly');
    if (completed.billing.type === 'hourly') {
      expect(completed.billing.ledger.accounts[0]?.active).toBe(false);
    }
    expect(removed.buyers).toEqual([]);
    if (removed.billing.type === 'hourly') {
      expect(removed.billing.ledger.accounts[0]).toBeUndefined();
    }
  });
});
