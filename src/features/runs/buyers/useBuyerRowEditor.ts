import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../../app/confirmation';
import { buyerLookupIgn } from '../../../domain/buyers';
import { calculateBuyer, getBuyerBillableMs, isBuyerHourlyTimerRunning } from '../../../domain/calculator';
import type { BuyerId, LeechBilling, LeechBuyer } from '../../../domain/types';
import type { BuyerSnapshotKind } from './buyerCommands';
import { draftDiffersFromSnapshot } from './snapshotDraft';
import type { DraftSnapshotState } from './snapshotDraft';

type UseBuyerRowEditorOptions = {
  billing: LeechBilling;
  buyer: LeechBuyer;
  now: number;
  onRefreshSnapshot: (buyerId: BuyerId, kind: BuyerSnapshotKind, ign: string) => Promise<void>;
  onSetManualSnapshot: (
    buyerId: BuyerId,
    kind: BuyerSnapshotKind,
    draft: DraftSnapshotState,
    fallbackIgn: string,
  ) => void;
  onSetCompleted: (buyerId: BuyerId, completed: boolean) => void;
};

export function useBuyerRowEditor({
  billing,
  buyer,
  now,
  onRefreshSnapshot,
  onSetManualSnapshot,
  onSetCompleted,
}: UseBuyerRowEditorOptions) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [startDraft, setStartDraft] = useState<DraftSnapshotState>({
    level: buyer.start?.level ?? 120,
    expPercent: buyer.start?.expPercent ?? 0,
  });
  const [currentDraft, setCurrentDraft] = useState<DraftSnapshotState>({
    level: buyer.current?.level ?? buyer.start?.level ?? 120,
    expPercent: buyer.current?.expPercent ?? 0,
  });
  const [refreshingSnapshot, setRefreshingSnapshot] = useState<BuyerSnapshotKind | null>(null);
  const [completionPreviewSuppressed, setCompletionPreviewSuppressed] = useState(false);

  const calculation = calculateBuyer(buyer, billing, now);
  const due = billing.type === 'ratio' ? calculation.ratioMesosDue : calculation.hourlyMesosDue;
  const buyerBillableMs = billing.type === 'hourly' ? getBuyerBillableMs(billing, buyer.id, now) : undefined;
  const buyerTimerRunning = billing.type === 'hourly' && isBuyerHourlyTimerRunning(billing, buyer.id);
  const lookupIgn = buyerLookupIgn(buyer);
  const displayIgn = lookupIgn || t('buyer.fallback');
  const locked = buyer.locked ?? false;
  const job = buyer.current?.job ?? buyer.start?.job;
  const guild = buyer.current?.guild ?? buyer.start?.guild;

  useEffect(() => {
    if (buyer.start) setStartDraft({ level: buyer.start.level, expPercent: buyer.start.expPercent });
  }, [buyer.start?.capturedAt, buyer.start?.level, buyer.start?.expPercent]);

  useEffect(() => {
    if (buyer.current) setCurrentDraft({ level: buyer.current.level, expPercent: buyer.current.expPercent });
  }, [buyer.current?.capturedAt, buyer.current?.level, buyer.current?.expPercent]);

  async function refresh(kind: BuyerSnapshotKind) {
    if (kind === 'start' && buyer.start) {
      const confirmed = await confirm({
        title: t('snapshot.fetchStartExp'),
        message: t('confirm.refreshSnapshot', { label: t('common.start').toLowerCase() }),
        confirmLabel: t('common.refreshExp'),
      });
      if (!confirmed) return;
    }

    setRefreshingSnapshot(kind);
    try {
      await onRefreshSnapshot(buyer.id, kind, lookupIgn);
    } finally {
      setRefreshingSnapshot(null);
    }
  }

  function commitDraft(kind: BuyerSnapshotKind, draft: DraftSnapshotState) {
    const snapshot = kind === 'start' ? buyer.start : buyer.current;
    if (!draftDiffersFromSnapshot(draft, snapshot)) return;
    onSetManualSnapshot(buyer.id, kind, draft, t('buyer.entered'));
  }

  function toggleCompleted() {
    setCompletionPreviewSuppressed(true);
    onSetCompleted(buyer.id, !locked);
  }

  return {
    calculation,
    due,
    buyerBillableMs,
    buyerTimerRunning,
    lookupIgn,
    displayIgn,
    locked,
    job,
    guild,
    startDraft,
    currentDraft,
    refreshingSnapshot,
    completionPreviewSuppressed,
    setStartDraft,
    setCurrentDraft,
    refreshStart: () => refresh('start'),
    refreshCurrent: () => refresh('current'),
    commitStartDraft: (draft: DraftSnapshotState) => commitDraft('start', draft),
    commitCurrentDraft: (draft: DraftSnapshotState) => commitDraft('current', draft),
    toggleCompleted,
    clearCompletionPreview: () => setCompletionPreviewSuppressed(false),
  };
}
