import type { CharacterBatch } from '../../api/legends';
import { buyerLookupIgn } from '../../domain/buyers';
import type {
  BillingType,
  BuyerId,
  CharacterSnapshot,
  HourlyBilling,
  LeechInstance,
  RatioBilling,
} from '../../domain/types';
import {
  addBuyerByIgn,
  addBuyerFromSnapshot,
  applyBuyerCurrentSnapshots,
  removeBuyerFromRun,
  setBuyerCompleted,
  setBuyerManualSnapshot,
  setBuyerSnapshot,
} from './buyers/buyerCommands';
import type { BuyerSnapshotKind } from './buyers/buyerCommands';
import type { DraftSnapshotState } from './buyers/snapshotDraft';
import {
  changeRunBillingType,
  renameRun,
  resetRunHourlyTimer,
  toggleRunHourlyTimer,
  updateRunHourlyBilling,
  updateRunRatioBilling,
} from './runCommands';
import type { UpdateRun } from './runCommands';
import { isoTimestamp, systemRunClock } from './runClock';
import type { RunClock } from './runClock';

export type RunBillingController = {
  changeType: (type: BillingType) => void;
  updateRatio: (update: (billing: RatioBilling) => RatioBilling) => void;
  updateHourly: (update: (billing: HourlyBilling) => HourlyBilling) => void;
  toggleTimer: () => void;
  resetTimer: () => void;
};

export type RunBuyerController = {
  add: (ign: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshSnapshot: (
    buyerId: BuyerId,
    kind: BuyerSnapshotKind,
    ign: string,
  ) => Promise<void>;
  setManualSnapshot: (
    buyerId: BuyerId,
    kind: BuyerSnapshotKind,
    draft: DraftSnapshotState,
    fallbackIgn: string,
  ) => void;
  setCompleted: (buyerId: BuyerId, completed: boolean) => void;
  remove: (buyerId: BuyerId) => void;
};

export type RunController = {
  rename: (name: string) => void;
  billing: RunBillingController;
  buyers: RunBuyerController;
};

export function createRunController({
  run,
  updateRun,
  fetchSnapshot,
  fetchSnapshots,
  clock = systemRunClock,
}: {
  run: LeechInstance;
  updateRun: UpdateRun;
  fetchSnapshot: (ign: string) => Promise<CharacterSnapshot>;
  fetchSnapshots: (igns: string[]) => Promise<CharacterBatch>;
  clock?: RunClock;
}): RunController {
  const runId = run.id;
  const apply = (update: (current: LeechInstance) => LeechInstance) => updateRun(runId, update);

  async function addBuyer(ign: string) {
    const cleanIgn = ign.trim();
    if (!cleanIgn) return;
    try {
      const snapshot = await fetchSnapshot(cleanIgn);
      const now = clock.nowMs();
      apply((current) => addBuyerFromSnapshot(current, snapshot, now));
    } catch {
      apply((current) => addBuyerByIgn(current, cleanIgn));
    }
  }

  async function refreshBuyers() {
    const igns = run.buyers
      .filter((buyer) => !buyer.locked)
      .map(buyerLookupIgn)
      .filter(Boolean);
    if (igns.length === 0) return;
    const batch = await fetchSnapshots(igns);
    const refreshedAt = batch.snapshots.size > 0 ? isoTimestamp(clock.nowMs()) : undefined;
    apply((current) => applyBuyerCurrentSnapshots(current, batch.snapshots, refreshedAt));
  }

  async function refreshBuyerSnapshot(
    buyerId: BuyerId,
    kind: BuyerSnapshotKind,
    ign: string,
  ) {
    const snapshot = await fetchSnapshot(ign);
    const now = clock.nowMs();
    apply((current) => setBuyerSnapshot(current, buyerId, kind, snapshot, now));
  }

  function setManualSnapshot(
    buyerId: BuyerId,
    kind: BuyerSnapshotKind,
    draft: DraftSnapshotState,
    fallbackIgn: string,
  ) {
    const now = clock.nowMs();
    apply((current) => setBuyerManualSnapshot(
      current,
      buyerId,
      kind,
      draft,
      fallbackIgn,
      isoTimestamp(now),
      now,
    ));
  }

  return {
    rename: (name) => apply((current) => renameRun(current, name)),
    billing: {
      changeType: (type) => {
        const now = clock.nowMs();
        apply((current) => changeRunBillingType(current, type, now));
      },
      updateRatio: (update) => apply((current) => updateRunRatioBilling(current, update)),
      updateHourly: (update) => apply((current) => updateRunHourlyBilling(current, update)),
      toggleTimer: () => {
        const now = clock.nowMs();
        apply((current) => toggleRunHourlyTimer(current, now));
      },
      resetTimer: () => apply(resetRunHourlyTimer),
    },
    buyers: {
      add: addBuyer,
      refreshAll: refreshBuyers,
      refreshSnapshot: refreshBuyerSnapshot,
      setManualSnapshot,
      setCompleted: (buyerId, completed) => {
        const now = clock.nowMs();
        apply((current) => setBuyerCompleted(current, buyerId, completed, now));
      },
      remove: (buyerId) => {
        const now = clock.nowMs();
        apply((current) => removeBuyerFromRun(current, buyerId, now));
      },
    },
  };
}
