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
  fingerprint?: string;
};

export type V6StorageUpdate =
  | { status: 'unchanged' }
  | { status: 'updated'; fingerprint: string; instances: LeechInstance[] }
  | { status: 'unavailable' };

export function hasLegacyInstances(storage: StorageLike): boolean {
  try {
    return storage.getItem(INSTANCES_V5_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function readV6StorageUpdate(
  storage: StorageLike,
  previousFingerprint: string | undefined,
): V6StorageUpdate {
  try {
    const fingerprint = storage.getItem(INSTANCES_V6_STORAGE_KEY);
    if (fingerprint === null) return { status: 'unavailable' };
    if (fingerprint === previousFingerprint) return { status: 'unchanged' };
    const instances = decodeV6Instances(JSON.parse(fingerprint) as unknown);
    return instances
      ? { status: 'updated', fingerprint, instances }
      : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
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
  const v6 = readV6StorageUpdate(storage, undefined);
  if (v6.status === 'updated') {
    return { instances: v6.instances, source: 'v6', fingerprint: v6.fingerprint };
  }

  const v5 = migrateV5Instances(parseStored(storage, INSTANCES_V5_STORAGE_KEY), now);
  if (v5) return { instances: v5, source: 'v5' };

  return { instances: fallback, source: 'fallback' };
}

export type SaveInstancesResult = {
  writeSucceeded: boolean;
  cleanupSucceeded: boolean;
  cleanupLegacy: boolean;
  fingerprint?: string;
};

export function saveInstances(
  storage: StorageLike,
  instances: LeechInstance[],
  cleanupLegacy: boolean,
): SaveInstancesResult {
  let fingerprint: string;
  try {
    fingerprint = JSON.stringify(encodeV6Instances(instances));
    storage.setItem(INSTANCES_V6_STORAGE_KEY, fingerprint);
  } catch {
    return { writeSucceeded: false, cleanupSucceeded: false, cleanupLegacy };
  }

  if (!cleanupLegacy) {
    return { writeSucceeded: true, cleanupSucceeded: true, cleanupLegacy: false, fingerprint };
  }

  try {
    storage.removeItem(INSTANCES_V5_STORAGE_KEY);
    return { writeSucceeded: true, cleanupSucceeded: true, cleanupLegacy: false, fingerprint };
  } catch {
    return { writeSucceeded: true, cleanupSucceeded: false, cleanupLegacy: true, fingerprint };
  }
}
