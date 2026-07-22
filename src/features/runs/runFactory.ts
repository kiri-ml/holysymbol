import { DEFAULT_RATIO_BILLING } from '../../domain/billing';
import { createId } from '../../domain/id';
import type { LeechBilling, LeechBuyer, LeechInstance } from '../../domain/types';

export function createEmptyRun(
  createdAt: string,
  billing: LeechBilling = DEFAULT_RATIO_BILLING,
  id = createId('leech'),
): LeechInstance {
  return {
    id,
    name: '',
    billing,
    buyers: [],
    nextBuyerId: 0,
    createdAt,
  };
}

export function createInitialRuns(createdAt: string): LeechInstance[] {
  return [createEmptyRun(createdAt)];
}

export function isEmptyBuyer(buyer: LeechBuyer) {
  return !buyer.ign.trim() && !buyer.start && !buyer.current;
}

export function isEmptyRun(run: LeechInstance) {
  if (run.buyers.some((buyer) => !isEmptyBuyer(buyer))) return false;
  if (run.billing.type !== 'hourly') return true;
  return run.billing.ledger.status === 'idle' && run.billing.ledger.accumulatedMs === 0;
}

export function runCreatedAtMs(run: LeechInstance) {
  const ms = new Date(run.createdAt).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function sortRunsByCreatedAt(runs: LeechInstance[]) {
  return [...runs].sort((left, right) => runCreatedAtMs(right) - runCreatedAtMs(left));
}
