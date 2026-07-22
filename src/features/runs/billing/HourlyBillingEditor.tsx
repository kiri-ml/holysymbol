import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../../app/confirmation';
import type { HourlyBilling } from '../../../domain/types';
import { HourlyRateField } from '../../../modules/pricing';
import styles from './RunBillingEditor.module.css';
import { TimerControls } from './TimerControls';

export function HourlyBillingEditor({
  billing,
  now,
  onUpdate,
  onResetTimer,
  onToggleTimer,
}: {
  billing: HourlyBilling;
  now: number;
  onUpdate: (update: (billing: HourlyBilling) => HourlyBilling) => void;
  onResetTimer: () => void;
  onToggleTimer: () => void;
}) {
  const { t } = useTranslation();
  const confirm = useConfirm();

  async function resetTimer() {
    const confirmed = await confirm({
      title: t('common.reset'),
      message: t('confirm.resetTimer'),
      confirmLabel: t('common.reset'),
      tone: 'danger',
    });
    if (confirmed) onResetTimer();
  }

  return (
    <>
      <div className={styles.settings}>
        <HourlyRateField
          layout="billing"
          label={t('billing.hourlyRate')}
          valueMesos={billing.hourlyRateMesos}
          aria-label={t('aria.runHourlyPriceMillions')}
          onChangeMesos={(hourlyRateMesos) => onUpdate((current) => ({ ...current, hourlyRateMesos }))}
        />
      </div>
      <TimerControls className={styles.timerPlacement} billing={billing} now={now} onReset={() => { void resetTimer(); }} onToggle={onToggleTimer} />
    </>
  );
}
