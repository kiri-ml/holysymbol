import { expGainedBetween } from './expTable';
import type { RatioReceipt } from './ratioReceipt';

export type RatioReceiptCalculation = {
  expGained: number;
  mesosDue?: number;
};

export function calculateRatioReceipt(receipt: RatioReceipt): RatioReceiptCalculation {
  const expGained = Math.max(0, expGainedBetween(
    receipt.startLevel,
    receipt.startExpPercent,
    receipt.endLevel,
    receipt.endExpPercent,
  ));

  return {
    expGained,
    mesosDue: receipt.ratio > 0 ? expGained / receipt.ratio : undefined,
  };
}
