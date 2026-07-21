import { pauseHourlyBilling } from './calculator';
import type {
  BillingType,
  HourlyBilling,
  InactiveBilling,
  LeechBilling,
  LeechInstance,
  RatioBilling,
} from './types';

export const DEFAULT_RATIO_BILLING: RatioBilling = {
  type: 'ratio',
  expPerMesoRatio: 3.3,
  tiers: [],
};

export const DEFAULT_HOURLY_BILLING: HourlyBilling = {
  type: 'hourly',
  hourlyRateMesos: 12_000_000,
  ledger: { status: 'idle', accumulatedMs: 0, accounts: {} },
};

function storeBilling(inactiveBilling: InactiveBilling | undefined, billing: LeechBilling): InactiveBilling {
  return {
    ...inactiveBilling,
    [billing.type]: billing,
  };
}

export function updateInstanceBilling(instance: LeechInstance, billing: LeechBilling): LeechInstance {
  return {
    ...instance,
    billing,
    inactiveBilling: storeBilling(instance.inactiveBilling, billing),
  };
}

export function switchInstanceBillingType(
  instance: LeechInstance,
  type: BillingType,
  now = Date.now(),
): LeechInstance {
  if (type === instance.billing.type) return instance;

  const currentBilling = instance.billing.type === 'hourly'
    ? pauseHourlyBilling(instance.billing, now)
    : instance.billing;
  const inactiveBilling = storeBilling(instance.inactiveBilling, currentBilling);
  const billing = type === 'hourly'
    ? (inactiveBilling.hourly ?? DEFAULT_HOURLY_BILLING)
    : (inactiveBilling.ratio ?? DEFAULT_RATIO_BILLING);

  return {
    ...instance,
    billing,
    inactiveBilling: storeBilling(inactiveBilling, billing),
    buyers: instance.buyers,
  };
}
