import { useState } from 'react';
import { buyerLookupIgn } from '../../../domain/buyers';
import type { LeechInstance } from '../../../domain/types';
import type { RunBuyerController } from '../runController';
import { BuyerList } from './BuyerList';
import { BuyerToolbar } from './BuyerToolbar';

export function BuyersEditor({
  run,
  now,
  busyIgn,
  controller,
}: {
  run: LeechInstance;
  now: number;
  busyIgn: string | null;
  controller: RunBuyerController;
}) {
  const [newBuyerIgn, setNewBuyerIgn] = useState('');
  const [addingBuyer, setAddingBuyer] = useState(false);
  const [refreshingRun, setRefreshingRun] = useState(false);
  const refreshableBuyers = run.buyers.filter((buyer) => !buyer.locked && buyerLookupIgn(buyer));

  async function addBuyer() {
    const ign = newBuyerIgn.trim();
    if (!ign) return;
    setAddingBuyer(true);
    try {
      await controller.add(ign);
      setNewBuyerIgn('');
    } finally {
      setAddingBuyer(false);
    }
  }

  async function refreshBuyers() {
    if (refreshableBuyers.length === 0) return;
    setRefreshingRun(true);
    try {
      await controller.refreshAll();
    } finally {
      setRefreshingRun(false);
    }
  }

  return (
    <>
      <BuyerToolbar
        newBuyerIgn={newBuyerIgn}
        addingBuyer={addingBuyer}
        refreshing={refreshingRun}
        refreshDisabled={refreshableBuyers.length === 0}
        lastRefreshedAt={run.lastCurrentRefreshedAt}
        onNewBuyerIgnChange={setNewBuyerIgn}
        onAddBuyer={() => void addBuyer()}
        onRefreshBuyers={() => void refreshBuyers()}
      />
      <BuyerList
        run={run}
        now={now}
        busyIgn={busyIgn}
        refreshingAll={refreshingRun}
        controller={controller}
      />
    </>
  );
}
