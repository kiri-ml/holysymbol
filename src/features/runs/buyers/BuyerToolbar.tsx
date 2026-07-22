import { AlertCircle, Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatLocalDateTime } from '../../../domain/format';
import { Button } from '../../../ui/button';
import { ControlGroup } from '../../../ui/control-group';
import { TextInput } from '../../../ui/fields';
import { HeadingGroup } from '../../../ui/heading';
import { HelpPopover } from '../../../ui/help-popover';
import styles from './BuyerToolbar.module.css';

export function BuyerToolbar({ newBuyerIgn, addingBuyer, refreshing, refreshDisabled, lastRefreshedAt, onNewBuyerIgnChange, onAddBuyer, onRefreshBuyers }: {
  newBuyerIgn: string; addingBuyer: boolean; refreshing: boolean; refreshDisabled: boolean; lastRefreshedAt?: string;
  onNewBuyerIgnChange: (value: string) => void; onAddBuyer: () => void; onRefreshBuyers: () => void;
}) {
  const { t } = useTranslation();
  const refreshDescription = lastRefreshedAt ? <>{t('snapshot.refreshed')} <time dateTime={lastRefreshedAt}>{formatLocalDateTime(lastRefreshedAt)}</time></> : undefined;

  return (
    <div className={styles.toolbarContainer}>
      <div className={styles.toolbar}>
        <HeadingGroup title={t('buyer.buyers')} description={refreshDescription} headingLevel={3} size="small" />
        <div className={styles.toolbarActions}>
          <form className={styles.addForm} onSubmit={(event) => { event.preventDefault(); onAddBuyer(); }}>
            <ControlGroup className={styles.addGroup} width="full">
              <TextInput className={styles.addInput} aria-label={t('buyer.ign')} value={newBuyerIgn} onChange={(event) => onNewBuyerIgnChange(event.target.value)} placeholder={t('buyer.ign')} />
              <Button
                type="submit"
                className={styles.addButton}
                loading={addingBuyer}
                disabled={!newBuyerIgn.trim()}
                icon={<Plus size={16} />}
                label={t('common.add')}
                labelMode="responsive"
                collapsePriority="low"
              />
            </ControlGroup>
          </form>
          <HelpPopover
            className={styles.refreshHelp}
            title={<span className={styles.tipTitle}><AlertCircle size={14} /> {t('tip.updateExpBeforeRefreshing')}</span>}
            trigger={(
              <Button
                variant="secondary"
                className={styles.refreshButton}
                onClick={onRefreshBuyers}
                disabled={refreshDisabled}
                loading={refreshing}
                icon={<RefreshCw size={16} />}
                label={t('common.refreshExp')}
                labelMode="responsive"
                collapsePriority="high"
              />
            )}
          >
            <div className={styles.tipGrid}>
              <b>{t('tip.partyUpdateTitle')}</b><span>{t('tip.partyUpdateBody')}</span>
              <b>{t('tip.selfUpdateTitle')}</b><span>{t('tip.selfUpdateBody')}</span>
            </div>
          </HelpPopover>
        </div>
      </div>
    </div>
  );
}
