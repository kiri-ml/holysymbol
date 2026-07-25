import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatLocalDateTime } from '../../../domain/format';
import type { CharacterSnapshot } from '../../../domain/types';
import { CharacterProgressFields, normalizeLevelExp } from '../../../modules/character-progress';
import { IconButton } from '../../../ui/button';
import { Metric } from '../../../ui/metric';
import { Surface } from '../../../ui/surface';
import styles from './SnapshotEditor.module.css';
import type { DraftSnapshotState } from './snapshotDraft';
import { formatSnapshotShort } from './snapshotDraft';

export function SnapshotEditor({ title, tone, snapshot, draft, refreshLabel, refreshDisabled, refreshing, onDraftChange, onApplyDraft, onRefresh }: {
  title: string; tone: 'start' | 'current'; snapshot?: CharacterSnapshot; draft: DraftSnapshotState; refreshLabel: string; refreshDisabled: boolean; refreshing: boolean;
  onDraftChange: (value: DraftSnapshotState) => void; onApplyDraft: (value: DraftSnapshotState) => void; onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const sourceLabel = snapshot?.source === 'manual' ? t('snapshot.entered') : t('snapshot.refreshed');
  const updateDraft = (value: DraftSnapshotState) => {
    const normalized = normalizeLevelExp(value);
    onDraftChange(normalized);
    onApplyDraft(normalized);
  };
  return (
    <Surface className={styles.snapshot} radius="medium" padding="small" data-tone={tone}>
      <div className={styles.snapshotHead}>
        <Metric
          className={styles.snapshotMetric}
          label={title}
          displayValue={formatSnapshotShort(snapshot, t)}
          detail={snapshot ? `${formatLocalDateTime(snapshot.capturedAt)} · ${sourceLabel}` : t('snapshot.emptyPrompt')}
        />
        <IconButton variant="secondary" size="sm" onClick={onRefresh} disabled={refreshDisabled} loading={refreshing} icon={<RefreshCw size={15} />} aria-label={refreshLabel} />
      </div>
      <div className={styles.manualSnapshot}>
        <CharacterProgressFields
          value={draft}
          onChange={updateDraft}
          levelLabel={t('common.level')}
          expLabel={t('common.expPercent')}
        />
      </div>
    </Surface>
  );
}
