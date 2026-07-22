import type { BuyerId, LeechBuyer } from '../../types';
import { normalizeSnapshot, type SnapshotMetadata } from './snapshots';
import { isRecord, validNonNegativeInteger } from './values';

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

export type NormalizedBuyers = {
  buyers: LeechBuyer[];
  idMap: Map<string, BuyerId>;
  nextBuyerId: number;
};

export function normalizeBuyers(
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
