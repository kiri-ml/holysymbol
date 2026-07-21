import { describe, expect, it } from 'vitest';
import { applyCurrentSnapshots } from './buyers';
import type { CharacterSnapshot, LeechBuyer } from './types';

function snapshot(_id: string, expPercent: number): CharacterSnapshot {
  return {
    ign: 'RepeatedBuyer',
    level: 120,
    expPercent,
    capturedAt: '2026-07-21T00:00:00.000Z',
    source: 'api',
  };
}

describe('applyCurrentSnapshots', () => {
  it('does not refresh a completed row when an active buyer has the same IGN', () => {
    const completedSnapshot = snapshot('completed-current', 10);
    const buyers: LeechBuyer[] = [
      { id: 0, ign: 'RepeatedBuyer', locked: true, current: completedSnapshot },
      { id: 1, ign: 'RepeatedBuyer', current: snapshot('active-current', 20) },
    ];
    const refreshedSnapshot = snapshot('refreshed', 30);

    const refreshed = applyCurrentSnapshots(buyers, new Map([['repeatedbuyer', refreshedSnapshot]]));

    expect(refreshed[0]).toBe(buyers[0]);
    expect(refreshed[0].current).toBe(completedSnapshot);
    expect(refreshed[1].current).toBe(refreshedSnapshot);
  });
});
