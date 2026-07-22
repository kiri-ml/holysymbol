import { roundToHundredth } from '../pricing/pricingValues';

export type LevelExpValue = {
  level: number;
  expPercent: number;
};

export function clampLevel(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(200, Math.round(value)));
}

export function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(99.999, value));
}

export function normalizePercent(value: number) {
  return Math.max(0, Math.min(99.99, roundToHundredth(value)));
}

export function normalizeLevelExp(value: LevelExpValue): LevelExpValue {
  return {
    level: clampLevel(value.level),
    expPercent: normalizePercent(value.expPercent),
  };
}
