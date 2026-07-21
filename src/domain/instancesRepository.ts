import type { LeechInstance } from './types';
import { migrateV5Instances } from './v5Migrator';
import { decodeV6Instances, encodeV6Instances } from './v6Codec';

export const INSTANCES_V6_STORAGE_KEY = 'legends-leech-calculator.instances.v6';
export const INSTANCES_V5_STORAGE_KEY = 'legends-leech-calculator.instances.v5';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadedInstances = {
  instances: LeechInstance[];
  source: 'v6' | 'v5' | 'fallback';
};

export function hasLegacyInstances(storage: StorageLike): boolean {
  try {
    return storage.getItem(INSTANCES_V5_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function parseStored(storage: StorageLike, key: string): unknown | undefined {
  try {
    const stored = storage.getItem(key);
    return stored === null ? undefined : JSON.parse(stored) as unknown;
  } catch {
    return undefined;
  }
}

export function loadInstances(
  storage: StorageLike,
  fallback: LeechInstance[],
  now = Date.now(),
): LoadedInstances {
  const v6 = decodeV6Instances(parseStored(storage, INSTANCES_V6_STORAGE_KEY));
  if (v6) return { instances: v6, source: 'v6' };

  const v5 = migrateV5Instances(parseStored(storage, INSTANCES_V5_STORAGE_KEY), now);
  if (v5) return { instances: v5, source: 'v5' };

  return { instances: fallback, source: 'fallback' };
}

export type SaveInstancesResult = {
  writeSucceeded: boolean;
  cleanupSucceeded: boolean;
  cleanupLegacy: boolean;
};

export function saveInstances(
  storage: StorageLike,
  instances: LeechInstance[],
  cleanupLegacy: boolean,
): SaveInstancesResult {
  try {
    storage.setItem(INSTANCES_V6_STORAGE_KEY, JSON.stringify(encodeV6Instances(instances)));
  } catch {
    return { writeSucceeded: false, cleanupSucceeded: false, cleanupLegacy };
  }

  if (!cleanupLegacy) return { writeSucceeded: true, cleanupSucceeded: true, cleanupLegacy: false };

  try {
    storage.removeItem(INSTANCES_V5_STORAGE_KEY);
    return { writeSucceeded: true, cleanupSucceeded: true, cleanupLegacy: false };
  } catch {
    return { writeSucceeded: true, cleanupSucceeded: false, cleanupLegacy: true };
  }
}
