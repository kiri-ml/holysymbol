import { expGainedBetween } from './expTable';
import { calculateTieredRatioDue } from './calculator';
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
    mesosDue: calculateTieredRatioDue(
      { type: 'ratio', expPerMesoRatio: receipt.ratio, tiers: receipt.tiers },
      receipt.startLevel,
      receipt.startExpPercent,
      receipt.endLevel,
      receipt.endExpPercent,
    ),
  };
}
