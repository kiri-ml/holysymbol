import type { BuyerHourlySession, BuyerHourlyState, LeechBuyer, LeechInstance, LeechTimer } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function nonNegativeNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function validIsoString(value: unknown) {
  if (typeof value !== 'string') return undefined;
  return Number.isFinite(new Date(value).getTime()) ? value : undefined;
}

export function normalizeBuyerHourlyState(value: unknown): BuyerHourlyState {
  const source = isRecord(value) ? value : {};
  const sessions = Array.isArray(source.sessions)
    ? source.sessions.flatMap((session): BuyerHourlySession[] => {
      if (!isRecord(session)) return [];
      const startedAt = validIsoString(session.startedAt);
      if (!startedAt) return [];
      return [{ startedAt, endedAt: validIsoString(session.endedAt) }];
    })
    : [];

  return {
    sessions,
  };
}

function normalizeTimer(value: unknown): LeechTimer {
  const source = isRecord(value) ? value : {};
  const status = source.status === 'running' || source.status === 'paused' || source.status === 'idle'
    ? source.status
    : 'idle';
  return {
    status,
    accumulatedMs: nonNegativeNumber(source.accumulatedMs),
    lastStartedAt: validIsoString(source.lastStartedAt),
  };
}

function normalizeBuyer(value: unknown, includeHourly: boolean): LeechBuyer | undefined {
  if (!isRecord(value)) return undefined;
  const buyer = value as LeechBuyer;
  return {
    ...buyer,
    id: typeof value.id === 'string' ? value.id : '',
    ign: typeof value.ign === 'string' ? value.ign : '',
    hourly: includeHourly ? normalizeBuyerHourlyState(value.hourly) : buyer.hourly,
  };
}

function normalizeRatioBilling(value: unknown) {
  const source = isRecord(value) ? value : {};
  const tiersByLevel = new Map<number, number>();

  if (Array.isArray(source.tiers)) {
    for (const value of source.tiers) {
      if (!isRecord(value) || typeof value.minLevel !== 'number' || !Number.isFinite(value.minLevel)) continue;
      if (typeof value.expPerMesoRatio !== 'number' || !Number.isFinite(value.expPerMesoRatio)) continue;
      const minLevel = Math.max(1, Math.min(200, Math.round(value.minLevel)));
      tiersByLevel.set(minLevel, Math.max(0, value.expPerMesoRatio));
    }
  }

  return {
    type: 'ratio' as const,
    expPerMesoRatio: nonNegativeNumber(source.expPerMesoRatio, 3.3),
    tiers: [...tiersByLevel.entries()]
      .sort(([left], [right]) => left - right)
      .map(([minLevel, expPerMesoRatio]) => ({ minLevel, expPerMesoRatio })),
  };
}

function normalizeHourlyBilling(value: unknown) {
  const source = isRecord(value) ? value : {};
  return {
    type: 'hourly' as const,
    hourlyRateMesos: nonNegativeNumber(source.hourlyRateMesos, 12_000_000),
    timer: normalizeTimer(source.timer),
  };
}

function normalizeInstance(value: unknown): LeechInstance | undefined {
  if (!isRecord(value)) return undefined;
  const instance = value as LeechInstance;
  const billingRecord = isRecord(value.billing) ? value.billing : undefined;
  const isHourly = billingRecord?.type === 'hourly';
  const inactiveBillingRecord = isRecord(value.inactiveBilling) ? value.inactiveBilling : undefined;
  const inactiveRatio = isRecord(inactiveBillingRecord?.ratio) && inactiveBillingRecord.ratio.type === 'ratio'
    ? normalizeRatioBilling(inactiveBillingRecord.ratio)
    : undefined;
  const inactiveHourly = isRecord(inactiveBillingRecord?.hourly) && inactiveBillingRecord.hourly.type === 'hourly'
    ? normalizeHourlyBilling(inactiveBillingRecord.hourly)
    : undefined;
  const billing = isHourly ? normalizeHourlyBilling(billingRecord) : normalizeRatioBilling(billingRecord);

  return {
    ...instance,
    id: typeof value.id === 'string' ? value.id : '',
    name: typeof value.name === 'string' ? value.name : '',
    billing,
    inactiveBilling: {
      ratio: billing.type === 'ratio' ? billing : inactiveRatio,
      hourly: billing.type === 'hourly' ? billing : inactiveHourly,
    },
    buyers: Array.isArray(value.buyers)
      ? value.buyers.flatMap((buyer) => {
        const normalized = normalizeBuyer(buyer, isHourly);
        return normalized ? [normalized] : [];
      })
      : [],
    createdAt: validIsoString(value.createdAt) ?? new Date().toISOString(),
    lastCurrentRefreshedAt: validIsoString(value.lastCurrentRefreshedAt),
  };
}

export function normalizeInstances(value: unknown, fallback: LeechInstance[]): LeechInstance[] {
  if (!Array.isArray(value)) return fallback;
  const instances = value.flatMap((instance) => {
    const normalized = normalizeInstance(instance);
    return normalized ? [normalized] : [];
  });
  return instances.length > 0 ? instances : fallback;
}
