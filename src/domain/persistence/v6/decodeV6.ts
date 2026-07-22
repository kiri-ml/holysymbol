import type { BuyerId, HourlyBilling, HourlyLedger, LeechInstance } from '../../types';
import { normalizeBuyers } from '../shared/buyers';
import { normalizeRatioBilling } from '../shared/ratioBilling';
import {
  epochSecondsToIso,
  isNonNegativeFiniteNumber,
  isRecord,
  nonNegativeNumber,
  relativeSecondsToIso,
  validEpochMs,
  validEpochSeconds,
  validNonNegativeInteger,
} from '../shared/values';

function normalizeLedger(value: unknown, idMap: Map<string, BuyerId>): HourlyLedger {
  const source = isRecord(value) ? value : {};
  const status = source.s === 'r' || source.status === 'running'
    ? 'running'
    : source.s === 'p' || source.status === 'paused'
      ? 'paused'
      : 'idle';
  const rawAccounts = isRecord(source.a) ? source.a : isRecord(source.accounts) ? source.accounts : {};
  const accounts: HourlyLedger['accounts'] = {};

  for (const [rawBuyerId, accountValue] of Object.entries(rawAccounts)) {
    if (!isRecord(accountValue)) continue;
    const buyerId = idMap.get(rawBuyerId);
    if (buyerId === undefined) continue;
    accounts[buyerId] = {
      accruedMs: nonNegativeNumber(accountValue.m ?? accountValue.accruedMs),
      active: status === 'running' && (accountValue.r === 1 || accountValue.active === true),
    };
  }

  return {
    status,
    accumulatedMs: nonNegativeNumber(source.t ?? source.accumulatedMs),
    checkpointAt: status === 'running' ? validEpochMs(source.c ?? source.checkpointAt) : undefined,
    accounts,
  };
}

function normalizeHourlyBilling(value: unknown, idMap: Map<string, BuyerId>): HourlyBilling {
  const source = isRecord(value) ? value : {};
  return {
    type: 'hourly',
    hourlyRateMesos: nonNegativeNumber(source.r ?? source.hourlyRateMesos, 12_000_000),
    ledger: normalizeLedger(source.l ?? source.ledger, idMap),
  };
}

function isValidStoredBilling(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || !isNonNegativeFiniteNumber(value.r)) return false;
  if (value.t === 'r') return value.q === undefined || Array.isArray(value.q);
  if (value.t !== 'h' || !isRecord(value.l)) return false;
  const ledger = value.l;
  if (ledger.s !== 'i' && ledger.s !== 'r' && ledger.s !== 'p') return false;
  if (!isNonNegativeFiniteNumber(ledger.t) || !isRecord(ledger.a)) return false;
  if (ledger.s === 'r' && validEpochMs(ledger.c) === undefined) return false;
  return ledger.c === undefined || validEpochMs(ledger.c) !== undefined;
}

function validStoredBuyers(value: unknown): Record<string, unknown>[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const usedIds = new Set<number>();
  return value.flatMap((buyer) => {
    if (!isRecord(buyer) || validNonNegativeInteger(buyer.i) === undefined || typeof buyer.n !== 'string') return [];
    const buyerId = buyer.i as number;
    if (usedIds.has(buyerId)) return [];
    usedIds.add(buyerId);
    return [buyer];
  });
}

function decodeInstance(value: unknown): LeechInstance | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.i !== 'string' || value.i.length === 0 || typeof value.n !== 'string') return undefined;
  const createdAtEpochSeconds = validEpochSeconds(value.c);
  if (validNonNegativeInteger(value.d) === undefined || createdAtEpochSeconds === undefined) return undefined;
  if (!isValidStoredBilling(value.b)) return undefined;
  const rawBuyers = validStoredBuyers(value.u);
  if (!rawBuyers) return undefined;
  const normalizedBuyers = normalizeBuyers(rawBuyers, value.d, false, createdAtEpochSeconds);
  const billingRecord = value.b;
  const billing = billingRecord.t === 'h'
    ? normalizeHourlyBilling(billingRecord, normalizedBuyers.idMap)
    : normalizeRatioBilling(billingRecord);
  const compactInactive = isValidStoredBilling(value.x) ? value.x : undefined;
  const inactiveRatio = compactInactive?.t === 'r' ? normalizeRatioBilling(compactInactive) : undefined;
  const inactiveHourly = compactInactive?.t === 'h'
    ? normalizeHourlyBilling(compactInactive, normalizedBuyers.idMap)
    : undefined;
  const createdAt = epochSecondsToIso(createdAtEpochSeconds)!;
  const lastCurrentRefreshedAt = value.r === undefined
    ? undefined
    : relativeSecondsToIso(value.r, createdAtEpochSeconds);

  return {
    id: value.i,
    name: value.n,
    billing,
    inactiveBilling: {
      ratio: billing.type === 'ratio' ? billing : inactiveRatio,
      hourly: billing.type === 'hourly' ? billing : inactiveHourly,
    },
    buyers: normalizedBuyers.buyers,
    nextBuyerId: normalizedBuyers.nextBuyerId,
    createdAt,
    lastCurrentRefreshedAt,
  };
}

export function decodeV6Instances(value: unknown): LeechInstance[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (value.length === 0) return [];
  const instances = value.flatMap((instance) => {
    const decoded = decodeInstance(instance);
    return decoded ? [decoded] : [];
  });
  return instances.length > 0 ? instances : undefined;
}
