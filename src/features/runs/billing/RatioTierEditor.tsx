import { Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RatioBilling } from '../../../domain/types';
import { RatioRateField } from '../../../modules/pricing';
import { IconButton } from '../../../ui/button';
import { classNames } from '../../../ui/classNames';
import { ControlGroup } from '../../../ui/control-group';
import { InputField, NumberInput } from '../../../ui/fields';
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

  return (
    <div className={styles.tierEditor}>
      <div className={classNames(styles.tierCard, styles.tierBase)}>
        <RatioRateField
          label={t('billing.baseRatio')}
          value={billing.expPerMesoRatio}
          onChange={(expPerMesoRatio) => onUpdate((current) => ({ ...current, expPerMesoRatio }))}
        />
      </div>
      {billing.tiers.map((tier, index) => (
        <div className={styles.tierCard} key={tier.minLevel}>
          <RatioRateField
            label={<span className={styles.tierLevel}>{t('billing.tierLevel')} {tier.minLevel}</span>}
            value={tier.expPerMesoRatio}
            onChange={(expPerMesoRatio) => onUpdate((current) => updateRatioTier(current, tier.minLevel, expPerMesoRatio))}
          />
          <IconButton
            className={styles.removeButton}
            variant="danger"
            onClick={() => onUpdate((current) => removeRatioTier(current, tier.minLevel))}
            icon={<Trash2 size={16} />}
            aria-label={t('aria.removeRatioTier', { number: index + 1 })}
          />
        </div>
      ))}
      <InputField className={classNames(styles.tierCard, styles.tierAdd)} label={t('billing.tierLevel')} controlId={tierLevelId}>
        <form onSubmit={(event) => { event.preventDefault(); addTier(); }}>
          <ControlGroup width="full">
            <NumberInput
              id={tierLevelId}
              min={1}
              max={200}
              step={1}
              value={tierLevel}
              emptyValue={Number.NaN}
              emitEmptyOnChange
              blurOnEnter={false}
              placeholder="120"
              onValueChange={setTierLevel}
            />
            <IconButton
              type="submit"
              disabled={!canAddTier}
              icon={<Plus size={16} />}
              aria-label={t('billing.addTier')}
            />
          </ControlGroup>
        </form>
      </InputField>
    </div>
  );
}
