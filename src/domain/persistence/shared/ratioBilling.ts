import type { RatioBilling } from '../../types';
import { isRecord, nonNegativeNumber } from './values';

export function normalizeRatioBilling(value: unknown): RatioBilling {
  const source = isRecord(value) ? value : {};
  const tiersByLevel = new Map<number, number>();

  const rawTiers = Array.isArray(source.q)
    ? source.q.map((tier) => Array.isArray(tier) ? { minLevel: tier[0], expPerMesoRatio: tier[1] } : tier)
    : source.tiers;
  if (Array.isArray(rawTiers)) {
    for (const tier of rawTiers) {
      if (!isRecord(tier) || typeof tier.minLevel !== 'number' || !Number.isFinite(tier.minLevel)) continue;
      if (typeof tier.expPerMesoRatio !== 'number' || !Number.isFinite(tier.expPerMesoRatio)) continue;
      const minLevel = Math.max(1, Math.min(200, Math.round(tier.minLevel)));
      tiersByLevel.set(minLevel, Math.max(0, tier.expPerMesoRatio));
    }
  }

  return {
    type: 'ratio',
    expPerMesoRatio: nonNegativeNumber(source.r ?? source.expPerMesoRatio, 3.3),
    tiers: [...tiersByLevel.entries()]
      .sort(([left], [right]) => left - right)
      .map(([minLevel, expPerMesoRatio]) => ({ minLevel, expPerMesoRatio })),
  };
}
