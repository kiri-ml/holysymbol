import { expGainedBetween } from './expTable';
import type {
  BuyerCalculation,
  EstimateCalculation,
  InstanceCalculation,
  LeechBilling,
  LeechBuyer,
  LeechInstance,
  LeechTimer,
} from './types';

export function getBillableMs(timer: LeechTimer, now = Date.now()): number {
  if (timer.status !== 'running' || !timer.lastStartedAt) return timer.accumulatedMs;
  const startedMs = new Date(timer.lastStartedAt).getTime();
  if (!Number.isFinite(startedMs)) return timer.accumulatedMs;
  return timer.accumulatedMs + Math.max(0, now - startedMs);
}

export function startTimer(timer: LeechTimer, nowIso = new Date().toISOString()): LeechTimer {
  if (timer.status === 'running') return timer;
  return {
    ...timer,
    status: 'running',
    lastStartedAt: nowIso,
  };
}

export function pauseTimer(timer: LeechTimer, now = Date.now()): LeechTimer {
  if (timer.status !== 'running') return timer;
  return {
    ...timer,
    status: 'paused',
    accumulatedMs: getBillableMs(timer, now),
    lastStartedAt: undefined,
  };
}

export function resetTimer(): LeechTimer {
  return { status: 'idle', accumulatedMs: 0 };
}

export function calculateBuyer(buyer: LeechBuyer, billing: LeechBilling, now = Date.now(), hourlyBuyerCount = 1): BuyerCalculation {
  const expGained = buyer.start && buyer.current
    ? Math.max(0, expGainedBetween(buyer.start.level, buyer.start.expPercent, buyer.current.level, buyer.current.expPercent))
    : undefined;

  if (billing.type === 'ratio') {
    return {
      expGained,
      ratioMesosDue: expGained !== undefined && billing.expPerMesoRatio > 0 ? expGained / billing.expPerMesoRatio : undefined,
    };
  }

  const billableMs = getBillableMs(billing.timer, now);
  const chargedBuyerCount = Math.max(1, hourlyBuyerCount);
  return {
    expGained,
    hourlyMesosDue: billableMs > 0 && buyer.start ? ((billableMs / 3_600_000) * billing.hourlyRateMesos) / chargedBuyerCount : undefined,
  };
}

export function calculateInstance(instance: LeechInstance, now = Date.now()): InstanceCalculation {
  const buyerCount = instance.buyers.filter((buyer) => buyer.start || buyer.ign.trim()).length;
  const completedBuyerCount = instance.buyers.filter((buyer) => buyer.start && buyer.current).length;
  const totalExpGained = instance.buyers.reduce((total, buyer) => total + (calculateBuyer(buyer, instance.billing, now).expGained ?? 0), 0);

  if (instance.billing.type === 'ratio') {
    return {
      buyerCount,
      completedBuyerCount,
      totalExpGained,
      totalMesosDue: instance.billing.expPerMesoRatio > 0 ? totalExpGained / instance.billing.expPerMesoRatio : 0,
    };
  }

  const billableMs = getBillableMs(instance.billing.timer, now);
  const chargedBuyers = instance.buyers.filter((buyer) => buyer.start).length;
  const totalHourlyMesos = billableMs > 0 ? (billableMs / 3_600_000) * instance.billing.hourlyRateMesos : 0;
  const mesosPerBuyer = chargedBuyers > 0 ? totalHourlyMesos / chargedBuyers : 0;

  return {
    buyerCount,
    completedBuyerCount,
    totalExpGained,
    billableMs,
    mesosPerBuyer,
    totalMesosDue: chargedBuyers > 0 ? totalHourlyMesos : 0,
  };
}

export function calculateEstimate(input: {
  fromLevel: number;
  fromExpPercent: number;
  toLevel: number;
  toExpPercent: number;
  billingType: 'ratio' | 'hourly';
  expPerMesoRatio: number;
  hourlyRateMesos: number;
  expPerHourMillions: number;
}): EstimateCalculation {
  const expNeeded = Math.max(
    0,
    expGainedBetween(input.fromLevel, input.fromExpPercent, input.toLevel, input.toExpPercent),
  );

  if (input.billingType === 'ratio') {
    return {
      expNeeded,
      ratioMesosDue: input.expPerMesoRatio > 0 ? expNeeded / input.expPerMesoRatio : undefined,
    };
  }

  const eph = input.expPerHourMillions * 1_000_000;
  const hours = eph > 0 ? expNeeded / eph : undefined;

  return {
    expNeeded,
    expectedDurationMs: hours !== undefined ? hours * 3_600_000 : undefined,
    hourlyMesosDue: hours !== undefined ? hours * input.hourlyRateMesos : undefined,
  };
}
