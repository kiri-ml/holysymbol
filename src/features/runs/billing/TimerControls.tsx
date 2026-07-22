import { Pause, Play, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getBillableMs } from '../../../domain/calculator';
import { formatDuration } from '../../../domain/format';
import type { HourlyBilling } from '../../../domain/types';
import { classNames } from '../../../ui/classNames';
import { Button } from '../../../ui/button';
import { formatTimerStatus } from '../runPresentation';
import styles from './TimerControls.module.css';

export function TimerControls({ billing, onReset, onToggle, now, className }: { billing: HourlyBilling; onReset: () => void; onToggle: () => void; now: number; className?: string }) {
  const { t } = useTranslation();
  const billableMs = getBillableMs(billing.ledger, now);
  const isRunning = billing.ledger.status === 'running';
  return (
    <div className={classNames(styles.timer, className)} data-status={billing.ledger.status}>
      <div className={styles.controlField}>
        <div className={styles.timerHeader}><span className={styles.label}>{t('timer.runTime')}</span><small className={styles.status}>{formatTimerStatus(billing.ledger.status, t)}</small></div>
        <div className={styles.timerBody}>
          <div className={styles.timerMain}><strong className={styles.timerValue}>{formatDuration(billableMs)}</strong></div>
          <div className={styles.timerActions}>
            <Button className={styles.timerToggle} onClick={onToggle} icon={isRunning ? <Pause size={16} /> : <Play size={16} />} label={isRunning ? t('timer.pause') : t('timer.start')} labelMode="responsive" collapsePriority="high" />
            <Button variant="secondary" className={styles.timerReset} onClick={onReset} disabled={isRunning} icon={<RotateCcw size={16} />} label={t('common.reset')} labelMode="responsive" collapsePriority="low" />
          </div>
        </div>
      </div>
    </div>
  );
}
