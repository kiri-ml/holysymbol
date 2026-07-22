import { useTranslation } from 'react-i18next';
import { formatCompact, formatDuration, formatExp, formatHours } from '../../domain/format';
import type { BillingType, EstimateCalculation } from '../../domain/types';
import { classNames } from '../../ui/classNames';
import { CopyMesosMetric, Metric, MetricGroup } from '../../ui/metric';
import styles from './Estimate.module.css';
import { EstimateFlowCard } from './EstimateFlowCard';

export function EstimateResult({ billingType, result }: { billingType: BillingType; result: EstimateCalculation }) {
  const { t } = useTranslation();
  const estimatedCost = billingType === 'ratio' ? result.ratioMesosDue : result.hourlyMesosDue;
  return (
    <EstimateFlowCard step="4" title={t('calculator.result')}>
      <MetricGroup className={styles.result} columns={2} padding="medium">
        <CopyMesosMetric
          className={classNames(styles.resultItem, styles.resultItemFull)}
          value={estimatedCost}
          label={t('calculator.estimatedCost')}
          copiedLabel={t('common.copied')}
          copyAriaLabel={t('aria.copyEstimatedCost')}
          copiedAriaLabel={t('aria.estimatedCostCopied')}
        />
        <Metric className={classNames(styles.resultItem, billingType === 'ratio' && styles.resultItemFull)} label={t('calculator.expNeeded')} displayValue={formatCompact(result.expNeeded)} detail={formatExp(result.expNeeded)} />
        {billingType === 'hourly' ? <Metric className={styles.resultItem} label={t('calculator.expectedTime')} displayValue={formatDuration(result.expectedDurationMs)} detail={formatHours(result.expectedDurationMs)} /> : null}
      </MetricGroup>
    </EstimateFlowCard>
  );
}
