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
  id: string;
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

export type TimerStatus = 'idle' | 'running' | 'paused' | 'ended';

export type LeechTimer = {
  status: TimerStatus;
  accumulatedMs: number;
  lastStartedAt?: string;
  endedAt?: string;
};

export type RatioBilling = {
  type: 'ratio';
  /** EXP per 1 meso. For example, 3.3 means 1:3.3. */
  expPerMesoRatio: number;
};

export type HourlyBilling = {
  type: 'hourly';
  /** Mesos per hour, e.g. 12_000_000 for 12m/hr. */
  hourlyRateMesos: number;
  /** Expected EXP per hour in millions, used only by Quick Estimate. */
  expPerHourMillions: number;
  timer: LeechTimer;
};

export type LeechBilling = RatioBilling | HourlyBilling;

export type LeechBuyer = {
  id: string;
  ign: string;
  locked?: boolean;
  start?: CharacterSnapshot;
  current?: CharacterSnapshot;
};

export type EstimateQuote = {
  fromLevel: number;
  fromExpPercent: number;
  toLevel: number;
  toExpPercent: number;
  expNeeded: number;
  createdAt: string;
};

export type LeechInstance = {
  id: string;
  name: string;
  billing: LeechBilling;
  buyers: LeechBuyer[];
  quote?: EstimateQuote;
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
  completedBuyerCount: number;
  totalExpGained: number;
  billableMs?: number;
  mesosPerBuyer?: number;
  totalMesosDue: number;
};

export type EstimateCalculation = {
  expNeeded: number;
  ratioMesosDue?: number;
  expectedDurationMs?: number;
  hourlyMesosDue?: number;
};
