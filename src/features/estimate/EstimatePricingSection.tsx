import { useTranslation } from 'react-i18next';
import type { BillingType } from '../../domain/types';
import { HourlyRateField, RatioRateField, normalizeNonNegativeHundredth } from '../../modules/pricing';
import { InputFields, NumberField } from '../../ui/fields';
import styles from './Estimate.module.css';
import { EstimateFlowCard } from './EstimateFlowCard';

export type EstimatePricingValue = { billingType: BillingType; expPerMesoRatio: number; hourlyRateMillions: number; expPerHourMillions: number };

export function EstimatePricingSection({ value, onChange }: { value: EstimatePricingValue; onChange: (value: EstimatePricingValue) => void }) {
  const { t } = useTranslation();
  const labels = value.billingType === 'ratio'
    ? <div className={`${styles.labelRow} ${styles.labelSingle}`}><span>{t('calculator.expMesosRatio')}</span></div>
    : <div className={`${styles.labelRow} ${styles.labelPricing}`}><span>{t('common.millionPerHour')}</span><span>{t('common.millionExpPerHour')}</span></div>;

  return (
    <EstimateFlowCard step="3" title={t('billing.pricing')} labels={labels}>
      {value.billingType === 'ratio' ? (
        <RatioRateField
          label={t('aria.expPerMesoRatio')}
          labelVisibility="screen-reader"
          width="full"
          value={value.expPerMesoRatio}
          onChange={(expPerMesoRatio) => onChange({ ...value, expPerMesoRatio })}
        />
      ) : (
        <InputFields className={styles.pricingInputs}>
          <HourlyRateField label={t('aria.hourlyPriceMillions')} labelVisibility="screen-reader" valueMesos={value.hourlyRateMillions * 1_000_000} trailing={false} onChangeMesos={(hourlyRateMesos) => onChange({ ...value, hourlyRateMillions: hourlyRateMesos / 1_000_000 })} />
          <NumberField label={t('aria.expRateMillions')} labelVisibility="screen-reader" min={0} step={0.01} value={value.expPerHourMillions} normalize={normalizeNonNegativeHundredth} onValueChange={(expPerHourMillions) => onChange({ ...value, expPerHourMillions })} />
        </InputFields>
      )}
    </EstimateFlowCard>
  );
}
