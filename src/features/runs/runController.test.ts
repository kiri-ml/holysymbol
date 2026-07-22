import { describe, expect, it } from 'vitest';
import type { CharacterSnapshot, LeechInstance } from '../../domain/types';
import type { UpdateRun } from './runCommands';
import { createRunController } from './runController';

const capturedAt = '2026-07-22T00:00:00.000Z';

function snapshot(ign: string): CharacterSnapshot {
  return { ign, level: 120, expPercent: 0, capturedAt, source: 'api' };
}

function runFixture(): LeechInstance {
  return {
    id: 'run-1',
    name: '',
    billing: { type: 'ratio', expPerMesoRatio: 3.3, tiers: [] },
    buyers: [],
    nextBuyerId: 0,
    createdAt: capturedAt,
  };
}

describe('run controller', () => {
  it('applies an awaited buyer result to the latest run state', async () => {
    let resolveSnapshot: (value: CharacterSnapshot) => void = () => undefined;
    const pendingSnapshot = new Promise<CharacterSnapshot>((resolve) => { resolveSnapshot = resolve; });
    let current = runFixture();
    const updateRun: UpdateRun = (runId, update) => {
      if (runId === current.id) current = update(current);
    };
    const controller = createRunController({
      run: current,
      updateRun,
      fetchSnapshot: () => pendingSnapshot,
      fetchSnapshots: async () => ({ snapshots: new Map(), failures: [] }),
      clock: { nowMs: () => 2_000 },
    });

    const adding = controller.buyers.add('Buyer');
    current = { ...current, name: 'Edited while loading' };
    resolveSnapshot(snapshot('Buyer'));
    await adding;

    expect(current.name).toBe('Edited while loading');
    expect(current.buyers).toHaveLength(1);
    expect(current.buyers[0].ign).toBe('Buyer');
  });
});
