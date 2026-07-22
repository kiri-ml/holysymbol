import { Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RatioBilling } from '../../../domain/types';
import { RatioRateField } from '../../../modules/pricing';
import { Button, IconButton } from '../../../ui/button';
import { classNames } from '../../../ui/classNames';
import { ControlGroup } from '../../../ui/control-group';
import { NumberInput } from '../../../ui/fields';
import styles from './RatioTierEditor.module.css';
import { addRatioTier, canAddRatioTier, removeRatioTier, updateRatioTier } from './runBillingCommands';

export function RatioTierEditor({ billing, onUpdate }: {
  billing: RatioBilling;
  onUpdate: (update: (billing: RatioBilling) => RatioBilling) => void;
}) {
  const { t } = useTranslation();
  const [tierLevel, setTierLevel] = useState(Number.NaN);
  const tierLevelId = useId();
  const canAddTier = canAddRatioTier(billing, tierLevel);

  function addTier() {
    if (!canAddTier) return;
    onUpdate((current) => addRatioTier(current, tierLevel));
    setTierLevel(Number.NaN);
  }

  const rateField = (value: number, label: string, onRateChange: (value: number) => void, width: 'default' | 'full' = 'default') => (
    <RatioRateField label={label} labelVisibility="screen-reader" width={width} value={value} onChange={onRateChange} />
  );

  return (
    <div className={styles.tierEditor}>
      <div className={classNames(styles.controlField, styles.tierCard, styles.tierBase)}>
        <span className={styles.label}>{t('billing.baseRatio')}</span>
        <div className={styles.controlRow}>
          {rateField(billing.expPerMesoRatio, t('aria.runExpRatio'), (expPerMesoRatio) => onUpdate((current) => ({ ...current, expPerMesoRatio })), 'full')}
        </div>
      </div>
      {billing.tiers.map((tier, index) => (
        <div className={classNames(styles.controlField, styles.tierCard)} key={tier.minLevel}>
          <span className={classNames(styles.label, styles.tierLevel)}>{t('billing.tierLevel')} {tier.minLevel}</span>
          <div className={styles.controlRow}>
            {rateField(tier.expPerMesoRatio, t('aria.ratioTierRatio', { number: index + 1 }), (expPerMesoRatio) => onUpdate((current) => updateRatioTier(current, tier.minLevel, expPerMesoRatio)))}
            <IconButton
              variant="danger"
              onClick={() => onUpdate((current) => removeRatioTier(current, tier.minLevel))}
              icon={<Trash2 size={16} />}
              aria-label={t('aria.removeRatioTier', { number: index + 1 })}
            />
          </div>
        </div>
      ))}
      <div className={classNames(styles.controlField, styles.tierCard, styles.tierAdd)}>
        <label className={styles.label} htmlFor={tierLevelId}>{t('billing.tierLevel')}</label>
        <form onSubmit={(event) => { event.preventDefault(); addTier(); }}>
          <ControlGroup className={styles.addGroup} width="full">
            <NumberInput
              id={tierLevelId}
              className={styles.tierInput}
              min={1}
              max={200}
              step={1}
              value={tierLevel}
              emptyValue={Number.NaN}
              emitEmptyOnChange
              placeholder="120"
              aria-label={t('aria.ratioTierLevel', { number: billing.tiers.length + 1 })}
              onValueChange={setTierLevel}
            />
            <Button
              type="submit"
              className={styles.addButton}
              disabled={!canAddTier}
              icon={<Plus size={16} />}
              label={t('billing.addTier')}
              labelMode="responsive"
            />
          </ControlGroup>
        </form>
      </div>
    </div>
  );
}
