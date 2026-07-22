import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { calculateEstimate } from '../../domain/calculator';
import { clampLevel } from '../../modules/character-progress';
import { PricingModeControl } from '../../modules/pricing';
import { Panel, PanelHeader } from '../../ui/panel';
import styles from './Estimate.module.css';
import { EstimatePricingSection } from './EstimatePricingSection';
import { EstimateProgressFields } from './EstimateProgressFields';
import { EstimateResult } from './EstimateResult';
import type { QuickEstimateState } from './estimateState';

export function QuickEstimate({
  estimate,
  onChange,
}: {
  estimate: QuickEstimateState;
  onChange: (next: QuickEstimateState) => void;
}) {
  const { t } = useTranslation();
  const updateEstimate = (patch: Partial<QuickEstimateState>) => onChange({ ...estimate, ...patch });
  const result = useMemo(
    () => calculateEstimate({
      fromLevel: clampLevel(estimate.fromLevel),
      fromExpPercent: estimate.fromExpPercent,
      toLevel: clampLevel(estimate.toLevel),
      toExpPercent: estimate.toExpPercent,
      billingType: estimate.billingType,
      expPerMesoRatio: estimate.expPerMesoRatio,
      hourlyRateMesos: estimate.hourlyRateMillions * 1_000_000,
      expPerHourMillions: estimate.expPerHourMillions,
    }),
    [estimate],
  );

  return (
    <div className={styles.container}>
      <Panel className={styles.panel}>
        <PanelHeader
          className={styles.header}
          title={t('calculator.heading')}
          actions={(
            <PricingModeControl
              value={estimate.billingType}
              className={styles.modeControl}
              ariaLabel={t('billing.estimateType')}
              onChange={(billingType) => updateEstimate({ billingType })}
            />
          )}
        />

        <div className={styles.grid}>
          <EstimateProgressFields
            step="1"
            title={t('calculator.from')}
            value={{ level: estimate.fromLevel, expPercent: estimate.fromExpPercent }}
            onChange={({ level, expPercent }) => updateEstimate({ fromLevel: level, fromExpPercent: expPercent })}
          />
          <EstimateProgressFields
            step="2"
            title={t('calculator.to')}
            value={{ level: estimate.toLevel, expPercent: estimate.toExpPercent }}
            onChange={({ level, expPercent }) => updateEstimate({ toLevel: level, toExpPercent: expPercent })}
          />
          <EstimatePricingSection
            value={{
              billingType: estimate.billingType,
              expPerMesoRatio: estimate.expPerMesoRatio,
              hourlyRateMillions: estimate.hourlyRateMillions,
              expPerHourMillions: estimate.expPerHourMillions,
            }}
            onChange={updateEstimate}
          />
          <EstimateResult billingType={estimate.billingType} result={result} />
        </div>
      </Panel>
    </div>
  );
}
