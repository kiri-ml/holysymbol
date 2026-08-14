import { buyerLookupIgn } from '../../../domain/buyers';
import { isValidRatioReceiptIgn, ratioReceiptPath } from '../../../domain/ratioReceipt';
import type { LeechBilling, LeechBuyer } from '../../../domain/types';

export type BuyerReceiptLink =
  | { status: 'available'; path: string }
  | { status: 'unavailable'; reason: 'missing-data' | 'tiered-pricing' | 'encoding' }
  | { status: 'unsupported' };

export function createBuyerReceiptLink(buyer: LeechBuyer, billing: LeechBilling): BuyerReceiptLink {
  if (billing.type !== 'ratio') return { status: 'unsupported' };
  if (billing.tiers.length > 0) return { status: 'unavailable', reason: 'tiered-pricing' };

  const ign = buyerLookupIgn(buyer);
  if (!isValidRatioReceiptIgn(ign) || !buyer.start || !buyer.current) {
    return { status: 'unavailable', reason: 'missing-data' };
  }

  try {
    return {
      status: 'available',
      path: ratioReceiptPath({
        ign,
        startLevel: buyer.start.level,
        startExpPercent: buyer.start.expPercent,
        endLevel: buyer.current.level,
        endExpPercent: buyer.current.expPercent,
        ratio: billing.expPerMesoRatio,
      }),
    };
  } catch {
    return { status: 'unavailable', reason: 'encoding' };
  }
}
