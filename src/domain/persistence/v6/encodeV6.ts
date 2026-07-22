import type { CharacterSnapshot, HourlyBilling, LeechBuyer, LeechInstance, RatioBilling } from '../../types';
import type {
  StoredBillingV6,
  StoredBuyerV6,
  StoredHourlyBillingV6,
  StoredInstanceV6,
  StoredRatioBillingV6,
  StoredSnapshotV6,
} from './schema';

function encodeHourlyBilling(billing: HourlyBilling): StoredHourlyBillingV6 {
  return {
    t: 'h',
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

function encodeRatioBilling(billing: RatioBilling): StoredRatioBillingV6 {
  return {
    t: 'r',
    r: billing.expPerMesoRatio,
    ...(billing.tiers.length === 0 ? {} : {
      q: billing.tiers.map((tier): [number, number] => [tier.minLevel, tier.expPerMesoRatio]),
    }),
  };
}

function encodeBilling(billing: HourlyBilling | RatioBilling): StoredBillingV6 {
  return billing.type === 'hourly' ? encodeHourlyBilling(billing) : encodeRatioBilling(billing);
}

function epochMs(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function epochSeconds(value: string) {
  return Math.floor(epochMs(value) / 1000);
}

function encodeSnapshot(snapshot: CharacterSnapshot, createdAtEpochSeconds: number): StoredSnapshotV6 {
  return [
    snapshot.level,
    snapshot.expPercent,
    epochSeconds(snapshot.capturedAt) - createdAtEpochSeconds,
    snapshot.source === 'api' ? 0 : 1,
  ];
}

function encodeBuyer(buyer: LeechBuyer, createdAtEpochSeconds: number): StoredBuyerV6 {
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

export function encodeV6Instances(instances: LeechInstance[]): StoredInstanceV6[] {
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
