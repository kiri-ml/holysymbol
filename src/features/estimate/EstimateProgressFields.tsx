import { useTranslation } from 'react-i18next';
import { CharacterProgressFields } from '../../modules/character-progress';
import type { LevelExpValue } from '../../modules/character-progress';
import styles from './Estimate.module.css';
import { EstimateFlowCard } from './EstimateFlowCard';

type EstimateProgressValue = LevelExpValue;

export function EstimateProgressFields({
  step,
  title,
  value,
  onChange,
}: {
  step: string;
  title: string;
  value: EstimateProgressValue;
  onChange: (value: EstimateProgressValue) => void;
}) {
  const { t } = useTranslation();
  return (
    <EstimateFlowCard
      step={step}
      title={title}
      labels={<div className={`${styles.labelRow} ${styles.labelLevelExp}`}><span>{t('common.level')}</span><span>{t('common.expPercent')}</span></div>}
    >
      <CharacterProgressFields
        className={styles.levelInputs}
        layout="inherit"
        value={value}
        onChange={onChange}
        levelLabel={t('aria.estimateLevel', { label: title })}
        expLabel={t('aria.estimateExpPercent', { label: title })}
        labelVisibility="screen-reader"
      />
    </EstimateFlowCard>
  );
}
