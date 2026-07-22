import type { LeechBilling } from '../../../domain/types';
import type { RunBillingController } from '../runController';
import styles from './RunBillingEditor.module.css';
import { HourlyBillingEditor } from './HourlyBillingEditor';
import { RatioTierEditor } from './RatioTierEditor';

export function RunBillingEditor({
  billing,
  now,
  controller,
}: {
  billing: LeechBilling;
  now: number;
  controller: RunBillingController;
}) {
  return (
    <div className={styles.container}>
      <div className={styles.root} data-type={billing.type}>
        {billing.type === 'ratio' ? (
          <div className={styles.settings}>
            <RatioTierEditor billing={billing} onUpdate={controller.updateRatio} />
          </div>
        ) : (
          <HourlyBillingEditor
            billing={billing}
            now={now}
            onUpdate={controller.updateHourly}
            onResetTimer={controller.resetTimer}
            onToggleTimer={controller.toggleTimer}
          />
        )}
      </div>
    </div>
  );
}
