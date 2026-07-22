import { applyCurrentSnapshots } from '../../../domain/buyers';
import { createManualSnapshot } from '../../../domain/character';
import { removeHourlyAccount, setHourlyAccountActive } from '../../../domain/calculator';
import { updateInstanceBilling } from '../../../domain/billing';
import type {
  BuyerId,
  CharacterSnapshot,
  LeechBuyer,
  LeechInstance,
} from '../../../domain/types';
import { clampLevel, clampPercent } from '../../../modules/character-progress';
import type { DraftSnapshotState } from './snapshotDraft';

export type BuyerSnapshotKind = 'start' | 'current';

function replaceBuyer(
  run: LeechInstance,
  buyerId: BuyerId,
  update: (buyer: LeechBuyer) => LeechBuyer,
): LeechInstance {
  let changed = false;
  const buyers = run.buyers.map((buyer) => {
    if (buyer.id !== buyerId) return buyer;
    changed = true;
    return update(buyer);
  });
  return changed ? { ...run, buyers } : run;
}

function updateBuyerAccount(
  run: LeechInstance,
  buyerId: BuyerId,
  active: boolean | undefined,
  now: number,
): LeechInstance {
  if (run.billing.type !== 'hourly' || active === undefined) return run;
  return updateInstanceBilling(run, setHourlyAccountActive(run.billing, buyerId, active, now));
}

export function addBuyerFromSnapshot(
  run: LeechInstance,
  snapshot: CharacterSnapshot,
  now: number,
): LeechInstance {
  const buyer: LeechBuyer = {
    id: run.nextBuyerId,
    ign: snapshot.ign,
    start: snapshot,
    current: snapshot,
  };
  const withBuyer = {
    ...run,
    buyers: [...run.buyers, buyer],
    nextBuyerId: run.nextBuyerId + 1,
  };
  const shouldActivate = run.billing.type === 'hourly' && run.billing.ledger.status === 'running';
  return updateBuyerAccount(withBuyer, buyer.id, shouldActivate ? true : undefined, now);
}

export function addBuyerByIgn(run: LeechInstance, ign: string): LeechInstance {
  const buyer: LeechBuyer = { id: run.nextBuyerId, ign: ign.trim() };
  return {
    ...run,
    buyers: [...run.buyers, buyer],
    nextBuyerId: run.nextBuyerId + 1,
  };
}

export function applyBuyerCurrentSnapshots(
  run: LeechInstance,
  snapshots: ReadonlyMap<string, CharacterSnapshot>,
  refreshedAt?: string,
): LeechInstance {
  return {
    ...run,
    buyers: applyCurrentSnapshots(run.buyers, snapshots),
    lastCurrentRefreshedAt: snapshots.size > 0
      ? refreshedAt ?? run.lastCurrentRefreshedAt
      : run.lastCurrentRefreshedAt,
  };
}

export function setBuyerSnapshot(
  run: LeechInstance,
  buyerId: BuyerId,
  kind: BuyerSnapshotKind,
  snapshot: CharacterSnapshot,
  now: number,
): LeechInstance {
  const currentBuyer = run.buyers.find((buyer) => buyer.id === buyerId);
  if (!currentBuyer) return run;

  const nextRun = replaceBuyer(run, buyerId, (buyer) => kind === 'start'
    ? {
        ...buyer,
        ign: snapshot.ign,
        start: snapshot,
        current: buyer.current ?? snapshot,
      }
    : {
        ...buyer,
        ign: snapshot.ign,
        current: snapshot,
      });

  if (kind !== 'start') return nextRun;
  const shouldActivate = run.billing.type === 'hourly'
    && run.billing.ledger.status === 'running'
    && !currentBuyer.locked;
  return updateBuyerAccount(nextRun, buyerId, shouldActivate ? true : undefined, now);
}

export function setBuyerManualSnapshot(
  run: LeechInstance,
  buyerId: BuyerId,
  kind: BuyerSnapshotKind,
  draft: DraftSnapshotState,
  fallbackIgn: string,
  capturedAt: string,
  now: number,
): LeechInstance {
  const buyer = run.buyers.find((item) => item.id === buyerId);
  if (!buyer) return run;
  const ign = (buyer.ign || buyer.start?.ign || buyer.current?.ign || fallbackIgn).trim();
  const snapshot = createManualSnapshot({
    ign,
    level: clampLevel(draft.level),
    expPercent: clampPercent(draft.expPercent),
    capturedAt,
  });
  return setBuyerSnapshot(run, buyerId, kind, snapshot, now);
}

export function setBuyerCompleted(
  run: LeechInstance,
  buyerId: BuyerId,
  completed: boolean,
  now: number,
): LeechInstance {
  const buyer = run.buyers.find((item) => item.id === buyerId);
  if (!buyer) return run;
  const withStatus = replaceBuyer(run, buyerId, (current) => ({ ...current, locked: completed }));
  if (run.billing.type !== 'hourly') return withStatus;
  const active = !completed && run.billing.ledger.status === 'running' && Boolean(buyer.start);
  return updateBuyerAccount(withStatus, buyerId, active, now);
}

export function removeBuyerFromRun(
  run: LeechInstance,
  buyerId: BuyerId,
  now: number,
): LeechInstance {
  const withoutBuyer = { ...run, buyers: run.buyers.filter((buyer) => buyer.id !== buyerId) };
  if (withoutBuyer.buyers.length === run.buyers.length) return run;
  if (run.billing.type === 'hourly') {
    return updateInstanceBilling(withoutBuyer, removeHourlyAccount(run.billing, buyerId, now));
  }
  return {
    ...withoutBuyer,
    inactiveBilling: run.inactiveBilling?.hourly ? {
      ...run.inactiveBilling,
      hourly: removeHourlyAccount(run.inactiveBilling.hourly, buyerId, now),
    } : run.inactiveBilling,
  };
}
