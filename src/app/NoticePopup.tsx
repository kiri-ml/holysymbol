import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, type FocusEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../ui/button';
import { Surface } from '../ui/surface';
import styles from './NoticePopup.module.css';
import { NOTICE_DISMISS_MS, type Notice } from './notice';

export function NoticePopup({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  const { t } = useTranslation();
  const timerRef = useRef<number | null>(null);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);

  const clearDismissTimer = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const scheduleDismiss = useCallback(() => {
    clearDismissTimer();
    if (!notice || hoveredRef.current || focusedRef.current) return;
    timerRef.current = window.setTimeout(onDismiss, NOTICE_DISMISS_MS[notice.type]);
  }, [clearDismissTimer, notice, onDismiss]);

  useEffect(() => {
    scheduleDismiss();
    return clearDismissTimer;
  }, [clearDismissTimer, scheduleDismiss]);

  if (!notice) return null;

  const Icon = notice.type === 'error' ? AlertCircle : CheckCircle2;

  return (
    <div className={styles.positioner}>
      <Surface
        className={styles.root}
        variant="floating"
        radius="large"
        padding="none"
        data-type={notice.type}
        role={notice.type === 'error' ? 'alert' : 'status'}
        onMouseEnter={() => {
          hoveredRef.current = true;
          clearDismissTimer();
        }}
        onMouseLeave={() => {
          hoveredRef.current = false;
          scheduleDismiss();
        }}
        onFocus={() => {
          focusedRef.current = true;
          clearDismissTimer();
        }}
        onBlur={(event: FocusEvent<HTMLElement>) => {
          if (event.currentTarget.contains(event.relatedTarget)) return;
          focusedRef.current = false;
          scheduleDismiss();
        }}
      >
        <Icon className={styles.icon} size={20} aria-hidden="true" />
        <span className={styles.message}>{notice.text}</span>
        <IconButton variant="ghost" size="xs" className={styles.dismiss} onClick={onDismiss} icon={<X size={17} />} aria-label={t('common.dismiss')} />
      </Surface>
    </div>
  );
}
