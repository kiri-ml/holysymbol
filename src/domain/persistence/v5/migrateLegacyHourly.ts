import type { BuyerId, HourlyBilling, TimerStatus } from '../../types';
import { isRecord, nonNegativeNumber, validIsoString } from '../shared/values';

type LegacyTimer = { status: TimerStatus; accumulatedMs: number; lastStartedAt?: string };
type LegacyInterval = { buyerId: BuyerId; startedMs: number; endedMs: number; open: boolean };

function normalizeTimer(value: unknown): LegacyTimer {
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

function legacyIntervals(rawBuyers: unknown, idMap: Map<string, BuyerId>, now: number): LegacyInterval[] {
  if (!Array.isArray(rawBuyers)) return [];
  return rawBuyers.flatMap((rawBuyer): LegacyInterval[] => {
    if (!isRecord(rawBuyer) || typeof rawBuyer.id !== 'string' || !isRecord(rawBuyer.start)) return [];
    const buyerId = idMap.get(rawBuyer.id);
    if (buyerId === undefined) return [];
    const hourly = isRecord(rawBuyer.hourly) ? rawBuyer.hourly : {};
    if (!Array.isArray(hourly.sessions)) return [];
    return hourly.sessions.flatMap((rawSession): LegacyInterval[] => {
      if (!isRecord(rawSession)) return [];
      const startedAt = validIsoString(rawSession.startedAt);
      if (!startedAt) return [];
      const startedMs = new Date(startedAt).getTime();
      const endedAt = validIsoString(rawSession.endedAt);
      const endedMs = endedAt ? new Date(endedAt).getTime() : now;
      if (endedMs <= startedMs) return [];
      return [{ buyerId, startedMs, endedMs, open: !endedAt }];
    });
  });
}

export function migrateLegacyHourlyBilling(
  value: unknown,
  rawBuyers: unknown,
  idMap: Map<string, BuyerId>,
  now: number,
  canRun: boolean,
): HourlyBilling {
  const source = isRecord(value) ? value : {};
  const intervals = legacyIntervals(rawBuyers, idMap, now);
  const boundaries = [...new Set(intervals.flatMap((interval) => [interval.startedMs, interval.endedMs]))]
    .sort((left, right) => left - right);
  const accruedByBuyer: Record<BuyerId, number> = {};

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startedMs = boundaries[index];
    const endedMs = boundaries[index + 1];
    const active = intervals.filter((interval) => interval.startedMs < endedMs && interval.endedMs > startedMs);
    if (active.length === 0) continue;
    const share = (endedMs - startedMs) / active.length;
    for (const interval of active) accruedByBuyer[interval.buyerId] = (accruedByBuyer[interval.buyerId] ?? 0) + share;
  }

  const timer = normalizeTimer(source.timer);
  const timerStartedMs = timer.lastStartedAt ? new Date(timer.lastStartedAt).getTime() : undefined;
  const running = canRun && timer.status === 'running';
  const accumulatedMs = timer.accumulatedMs + (
    timer.status === 'running' && timerStartedMs !== undefined ? Math.max(0, now - timerStartedMs) : 0
  );
  const openBuyerIds = new Set(intervals.filter((interval) => interval.open).map((interval) => interval.buyerId));
  const accountIds = new Set([...Object.keys(accruedByBuyer).map(Number), ...(running ? openBuyerIds : [])]);

  return {
    type: 'hourly',
    hourlyRateMesos: nonNegativeNumber(source.hourlyRateMesos, 12_000_000),
    ledger: {
      status: running ? 'running' : timer.status === 'idle' ? 'idle' : 'paused',
      accumulatedMs,
      checkpointAt: running ? now : undefined,
      accounts: Object.fromEntries([...accountIds].map((buyerId) => [buyerId, {
        accruedMs: accruedByBuyer[buyerId] ?? 0,
        active: running && openBuyerIds.has(buyerId),
      }])),
    },
  };
}
