import { rawExpAt } from './expTable';
import type { RatioReceipt } from './ratioReceipt';

export type RatioReceiptSegment = {
  startLevel: number;
  startExpPercent: number;
  endLevel: number;
  endExpPercent: number;
  ratio: number;
  expGained: number;
  mesosDue: number;
};

export type RatioReceiptCalculation = {
  expGained: number;
  mesosDue?: number;
  segments: RatioReceiptSegment[];
};

export function calculateRatioReceipt(receipt: RatioReceipt): RatioReceiptCalculation {
  const startExp = rawExpAt(receipt.startLevel, receipt.startExpPercent);
  const requestedEndExp = rawExpAt(receipt.endLevel, receipt.endExpPercent);
  const endExp = Math.max(startExp, requestedEndExp);
  const expGained = endExp - startExp;
  if (expGained === 0) return { expGained: 0, mesosDue: 0, segments: [] };

  const tiers = [...receipt.tiers].sort((left, right) => left.minLevel - right.minLevel);
  let ratio = receipt.ratio;
  let segmentStartExp = startExp;
  let segmentStartLevel = receipt.startLevel;
  let segmentStartPercent = receipt.startExpPercent;
  const segments: RatioReceiptSegment[] = [];

  for (const tier of tiers) {
    const thresholdExp = rawExpAt(tier.minLevel, 0);
    if (thresholdExp <= startExp) {
      ratio = tier.expPerMesoRatio;
      continue;
    }
    if (thresholdExp >= endExp) break;
    if (ratio <= 0) return { expGained, mesosDue: undefined, segments: [] };

    const segmentExp = thresholdExp - segmentStartExp;
    segments.push({
      startLevel: segmentStartLevel,
      startExpPercent: segmentStartPercent,
      endLevel: tier.minLevel,
      endExpPercent: 0,
      ratio,
      expGained: segmentExp,
      mesosDue: segmentExp / ratio,
    });
    segmentStartExp = thresholdExp;
    segmentStartLevel = tier.minLevel;
    segmentStartPercent = 0;
    ratio = tier.expPerMesoRatio;
  }

  if (ratio <= 0) return { expGained, mesosDue: undefined, segments: [] };
  const finalSegmentExp = endExp - segmentStartExp;
  segments.push({
    startLevel: segmentStartLevel,
    startExpPercent: segmentStartPercent,
    endLevel: receipt.endLevel,
    endExpPercent: receipt.endExpPercent,
    ratio,
    expGained: finalSegmentExp,
    mesosDue: finalSegmentExp / ratio,
  });

  return {
    expGained,
    mesosDue: segments.reduce((total, segment) => total + segment.mesosDue, 0),
    segments,
  };
}
