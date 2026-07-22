import { useTranslation } from 'react-i18next';
import { calculateInstance } from '../../domain/calculator';
import { formatCompact, formatExp } from '../../domain/format';
import type { LeechInstance } from '../../domain/types';
import { CopyMesosMetric, Metric, MetricGroup } from '../../ui/metric';
import { Panel, PanelHeader } from '../../ui/panel';
import styles from './RunSummary.module.css';

export function RunSummary({ run, now }: { run: LeechInstance; now: number }) {
  const { t } = useTranslation();
  const summary = calculateInstance(run, now);
  return (
    <div className={styles.container}>
      <Panel className={styles.root}>
        <PanelHeader className={styles.header} title={t('status.heading')} />
        <MetricGroup className={styles.metrics} columns={1} padding="medium">
          <CopyMesosMetric className={styles.copy} value={summary.totalMesosDue} label={t('status.totalDue')} copiedLabel={t('common.copied')} copyAriaLabel={t('aria.copyTotalDue', { defaultValue: 'Copy total due' })} copiedAriaLabel={t('aria.totalDueCopied', { defaultValue: 'Total due copied' })} />
          <Metric label={t('status.buyers')} displayValue={summary.buyerCount} detail={summary.doneBuyerCount > 0 ? t('buyer.done', { count: summary.doneBuyerCount }) : t('buyer.allActive')} />
          <Metric label={t('status.totalExp')} displayValue={formatCompact(summary.totalExpGained)} detail={formatExp(summary.totalExpGained)} />
        </MetricGroup>
      </Panel>
    </div>
  );
}
