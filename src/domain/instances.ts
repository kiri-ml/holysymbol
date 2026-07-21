import type { HourlyBilling, InactiveBilling, LeechBilling, LeechInstance, RatioBilling } from './types';

function copyRatioBilling(billing: RatioBilling): RatioBilling {
  return {
    ...billing,
    tiers: billing.tiers.map((tier) => ({ ...tier })),
  };
}

function copyHourlyBilling(billing: HourlyBilling): HourlyBilling {
  return {
    ...billing,
    ledger: { status: 'idle', accumulatedMs: 0, accounts: {} },
  };
}

function copyBilling(billing: LeechBilling): LeechBilling {
  return billing.type === 'ratio' ? copyRatioBilling(billing) : copyHourlyBilling(billing);
}

function copyBillingSettings(source: LeechInstance, billing: LeechBilling): InactiveBilling {
  let ratio: RatioBilling | undefined;
  let hourly: HourlyBilling | undefined;

  if (billing.type === 'ratio') ratio = billing;
  else if (source.inactiveBilling?.ratio) ratio = copyRatioBilling(source.inactiveBilling.ratio);

  if (billing.type === 'hourly') hourly = billing;
  else if (source.inactiveBilling?.hourly) hourly = copyHourlyBilling(source.inactiveBilling.hourly);

  return { ratio, hourly };
}

export function createInstanceWithBillingSettings(
  source: LeechInstance,
  identity: Pick<LeechInstance, 'id' | 'name' | 'createdAt'>,
): LeechInstance {
  const billing = copyBilling(source.billing);

  return {
    ...identity,
    billing,
    inactiveBilling: copyBillingSettings(source, billing),
    buyers: [],
    nextBuyerId: 0,
  };
}
