import type { CharacterSnapshot, LeechBuyer } from './types';

export function buyerLookupIgn(buyer: LeechBuyer) {
  return (buyer.ign || buyer.start?.ign || buyer.current?.ign || '').trim();
}

export function applyCurrentSnapshots(
  buyers: LeechBuyer[],
  snapshots: ReadonlyMap<string, CharacterSnapshot>,
): LeechBuyer[] {
  return buyers.map((buyer) => {
    if (buyer.locked) return buyer;
    const snapshot = snapshots.get(buyerLookupIgn(buyer).toLocaleLowerCase());
    return snapshot ? { ...buyer, ign: snapshot.ign, current: snapshot } : buyer;
  });
}
