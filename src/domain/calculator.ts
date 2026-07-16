import { expGainedBetween, rawExpAt } from './expTable';
import type {
  BuyerCalculation,
  EstimateCalculation,
  InstanceCalculation,
  LeechBilling,
  LeechBuyer,
  LeechInstance,
  LeechTimer,
  RatioBilling,
} from './types';

function orderedRatioTiers(billing: RatioBilling) {
  return [...billing.tiers].sort((left, right) => left.minLevel - right.minLevel);
}

export function calculateTieredRatioDue(
  billing: RatioBilling,
  fromLevel: number,
  fromExpPercent: number,
  toLevel: number,
  toExpPercent: number,
): number | undefined {
  const startExp = rawExpAt(fromLevel, fromExpPercent);
  const endExp = Math.max(startExp, rawExpAt(toLevel, toExpPercent));
  let currentRatio = billing.expPerMesoRatio;
  let segmentStart = startExp;
  let due = 0;

  for (const tier of orderedRatioTiers(billing)) {
    const thresholdExp = rawExpAt(tier.minLevel, 0);
    if (thresholdExp <= startExp) {
      currentRatio = tier.expPerMesoRatio;
      continue;
    }
    if (thresholdExp >= endExp) break;
    if (currentRatio <= 0) return undefined;
    due += (thresholdExp - segmentStart) / currentRatio;
    segmentStart = thresholdExp;
    currentRatio = tier.expPerMesoRatio;
  }

  if (currentRatio <= 0) return undefined;
  return due + (endExp - segmentStart) / currentRatio;
}

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

function dateMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

export function getBuyerBillableMs(buyer: LeechBuyer, now = Date.now()): number {
  return (buyer.hourly?.sessions ?? []).reduce((total, session) => {
    const startedMs = dateMs(session.startedAt);
    if (startedMs === undefined) return total;
    const endedMs = dateMs(session.endedAt) ?? now;
    return total + Math.max(0, endedMs - startedMs);
  }, 0);
}

export function isBuyerHourlyTimerRunning(buyer: LeechBuyer): boolean {
  return Boolean(buyer.hourly?.sessions.some((session) => !session.endedAt));
}

export function startBuyerHourlyTimer(buyer: LeechBuyer, nowIso = new Date().toISOString()): LeechBuyer {
  const hourly = buyer.hourly ?? { sessions: [] };
  return {
    ...buyer,
    hourly: {
      sessions: [
        ...hourly.sessions.map((session) => (session.endedAt ? session : { ...session, endedAt: nowIso })),
        { startedAt: nowIso },
      ],
    },
  };
}

export function pauseBuyerHourlyTimer(buyer: LeechBuyer, now = Date.now()): LeechBuyer {
  const hourly = buyer.hourly ?? { sessions: [] };
  const endedAt = new Date(now).toISOString();
  return {
    ...buyer,
    hourly: {
      sessions: hourly.sessions.map((session) => (session.endedAt ? session : { ...session, endedAt })),
    },
  };
}

function getBuyerSplitBillableMs(targetBuyer: LeechBuyer, buyers: LeechBuyer[], now = Date.now()): number {
  const intervals = buyers.flatMap((buyer) => {
    if (!buyer.start) return [];
    return (buyer.hourly?.sessions ?? []).flatMap((session) => {
      const startedMs = dateMs(session.startedAt);
      if (startedMs === undefined) return [];
      const endedMs = dateMs(session.endedAt) ?? now;
      if (endedMs <= startedMs) return [];
      return [{ buyerId: buyer.id, startedMs, endedMs }];
    });
  });

  if (intervals.length === 0) return 0;

  const boundaries = [...new Set(intervals.flatMap((interval) => [interval.startedMs, interval.endedMs]))].sort((a, b) => a - b);
  let billableMs = 0;

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startedMs = boundaries[index];
    const endedMs = boundaries[index + 1];
    if (endedMs <= startedMs) continue;

    const active = intervals.filter((interval) => interval.startedMs < endedMs && interval.endedMs > startedMs);
    if (!active.some((interval) => interval.buyerId === targetBuyer.id)) continue;
    billableMs += (endedMs - startedMs) / active.length;
  }

  return billableMs;
}

export function calculateBuyer(buyer: LeechBuyer, billing: LeechBilling, now = Date.now(), buyers: LeechBuyer[] = [buyer]): BuyerCalculation {
  const expGained = buyer.start && buyer.current
    ? Math.max(0, expGainedBetween(buyer.start.level, buyer.start.expPercent, buyer.current.level, buyer.current.expPercent))
    : undefined;

  if (billing.type === 'ratio') {
    return {
      expGained,
      ratioMesosDue: buyer.start && buyer.current
        ? calculateTieredRatioDue(
          billing,
          buyer.start.level,
          buyer.start.expPercent,
          buyer.current.level,
          buyer.current.expPercent,
        )
        : undefined,
    };
  }

  const billableMs = getBuyerSplitBillableMs(buyer, buyers, now);
  return {
    expGained,
    hourlyMesosDue: billableMs > 0 && buyer.start ? (billableMs / 3_600_000) * billing.hourlyRateMesos : undefined,
  };
}

export function calculateInstance(instance: LeechInstance, now = Date.now()): InstanceCalculation {
  const buyerCount = instance.buyers.filter((buyer) => buyer.start || buyer.ign.trim()).length;
  const doneBuyerCount = instance.buyers.filter(
    (buyer) => (buyer.start || buyer.ign.trim()) && buyer.locked,
  ).length;
  const buyerCalculations = instance.buyers.map((buyer) => calculateBuyer(buyer, instance.billing, now, instance.buyers));
  const totalExpGained = buyerCalculations.reduce((total, calculation) => total + (calculation.expGained ?? 0), 0);

  if (instance.billing.type === 'ratio') {
    const totalMesosDue = buyerCalculations.reduce(
      (total, calculation) => total + (calculation.ratioMesosDue ?? 0),
      0,
    );
    return {
      buyerCount,
      doneBuyerCount,
      totalExpGained,
      totalMesosDue,
    };
  }

  const billableMs = instance.buyers.reduce((total, buyer) => total + (buyer.start ? getBuyerBillableMs(buyer, now) : 0), 0);
  const totalHourlyMesos = buyerCalculations.reduce(
    (total, calculation) => total + (calculation.hourlyMesosDue ?? 0),
    0,
  );

  return {
    buyerCount,
    doneBuyerCount,
    totalExpGained,
    billableMs,
    totalMesosDue: totalHourlyMesos,
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
