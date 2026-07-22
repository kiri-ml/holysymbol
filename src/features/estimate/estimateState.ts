import type { BillingType } from '../../domain/types';

export type QuickEstimateState = {
  fromLevel: number;
  fromExpPercent: number;
  toLevel: number;
  toExpPercent: number;
  billingType: BillingType;
  expPerMesoRatio: number;
  hourlyRateMillions: number;
  expPerHourMillions: number;
};

export const ESTIMATE_STORAGE_KEY = 'legends-leech-calculator.estimate.v1';

export const DEFAULT_ESTIMATE: QuickEstimateState = {
  fromLevel: 120,
  fromExpPercent: 0,
  toLevel: 125,
  toExpPercent: 0,
  billingType: 'ratio',
  expPerMesoRatio: 3.3,
  hourlyRateMillions: 12,
  expPerHourMillions: 35,
};
