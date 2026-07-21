export type CharacterApiPayload = {
  name?: string;
  guild?: string | null;
  level?: number | string;
  job?: string;
  exp?: string | number;
  fame?: number | string;
  [key: string]: unknown;
};

export type CharacterSnapshot = {
  ign: string;
  level: number;
  expPercent: number;
  job?: string;
  guild?: string;
  fame?: number;
  capturedAt: string;
  source: 'api' | 'manual';
};

export type ExpTableRow = {
  level: number;
  expToLevel: number;
  accumulatedExp: number;
};

export type BillingType = 'ratio' | 'hourly';
export type BuyerId = number;

export type TimerStatus = 'idle' | 'running' | 'paused';

export type HourlyAccount = {
  accruedMs: number;
  active: boolean;
};

export type HourlyLedger = {
  status: TimerStatus;
  accumulatedMs: number;
  checkpointAt?: number;
  accounts: Record<BuyerId, HourlyAccount>;
};

export type RatioBilling = {
  type: 'ratio';
  /** EXP per 1 meso. For example, 3.3 means 1:3.3. */
  expPerMesoRatio: number;
  tiers: RatioTier[];
};

export type RatioTier = {
  /** The tier applies to EXP earned from this level onward. */
  minLevel: number;
  /** EXP per 1 meso for this tier. */
  expPerMesoRatio: number;
};

export type HourlyBilling = {
  type: 'hourly';
  /** Mesos per hour, e.g. 12_000_000 for 12M/hr. */
  hourlyRateMesos: number;
  ledger: HourlyLedger;
};

export type LeechBilling = RatioBilling | HourlyBilling;

export type InactiveBilling = {
  ratio?: RatioBilling;
  hourly?: HourlyBilling;
};

export type LeechBuyer = {
  id: BuyerId;
  ign: string;
  locked?: boolean;
  start?: CharacterSnapshot;
  current?: CharacterSnapshot;
};

export type LeechInstance = {
  id: string;
  name: string;
  billing: LeechBilling;
  inactiveBilling?: InactiveBilling;
  buyers: LeechBuyer[];
  nextBuyerId: number;
  createdAt: string;
  lastCurrentRefreshedAt?: string;
};

export type BuyerCalculation = {
  expGained?: number;
  ratioMesosDue?: number;
  hourlyMesosDue?: number;
};

export type InstanceCalculation = {
  buyerCount: number;
  doneBuyerCount: number;
  totalExpGained: number;
  billableMs?: number;
  totalMesosDue: number;
};

export type EstimateCalculation = {
  expNeeded: number;
  ratioMesosDue?: number;
  expectedDurationMs?: number;
  hourlyMesosDue?: number;
};
