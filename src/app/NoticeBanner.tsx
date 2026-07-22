import { AlertCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../ui/button';
import { Surface } from '../ui/surface';
import styles from './NoticeBanner.module.css';
import type { Notice } from './notice';

export function NoticeBanner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const { t } = useTranslation();
  if (!notice) return null;
  return (
    <Surface className={styles.root} radius="medium" padding="small" data-type={notice.type} role={notice.type === 'error' ? 'alert' : 'status'}>
      <AlertCircle size={18} aria-hidden="true" />
      <span className={styles.message}>{notice.text}</span>
      <IconButton variant="ghost" size="xs" className={styles.dismiss} onClick={onDismiss} icon={<X size={17} />} aria-label={t('common.dismiss')} />
    </Surface>
  );
}
