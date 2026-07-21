// Shared normalization implementation used by the versioned persistence layers.
import type {
  CharacterSnapshot,
  BuyerId,
  HourlyBilling,
  HourlyLedger,
  LeechBuyer,
  LeechInstance,
  RatioBilling,
  TimerStatus,
} from './types';

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

function validEpochMs(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function validIntegerSeconds(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function validEpochSeconds(value: unknown) {
  const seconds = validIntegerSeconds(value);
  if (seconds === undefined || seconds < 0) return undefined;
  return Number.isFinite(new Date(seconds * 1000).getTime()) ? seconds : undefined;
}

function validNonNegativeInteger(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function epochToIso(value: unknown) {
  const epochMs = validEpochMs(value);
  return epochMs === undefined ? undefined : new Date(epochMs).toISOString();
}

function epochSecondsToIso(value: unknown) {
  const seconds = validEpochSeconds(value);
  return seconds === undefined ? undefined : new Date(seconds * 1000).toISOString();
}

function relativeSecondsToIso(value: unknown, baseEpochSeconds: number) {
  const offsetSeconds = validIntegerSeconds(value);
  if (offsetSeconds === undefined) return undefined;
  const epochMs = (baseEpochSeconds + offsetSeconds) * 1000;
  return Number.isFinite(new Date(epochMs).getTime()) ? new Date(epochMs).toISOString() : undefined;
}

type LegacyTimer = { status: TimerStatus; accumulatedMs: number; lastStartedAt?: string };

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

type SnapshotMetadata = Pick<CharacterSnapshot, 'ign' | 'job' | 'guild'>;

function normalizeSnapshot(
  value: unknown,
  metadata: SnapshotMetadata,
  baseEpochSeconds?: number,
): CharacterSnapshot | undefined {
  const tuple = Array.isArray(value) ? value : undefined;
  const record = isRecord(value) ? value : {};
  const level = tuple ? tuple[0] : typeof record.l === 'number' ? record.l : record.level;
  const expPercent = tuple ? tuple[1] : typeof record.e === 'number' ? record.e : record.expPercent;
  const capturedAt = tuple
    ? baseEpochSeconds === undefined ? epochToIso(tuple[2]) : relativeSecondsToIso(tuple[2], baseEpochSeconds)
    : epochToIso(record.t) ?? validIsoString(record.capturedAt);
  const source = tuple
    ? tuple[3] === 0 ? 'api' : tuple[3] === 1 ? 'manual' : undefined
    : record.s === 'a' || record.source === 'api'
      ? 'api'
      : record.s === 'm' || record.source === 'manual'
        ? 'manual'
        : undefined;
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 200) return undefined;
  if (typeof expPercent !== 'number' || !Number.isFinite(expPercent)) return undefined;
  if (!capturedAt || !source) return undefined;
  const ign = typeof record.n === 'string' ? record.n : typeof record.ign === 'string' ? record.ign : metadata.ign;
  const job = typeof record.j === 'string' ? record.j : typeof record.job === 'string' ? record.job : metadata.job;
  const guild = typeof record.g === 'string' ? record.g : typeof record.guild === 'string' ? record.guild : metadata.guild;
  return { ign, level, expPercent, job, guild, capturedAt, source };
}

function normalizeBuyer(value: unknown, id: BuyerId, baseEpochSeconds?: number): LeechBuyer | undefined {
  if (!isRecord(value)) return undefined;
  const compact = 'i' in value || 'n' in value;
  const ign = typeof value.n === 'string' ? value.n : typeof value.ign === 'string' ? value.ign : '';
  const metadata: SnapshotMetadata = compact ? { ign } : {
    ign,
    job: typeof value.j === 'string' ? value.j : undefined,
    guild: typeof value.g === 'string' ? value.g : undefined,
  };
  const start = normalizeSnapshot(compact ? value.s : value.start, metadata, baseEpochSeconds);
  const current = normalizeSnapshot(compact ? value.c : value.current, metadata, baseEpochSeconds);
  if (compact) {
    const displaySnapshot = current ?? start;
    if (displaySnapshot) {
      if (typeof value.j === 'string') displaySnapshot.job = value.j;
      if (typeof value.g === 'string') displaySnapshot.guild = value.g;
    }
  }
  return {
    id,
    ign,
    locked: compact ? value.l === 1 || undefined : typeof value.locked === 'boolean' ? value.locked : undefined,
    start,
    current,
  };
}

type NormalizedBuyers = {
  buyers: LeechBuyer[];
  idMap: Map<string, BuyerId>;
  nextBuyerId: number;
};

function normalizeBuyers(
  value: unknown,
  storedNextBuyerId?: unknown,
  forceSequential = false,
  baseEpochSeconds?: number,
): NormalizedBuyers {
  if (!Array.isArray(value)) return { buyers: [], idMap: new Map(), nextBuyerId: 0 };
  const used = new Set<BuyerId>();
  const idMap = new Map<string, BuyerId>();
  const buyers: LeechBuyer[] = [];
  let nextAvailable = 0;

  for (const rawBuyer of value) {
    if (!isRecord(rawBuyer)) continue;
    const rawId = rawBuyer.i ?? rawBuyer.id;
    const numericId = !forceSequential && typeof rawId === 'number' && Number.isSafeInteger(rawId) && rawId >= 0 && !used.has(rawId)
      ? rawId
      : undefined;
    while (used.has(nextAvailable)) nextAvailable += 1;
    const buyerId = numericId ?? nextAvailable;
    used.add(buyerId);
    nextAvailable = Math.max(nextAvailable, buyerId + 1);
    if (!idMap.has(String(rawId))) idMap.set(String(rawId), buyerId);
    const buyer = normalizeBuyer(rawBuyer, buyerId, baseEpochSeconds);
    if (buyer) buyers.push(buyer);
  }

  const storedNext = validNonNegativeInteger(storedNextBuyerId);
  return { buyers, idMap, nextBuyerId: Math.max(nextAvailable, storedNext ?? 0) };
}

function normalizeRatioBilling(value: unknown): RatioBilling {
  const source = isRecord(value) ? value : {};
  const tiersByLevel = new Map<number, number>();

  const rawTiers = Array.isArray(source.q)
    ? source.q.map((tier) => Array.isArray(tier) ? { minLevel: tier[0], expPerMesoRatio: tier[1] } : tier)
    : source.tiers;
  if (Array.isArray(rawTiers)) {
    for (const value of rawTiers) {
      if (!isRecord(value) || typeof value.minLevel !== 'number' || !Number.isFinite(value.minLevel)) continue;
      if (typeof value.expPerMesoRatio !== 'number' || !Number.isFinite(value.expPerMesoRatio)) continue;
      const minLevel = Math.max(1, Math.min(200, Math.round(value.minLevel)));
      tiersByLevel.set(minLevel, Math.max(0, value.expPerMesoRatio));
    }
  }

  return {
    type: 'ratio',
    expPerMesoRatio: nonNegativeNumber(source.r ?? source.expPerMesoRatio, 3.3),
    tiers: [...tiersByLevel.entries()]
      .sort(([left], [right]) => left - right)
      .map(([minLevel, expPerMesoRatio]) => ({ minLevel, expPerMesoRatio })),
  };
}

function normalizeLedger(value: unknown, idMap: Map<string, BuyerId>): HourlyLedger {
  const source = isRecord(value) ? value : {};
  const status = source.s === 'r' || source.status === 'running'
    ? 'running'
    : source.s === 'p' || source.status === 'paused'
      ? 'paused'
      : 'idle';
  const rawAccounts = isRecord(source.a) ? source.a : isRecord(source.accounts) ? source.accounts : {};
  const accounts: HourlyLedger['accounts'] = {};

  for (const [rawBuyerId, value] of Object.entries(rawAccounts)) {
    if (!isRecord(value)) continue;
    const buyerId = idMap.get(rawBuyerId);
    if (buyerId === undefined) continue;
    accounts[buyerId] = {
      accruedMs: nonNegativeNumber(value.m ?? value.accruedMs),
      active: status === 'running' && (value.r === 1 || value.active === true),
    };
  }

  return {
    status,
    accumulatedMs: nonNegativeNumber(source.t ?? source.accumulatedMs),
    checkpointAt: status === 'running' ? validEpochMs(source.c ?? source.checkpointAt) : undefined,
    accounts,
  };
}

function normalizeHourlyBillingV6(value: unknown, idMap: Map<string, BuyerId>): HourlyBilling {
  const source = isRecord(value) ? value : {};
  return {
    type: 'hourly',
    hourlyRateMesos: nonNegativeNumber(source.r ?? source.hourlyRateMesos, 12_000_000),
    ledger: normalizeLedger(source.l ?? source.ledger, idMap),
  };
}

function isValidStoredBillingV6(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || !isNonNegativeFiniteNumber(value.r)) return false;
  if (value.t === 'r') return value.q === undefined || Array.isArray(value.q);
  if (value.t !== 'h' || !isRecord(value.l)) return false;
  const ledger = value.l;
  if (ledger.s !== 'i' && ledger.s !== 'r' && ledger.s !== 'p') return false;
  if (!isNonNegativeFiniteNumber(ledger.t) || !isRecord(ledger.a)) return false;
  if (ledger.s === 'r' && validEpochMs(ledger.c) === undefined) return false;
  return ledger.c === undefined || validEpochMs(ledger.c) !== undefined;
}

function validStoredBuyersV6(value: unknown): Record<string, unknown>[] | undefined {
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

function normalizeInstanceV6(value: unknown): LeechInstance | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.i !== 'string' || value.i.length === 0 || typeof value.n !== 'string') return undefined;
  const createdAtEpochSeconds = validEpochSeconds(value.c);
  if (validNonNegativeInteger(value.d) === undefined || createdAtEpochSeconds === undefined) return undefined;
  if (!isValidStoredBillingV6(value.b)) return undefined;
  const rawBuyers = validStoredBuyersV6(value.u);
  if (!rawBuyers) return undefined;
  const normalizedBuyers = normalizeBuyers(rawBuyers, value.d, false, createdAtEpochSeconds);
  const billingRecord = value.b;
  const billing = billingRecord.t === 'h'
    ? normalizeHourlyBillingV6(billingRecord, normalizedBuyers.idMap)
    : normalizeRatioBilling(billingRecord);
  const compactInactive = isValidStoredBillingV6(value.x) ? value.x : undefined;
  const inactiveRatio = compactInactive?.t === 'r'
    ? normalizeRatioBilling(compactInactive)
    : undefined;
  const inactiveHourly = compactInactive?.t === 'h'
    ? normalizeHourlyBillingV6(compactInactive, normalizedBuyers.idMap)
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

export function normalizeInstances(value: unknown, fallback: LeechInstance[]): LeechInstance[] {
  if (!Array.isArray(value)) return fallback;
  if (value.length === 0) return [];
  const instances = value.flatMap((instance) => {
    const normalized = normalizeInstanceV6(instance);
    return normalized ? [normalized] : [];
  });
  return instances.length > 0 ? instances : fallback;
}

type LegacyInterval = { buyerId: BuyerId; startedMs: number; endedMs: number; open: boolean };

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

function migrateLegacyHourlyBilling(
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

function migrateInstanceV5(value: unknown, now: number): LeechInstance | undefined {
  if (!isRecord(value)) return undefined;
  const normalizedBuyers = normalizeBuyers(value.buyers, undefined, true);
  const billingRecord = isRecord(value.billing) ? value.billing : {};
  const isHourly = billingRecord.type === 'hourly';
  const billing = isHourly
    ? migrateLegacyHourlyBilling(billingRecord, value.buyers, normalizedBuyers.idMap, now, true)
    : normalizeRatioBilling(billingRecord);
  const inactiveRecord = isRecord(value.inactiveBilling) ? value.inactiveBilling : {};
  const inactiveRatio = isRecord(inactiveRecord.ratio) && inactiveRecord.ratio.type === 'ratio'
    ? normalizeRatioBilling(inactiveRecord.ratio)
    : undefined;
  const inactiveHourly = isRecord(inactiveRecord.hourly) && inactiveRecord.hourly.type === 'hourly'
    ? migrateLegacyHourlyBilling(inactiveRecord.hourly, value.buyers, normalizedBuyers.idMap, now, false)
    : undefined;

  return {
    id: typeof value.id === 'string' ? value.id : '',
    name: typeof value.name === 'string' ? value.name : '',
    billing,
    inactiveBilling: {
      ratio: billing.type === 'ratio' ? billing : inactiveRatio,
      hourly: billing.type === 'hourly' ? billing : inactiveHourly,
    },
    buyers: normalizedBuyers.buyers,
    nextBuyerId: normalizedBuyers.nextBuyerId,
    createdAt: validIsoString(value.createdAt) ?? new Date(now).toISOString(),
    lastCurrentRefreshedAt: validIsoString(value.lastCurrentRefreshedAt),
  };
}

export function migrateV5Instances(value: unknown, fallback: LeechInstance[], now = Date.now()): LeechInstance[] {
  if (!Array.isArray(value)) return fallback;
  const instances = value.flatMap((instance) => {
    const migrated = migrateInstanceV5(instance, now);
    return migrated ? [migrated] : [];
  });
  return instances.length > 0 ? instances : fallback;
}

function encodeHourlyBilling(billing: HourlyBilling) {
  return {
    t: 'h' as const,
    r: billing.hourlyRateMesos,
    l: {
      s: billing.ledger.status === 'running' ? 'r' : billing.ledger.status === 'paused' ? 'p' : 'i',
      t: billing.ledger.accumulatedMs,
      ...(billing.ledger.checkpointAt === undefined ? {} : { c: billing.ledger.checkpointAt }),
      a: Object.fromEntries(Object.entries(billing.ledger.accounts).map(([buyerId, account]) => [
        buyerId,
        { m: account.accruedMs, ...(account.active ? { r: 1 as const } : {}) },
      ])),
    },
  };
}

function encodeRatioBilling(billing: RatioBilling) {
  return {
    t: 'r' as const,
    r: billing.expPerMesoRatio,
    ...(billing.tiers.length === 0 ? {} : {
      q: billing.tiers.map((tier): [number, number] => [tier.minLevel, tier.expPerMesoRatio]),
    }),
  };
}

function encodeBilling(billing: HourlyBilling | RatioBilling) {
  return billing.type === 'hourly' ? encodeHourlyBilling(billing) : encodeRatioBilling(billing);
}

function epochMs(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function epochSeconds(value: string) {
  return Math.floor(epochMs(value) / 1000);
}

function encodeSnapshot(snapshot: CharacterSnapshot, createdAtEpochSeconds: number): [number, number, number, 0 | 1] {
  return [
    snapshot.level,
    snapshot.expPercent,
    epochSeconds(snapshot.capturedAt) - createdAtEpochSeconds,
    snapshot.source === 'api' ? 0 : 1,
  ];
}

function encodeBuyer(buyer: LeechBuyer, createdAtEpochSeconds: number) {
  const ign = (buyer.ign || buyer.current?.ign || buyer.start?.ign || '').trim();
  const job = buyer.current?.job ?? buyer.start?.job;
  const guild = buyer.current?.guild ?? buyer.start?.guild;
  return {
    i: buyer.id,
    n: ign,
    ...(buyer.locked ? { l: 1 as const } : {}),
    ...(job === undefined ? {} : { j: job }),
    ...(guild === undefined ? {} : { g: guild }),
    ...(buyer.start ? { s: encodeSnapshot(buyer.start, createdAtEpochSeconds) } : {}),
    ...(buyer.current ? { c: encodeSnapshot(buyer.current, createdAtEpochSeconds) } : {}),
  };
}

export function encodeInstances(instances: LeechInstance[]): unknown[] {
  return instances.map((instance) => {
    const createdAtEpochSeconds = epochSeconds(instance.createdAt);
    const inactiveBilling = instance.billing.type === 'hourly'
      ? instance.inactiveBilling?.ratio
      : instance.inactiveBilling?.hourly;
    return {
      i: instance.id,
      n: instance.name,
      b: encodeBilling(instance.billing),
      u: instance.buyers.map((buyer) => encodeBuyer(buyer, createdAtEpochSeconds)),
      d: instance.nextBuyerId,
      c: createdAtEpochSeconds,
      ...(instance.lastCurrentRefreshedAt ? {
        r: epochSeconds(instance.lastCurrentRefreshedAt) - createdAtEpochSeconds,
      } : {}),
      ...(inactiveBilling ? { x: encodeBilling(inactiveBilling) } : {}),
    };
  });
}
