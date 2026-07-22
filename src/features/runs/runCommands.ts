import { resetHourlyBilling } from '../../domain/calculator';
import { switchInstanceBillingType, updateInstanceBilling } from '../../domain/billing';
import type {
  BillingType,
  HourlyBilling,
  LeechInstance,
  RatioBilling,
} from '../../domain/types';
import { toggleHourlyBilling } from './billing/runBillingCommands';

export type RunUpdater = (run: LeechInstance) => LeechInstance;
export type UpdateRun = (runId: string, update: RunUpdater) => void;

export function renameRun(run: LeechInstance, name: string): LeechInstance {
  return run.name === name ? run : { ...run, name };
}

export function changeRunBillingType(
  run: LeechInstance,
  type: BillingType,
  now: number,
): LeechInstance {
  return switchInstanceBillingType(run, type, now);
}

export function updateRunRatioBilling(
  run: LeechInstance,
  update: (billing: RatioBilling) => RatioBilling,
): LeechInstance {
  if (run.billing.type !== 'ratio') return run;
  return updateInstanceBilling(run, update(run.billing));
}

export function updateRunHourlyBilling(
  run: LeechInstance,
  update: (billing: HourlyBilling) => HourlyBilling,
): LeechInstance {
  if (run.billing.type !== 'hourly') return run;
  return updateInstanceBilling(run, update(run.billing));
}

export function toggleRunHourlyTimer(run: LeechInstance, now: number): LeechInstance {
  if (run.billing.type !== 'hourly') return run;
  const activeBuyerIds = run.buyers
    .filter((buyer) => !buyer.locked && buyer.start)
    .map((buyer) => buyer.id);
  return updateInstanceBilling(run, toggleHourlyBilling(run.billing, activeBuyerIds, now));
}

export function resetRunHourlyTimer(run: LeechInstance): LeechInstance {
  if (run.billing.type !== 'hourly') return run;
  return updateInstanceBilling(run, resetHourlyBilling(run.billing));
}
