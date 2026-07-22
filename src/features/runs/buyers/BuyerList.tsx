import { UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../../app/confirmation';
import { buyerLookupIgn } from '../../../domain/buyers';
import type { LeechBuyer, LeechInstance } from '../../../domain/types';
import { getRunDisplayName } from '../runPresentation';
import type { RunBuyerController } from '../runController';
import styles from './BuyerList.module.css';
import { BuyerRow } from './BuyerRow';

export function BuyerList({
  run,
  now,
  busyIgn,
  refreshingAll,
  controller,
}: {
  run: LeechInstance;
  now: number;
  busyIgn: string | null;
  refreshingAll: boolean;
  controller: RunBuyerController;
}) {
  const { t } = useTranslation();
  const confirm = useConfirm();

  async function deleteBuyer(buyer: LeechBuyer) {
    const name = buyerLookupIgn(buyer) || t('buyer.thisCharacter');
    const isEmpty = !buyer.ign.trim() && !buyer.start && !buyer.current;
    if (!isEmpty) {
      const confirmed = await confirm({
        title: t('buyer.delete'),
        message: t('confirm.deleteBuyer', { name, run: getRunDisplayName(run) }),
        confirmLabel: t('buyer.delete'),
        tone: 'danger',
      });
      if (!confirmed) return;
    }
    controller.remove(buyer.id);
  }

  if (run.buyers.length === 0) {
    return (
      <div className={styles.empty}>
        <UserPlus size={24} />
        <strong>{t('buyer.noBuyersTitle')}</strong>
        <span>{t('buyer.noBuyersBody')}</span>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {run.buyers.map((buyer) => (
        <BuyerRow
          key={buyer.id}
          billing={run.billing}
          buyer={buyer}
          now={now}
          busy={busyIgn === buyerLookupIgn(buyer) || refreshingAll}
          onRefreshSnapshot={controller.refreshSnapshot}
          onSetManualSnapshot={controller.setManualSnapshot}
          onSetCompleted={controller.setCompleted}
          onDelete={() => { void deleteBuyer(buyer); }}
        />
      ))}
    </div>
  );
}
