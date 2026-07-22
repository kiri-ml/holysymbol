import { CircleCheckBig, CircleDashed, Trash2, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { avatarUrl } from '../../../api/legends';
import { formatCompact, formatDuration, formatExp, formatLocalDateTime } from '../../../domain/format';
import type { BuyerId, LeechBilling, LeechBuyer } from '../../../domain/types';
import { Button } from '../../../ui/button';
import { classNames } from '../../../ui/classNames';
import { CopyMesosMetric, Metric, MetricGroup } from '../../../ui/metric';
import { Surface } from '../../../ui/surface';
import type { BuyerSnapshotKind } from './buyerCommands';
import styles from './BuyerRow.module.css';
import { SnapshotEditor } from './SnapshotEditor';
import { formatSnapshotShort } from './snapshotDraft';
import type { DraftSnapshotState } from './snapshotDraft';
import { useBuyerRowEditor } from './useBuyerRowEditor';

export function BuyerRow({
  billing,
  buyer,
  busy,
  now,
  onRefreshSnapshot,
  onSetManualSnapshot,
  onSetCompleted,
  onDelete,
}: {
  billing: LeechBilling;
  buyer: LeechBuyer;
  busy: boolean;
  now: number;
  onRefreshSnapshot: (buyerId: BuyerId, kind: BuyerSnapshotKind, ign: string) => Promise<void>;
  onSetManualSnapshot: (
    buyerId: BuyerId,
    kind: BuyerSnapshotKind,
    draft: DraftSnapshotState,
    fallbackIgn: string,
  ) => void;
  onSetCompleted: (buyerId: BuyerId, completed: boolean) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const editor = useBuyerRowEditor({
    billing,
    buyer,
    now,
    onRefreshSnapshot,
    onSetManualSnapshot,
    onSetCompleted,
  });

  return (
    <Surface as="article" className={styles.card} padding="none">
      <div className={styles.main} data-locked={editor.locked || undefined}>
        <div className={styles.identity}>
          {editor.lookupIgn ? (
            <div className={styles.avatar}><img src={avatarUrl(editor.lookupIgn, !editor.locked)} alt="" loading="lazy" /></div>
          ) : (
            <div className={classNames(styles.avatar, styles.avatarEmpty)}><UserPlus size={18} /></div>
          )}
          <div className={styles.name}>
            <strong>{buyer.ign || t('buyer.placeholderName')}</strong>
            {editor.job || editor.guild ? (
              <div className={styles.characterMeta}>
                {editor.job ? <span aria-label={t('aria.job', { job: editor.job })} title={editor.job}>{editor.job}</span> : null}
                {editor.guild ? <span aria-label={t('aria.guild', { guild: editor.guild })} title={editor.guild}>{editor.guild}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
        <MetricGroup className={styles.metrics} columns={4} padding="small">
          <Metric className={styles.stat} label={t('common.start')} displayValue={formatSnapshotShort(buyer.start, t)} detail={buyer.start ? formatLocalDateTime(buyer.start.capturedAt) : undefined} />
          <Metric className={styles.stat} label={t('common.current')} displayValue={formatSnapshotShort(buyer.current, t)} detail={buyer.current ? formatLocalDateTime(buyer.current.capturedAt) : undefined} />
          {billing.type === 'hourly' ? (
            <Metric className={styles.stat} label={t('buyer.billableTime')} displayValue={formatDuration(editor.buyerBillableMs)} detail={editor.buyerTimerRunning ? t('timer.running') : t('timer.paused')} />
          ) : (
            <Metric className={styles.stat} label={t('buyer.expGained')} displayValue={formatCompact(editor.calculation.expGained)} detail={formatExp(editor.calculation.expGained)} />
          )}
          <CopyMesosMetric
            className={styles.stat}
            format="precise"
            value={editor.due}
            label={t('common.due')}
            copiedLabel={t('common.copied')}
            copyAriaLabel={t('aria.copyDue', { name: editor.displayIgn })}
            copiedAriaLabel={t('aria.dueCopied', { name: editor.displayIgn })}
          />
        </MetricGroup>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            className={classNames(styles.actionButton, styles.completion)}
            data-done={editor.locked || undefined}
            data-preview-suppressed={editor.completionPreviewSuppressed || undefined}
            onClick={editor.toggleCompleted}
            onPointerLeave={editor.clearCompletionPreview}
            onBlur={editor.clearCompletionPreview}
            aria-label={editor.locked ? t('aria.reopenBuyer', { name: editor.displayIgn }) : t('aria.markBuyerDone', { name: editor.displayIgn })}
            aria-pressed={editor.locked}
            icon={<><span className={styles.completionState}>{editor.locked ? <CircleCheckBig size={16} /> : <CircleDashed size={16} />}</span><span className={styles.completionAction}>{editor.locked ? <CircleDashed size={16} /> : <CircleCheckBig size={16} />}</span></>}
            label={editor.locked ? t('buyer.completed') : t('buyer.active')}
            labelMode="responsive"
          />
          <Button
            variant="danger"
            className={styles.actionButton}
            onClick={onDelete}
            aria-label={t('aria.removeBuyer', { name: editor.displayIgn })}
            icon={<Trash2 size={16} />}
            label={t('buyer.delete')}
            labelMode="responsive"
          />
        </div>
      </div>

      {!editor.locked ? (
        <details className={styles.details}>
          <summary>{t('buyer.edit')}</summary>
          <div className={styles.snapshotGrid}>
            <SnapshotEditor
              title={t('common.start')}
              tone="start"
              snapshot={buyer.start}
              draft={editor.startDraft}
              refreshLabel={t('snapshot.fetchStartExp')}
              refreshDisabled={busy || !editor.lookupIgn}
              refreshing={editor.refreshingSnapshot === 'start'}
              onDraftChange={editor.setStartDraft}
              onCommitDraft={editor.commitStartDraft}
              onRefresh={() => void editor.refreshStart()}
            />
            <SnapshotEditor
              title={t('common.current')}
              tone="current"
              snapshot={buyer.current}
              draft={editor.currentDraft}
              refreshLabel={t('snapshot.refreshExp')}
              refreshDisabled={busy || !editor.lookupIgn}
              refreshing={editor.refreshingSnapshot === 'current'}
              onDraftChange={editor.setCurrentDraft}
              onCommitDraft={editor.commitCurrentDraft}
              onRefresh={() => void editor.refreshCurrent()}
            />
          </div>
        </details>
      ) : null}
    </Surface>
  );
}
