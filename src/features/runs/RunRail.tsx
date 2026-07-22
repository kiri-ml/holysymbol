import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { calculateInstance } from '../../domain/calculator';
import { formatMesosShort } from '../../domain/format';
import type { LeechInstance } from '../../domain/types';
import { Button } from '../../ui/button';
import { SelectField } from '../../ui/fields';
import { HeadingGroup } from '../../ui/heading';
import { Surface } from '../../ui/surface';
import styles from './RunRail.module.css';
import { formatCompactRunBillingLabel, getRunDisplayName } from './runPresentation';

export function RunRail({ runs, selectedRunId, now, onSelect, onAdd }: {
  runs: LeechInstance[];
  selectedRunId: string | null;
  now: number;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const items = runs.map((run) => {
    const summary = calculateInstance(run, now);
    return {
      run,
      runName: getRunDisplayName(run),
      billingLabel: formatCompactRunBillingLabel(run.billing, t),
      dueLabel: formatMesosShort(summary.totalMesosDue),
      buyerCount: summary.buyerCount,
    };
  });

  return (
    <div className={styles.container}>
      <Surface
        as="aside"
        className={styles.root}
        variant="subtle"
        padding="small"
        aria-label={t('run.railLabel')}
      >
        <div className={styles.header}>
          <HeadingGroup
            eyebrow={t('run.railKicker')}
            title={t('run.active', { count: runs.length })}
            headingLevel={2}
            size="small"
          />
          <Button
            onClick={onAdd}
            icon={<Plus size={17} />}
            label={t('run.new')}
            labelMode="responsive"
            collapsePriority="high"
          />
        </div>

        <SelectField
          className={styles.picker}
          inputClassName={styles.pickerSelect}
          label={t('run.selected')}
          labelVisibility="screen-reader"
          size="lg"
          value={selectedRunId ?? ''}
          onChange={(event) => onSelect(event.target.value)}
        >
          {items.map(({ run, runName, billingLabel, dueLabel }) => (
            <option key={run.id} value={run.id}>{runName} · {billingLabel} · {dueLabel}</option>
          ))}
        </SelectField>

        <div className={styles.tabs}>
          {items.map(({ run, runName, billingLabel, dueLabel, buyerCount }) => {
            const selected = run.id === selectedRunId;
            return (
              <Button
                key={run.id}
                variant="ghost"
                className={styles.tab}
                data-active={selected || undefined}
                onClick={() => onSelect(run.id)}
                aria-current={selected ? 'true' : undefined}
                aria-label={runName}
                title={runName}
              >
                <span className={styles.details}>
                  <strong>{runName}</strong>
                  <small>{billingLabel}</small>
                </span>
                <span className={`${styles.details} ${styles.summary}`}>
                  <b>{dueLabel}</b>
                  <small>{t('buyer.count', { count: buyerCount })}</small>
                </span>
                <span className={styles.compactLabel} aria-hidden="true">{runName}</span>
              </Button>
            );
          })}
        </div>
      </Surface>
    </div>
  );
}
