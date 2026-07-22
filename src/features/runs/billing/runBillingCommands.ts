import { pauseHourlyBilling, startHourlyBilling } from '../../../domain/calculator';
import type { BuyerId, HourlyBilling, RatioBilling } from '../../../domain/types';

export function canAddRatioTier(billing: RatioBilling, minLevel: number) {
  return billing.tiers.length < 200
    && Number.isInteger(minLevel)
    && minLevel >= 1
    && minLevel <= 200
    && !billing.tiers.some((tier) => tier.minLevel === minLevel);
}

export function addRatioTier(billing: RatioBilling, minLevel: number): RatioBilling {
  if (!canAddRatioTier(billing, minLevel)) return billing;
  const precedingTier = billing.tiers.filter((tier) => tier.minLevel < minLevel).at(-1);
  const expPerMesoRatio = precedingTier?.expPerMesoRatio ?? billing.expPerMesoRatio;
  return {
    ...billing,
    tiers: [...billing.tiers, { minLevel, expPerMesoRatio }]
      .sort((left, right) => left.minLevel - right.minLevel),
  };
}

export function updateRatioTier(
  billing: RatioBilling,
  minLevel: number,
  expPerMesoRatio: number,
): RatioBilling {
  return {
    ...billing,
    tiers: billing.tiers.map((tier) => tier.minLevel === minLevel
      ? { ...tier, expPerMesoRatio }
      : tier),
  };
}

export function removeRatioTier(billing: RatioBilling, minLevel: number): RatioBilling {
  return { ...billing, tiers: billing.tiers.filter((tier) => tier.minLevel !== minLevel) };
}

export function toggleHourlyBilling(
  billing: HourlyBilling,
  activeBuyerIds: BuyerId[],
  now: number,
): HourlyBilling {
  return billing.ledger.status === 'running'
    ? pauseHourlyBilling(billing, now)
    : startHourlyBilling(billing, activeBuyerIds, now);
}
