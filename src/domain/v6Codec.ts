import { encodeInstances, normalizeInstances } from './persistenceInternals';
import type { LeechInstance } from './types';

export type StoredSnapshotV6 = [
  level: number,
  expPercent: number,
  capturedAtOffsetSeconds: number,
  source: 0 | 1,
];

export type StoredBuyerV6 = {
  i: number;
  n: string;
  l?: 1;
  j?: string;
  g?: string;
  s?: StoredSnapshotV6;
  c?: StoredSnapshotV6;
};

export type StoredRatioBillingV6 = {
  t: 'r';
  r: number;
  q?: Array<[minLevel: number, expPerMesoRatio: number]>;
};

export type StoredHourlyAccountV6 = { m: number; r?: 1 };

export type StoredHourlyBillingV6 = {
  t: 'h';
  r: number;
  l: {
    s: 'i' | 'r' | 'p';
    t: number;
    c?: number;
    a: Record<string, StoredHourlyAccountV6>;
  };
};

export type StoredBillingV6 = StoredRatioBillingV6 | StoredHourlyBillingV6;

export type StoredInstanceV6 = {
  i: string;
  n: string;
  b: StoredBillingV6;
  u: StoredBuyerV6[];
  d: number;
  /** Absolute Unix epoch seconds. */
  c: number;
  /** Seconds relative to `c`. */
  r?: number;
  x?: StoredBillingV6;
};

export function encodeV6Instances(instances: LeechInstance[]): StoredInstanceV6[] {
  return encodeInstances(instances) as StoredInstanceV6[];
}

export function decodeV6Instances(value: unknown): LeechInstance[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (value.length === 0) return [];
  const decoded = normalizeInstances(value, []);
  return decoded.length > 0 ? decoded : undefined;
}
