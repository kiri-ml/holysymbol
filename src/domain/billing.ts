import {
  pauseBuyerHourlyTimer,
  pauseTimer,
} from './calculator';
import { normalizeBuyerHourlyState } from './persistence';
import type {
  BillingType,
  HourlyBilling,
  InactiveBilling,
  LeechBilling,
  LeechBuyer,
  LeechInstance,
  RatioBilling,
} from './types';

export const DEFAULT_RATIO_BILLING: RatioBilling = {
  type: 'ratio',
  expPerMesoRatio: 3.3,
};

export const DEFAULT_HOURLY_BILLING: HourlyBilling = {
  type: 'hourly',
  hourlyRateMesos: 12_000_000,
  expPerHourMillions: 35,
  timer: { status: 'idle', accumulatedMs: 0 },
};

export function ensureBuyerHourlyState(buyer: LeechBuyer): LeechBuyer {
  return {
    ...buyer,
    hourly: normalizeBuyerHourlyState(buyer.hourly),
  };
}

function storeBilling(inactiveBilling: InactiveBilling | undefined, billing: LeechBilling): InactiveBilling {
  return {
    ...inactiveBilling,
    [billing.type]: billing,
  };
}

function pauseHourlyState(
  billing: HourlyBilling,
  buyers: LeechBuyer[],
  now: number,
): { billing: HourlyBilling; buyers: LeechBuyer[] } {
  if (billing.timer.status !== 'running') return { billing, buyers };

  return {
    billing: {
      ...billing,
      timer: pauseTimer(billing.timer, now),
    },
    buyers: buyers.map((buyer) => pauseBuyerHourlyTimer(ensureBuyerHourlyState(buyer), now)),
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

  const current = instance.billing.type === 'hourly'
    ? pauseHourlyState(instance.billing, instance.buyers, now)
    : { billing: instance.billing, buyers: instance.buyers };
  const inactiveBilling = storeBilling(instance.inactiveBilling, current.billing);
  const billing = type === 'hourly'
    ? (inactiveBilling.hourly ?? DEFAULT_HOURLY_BILLING)
    : (inactiveBilling.ratio ?? DEFAULT_RATIO_BILLING);

  return {
    ...instance,
    billing,
    inactiveBilling: storeBilling(inactiveBilling, billing),
    buyers: type === 'hourly'
      ? current.buyers.map(ensureBuyerHourlyState)
      : current.buyers,
  };
}
