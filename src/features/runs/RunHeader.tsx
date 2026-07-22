import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatLocalDateTime } from '../../domain/format';
import type { BillingType, LeechInstance } from '../../domain/types';
import { PricingModeControl } from '../../modules/pricing';
import { IconButton } from '../../ui/button';
import styles from './RunEditor.module.css';
import { formatCompactRunBillingLabel, formatRunBillingLabel } from './runPresentation';

export function RunHeader({ run, index, onRename, onChangeBillingType, onDelete }: {
  run: LeechInstance; index: number; onRename: (name: string) => void; onChangeBillingType: (type: BillingType) => void; onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.header}>
      <div className={styles.heading}>
        <input
          className={styles.title}
          data-empty={!run.name.trim() || undefined}
          value={run.name}
          placeholder={t('common.untitled')}
          onChange={(event) => onRename(event.target.value)}
          aria-label={t('run.nameLabel', { number: index + 1 })}
        />
        <p className={styles.createdAt}>
          {run.billing.type === 'ratio' ? t('billing.ratioModeSummary', { label: formatCompactRunBillingLabel(run.billing, t) }) : t('billing.hourlyModeSummary', { label: formatRunBillingLabel(run.billing, t) })}
          {' · '}{t('run.created', { date: formatLocalDateTime(run.createdAt) })}
        </p>
      </div>
      <div className={styles.actions}>
        <PricingModeControl className={styles.modeControl} value={run.billing.type} ariaLabel={t('billing.type')} onChange={onChangeBillingType} />
        <IconButton variant="danger" onClick={onDelete} icon={<Trash2 size={16} />} aria-label={t('run.delete')} />
      </div>
    </div>
  );
}
