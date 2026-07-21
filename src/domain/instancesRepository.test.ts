import { describe, expect, it } from 'vitest';
import {
  INSTANCES_V5_STORAGE_KEY,
  INSTANCES_V6_STORAGE_KEY,
  hasLegacyInstances,
  loadInstances,
  saveInstances,
  type StorageLike,
} from './instancesRepository';
import type { LeechInstance } from './types';

const createdAt = '2026-06-09T00:00:00.000Z';

function instance(id: string): LeechInstance {
  return {
    id,
    name: id,
    billing: { type: 'ratio', expPerMesoRatio: 3.3, tiers: [] },
    buyers: [],
    nextBuyerId: 0,
    createdAt,
  };
}

class FakeStorage implements StorageLike {
  values = new Map<string, string>();
  events: string[] = [];
  failWrite = false;
  failRemove = false;

  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    this.events.push(`set:${key}`);
    if (this.failWrite) throw new Error('write failed');
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.events.push(`remove:${key}`);
    if (this.failRemove) throw new Error('remove failed');
    this.values.delete(key);
  }
}

describe('instances repository', () => {
  it('prefers valid v6 and salvages valid runs', () => {
    const storage = new FakeStorage();
    storage.values.set(INSTANCES_V6_STORAGE_KEY, JSON.stringify([
      { i: 'v6', n: 'V6', b: { t: 'r', r: 3.3 }, u: [], d: 0, c: Date.parse(createdAt) / 1000 },
      null,
    ]));
    storage.values.set(INSTANCES_V5_STORAGE_KEY, JSON.stringify([instance('v5')]));

    expect(loadInstances(storage, [instance('fallback')], 100)).toMatchObject({
      source: 'v6',
      instances: [{ id: 'v6' }],
    });
  });

  it('falls back from corrupt or invalid v6 to v5, then to defaults', () => {
    const storage = new FakeStorage();
    storage.values.set(INSTANCES_V6_STORAGE_KEY, '{');
    storage.values.set(INSTANCES_V5_STORAGE_KEY, JSON.stringify([instance('v5')]));
    expect(loadInstances(storage, [instance('fallback')], 100).source).toBe('v5');

    storage.values.set(INSTANCES_V5_STORAGE_KEY, 'null');
    expect(loadInstances(storage, [instance('fallback')], 100)).toEqual({
      source: 'fallback', instances: [instance('fallback')],
    });
  });

  it('loads an explicitly empty v5 dataset without restoring defaults', () => {
    const storage = new FakeStorage();
    storage.values.set(INSTANCES_V5_STORAGE_KEY, '[]');

    expect(loadInstances(storage, [instance('fallback')], 100)).toEqual({
      source: 'v5', instances: [],
    });
  });

  it('loads an explicitly empty v6 dataset without falling back', () => {
    const storage = new FakeStorage();
    storage.values.set(INSTANCES_V6_STORAGE_KEY, '[]');
    storage.values.set(INSTANCES_V5_STORAGE_KEY, JSON.stringify([instance('v5')]));

    expect(loadInstances(storage, [instance('fallback')], 100)).toEqual({
      source: 'v6', instances: [],
    });
  });

  it('retries stale v5 cleanup even when a reload selects v6', () => {
    const storage = new FakeStorage();
    storage.values.set(INSTANCES_V6_STORAGE_KEY, JSON.stringify([
      { i: 'v6', n: 'V6', b: { t: 'r', r: 3.3 }, u: [], d: 0, c: Date.parse(createdAt) / 1000 },
    ]));
    storage.values.set(INSTANCES_V5_STORAGE_KEY, JSON.stringify([instance('v5')]));

    expect(loadInstances(storage, [instance('fallback')], 100).source).toBe('v6');
    expect(hasLegacyInstances(storage)).toBe(true);
    expect(saveInstances(storage, [instance('v6')], hasLegacyInstances(storage))).toMatchObject({
      writeSucceeded: true, cleanupSucceeded: true, cleanupLegacy: false,
    });
    expect(storage.values.has(INSTANCES_V5_STORAGE_KEY)).toBe(false);
  });

  it('writes v6 before deleting v5 after an upgrade', () => {
    const storage = new FakeStorage();
    storage.values.set(INSTANCES_V5_STORAGE_KEY, 'legacy');
    expect(saveInstances(storage, [instance('saved')], true)).toEqual({
      writeSucceeded: true, cleanupSucceeded: true, cleanupLegacy: false,
    });
    expect(storage.events).toEqual([
      `set:${INSTANCES_V6_STORAGE_KEY}`,
      `remove:${INSTANCES_V5_STORAGE_KEY}`,
    ]);
  });

  it('retains v5 after failed writes and reports failed cleanup for retry', () => {
    const storage = new FakeStorage();
    storage.values.set(INSTANCES_V5_STORAGE_KEY, 'legacy');
    storage.failWrite = true;
    expect(saveInstances(storage, [instance('saved')], true)).toEqual({
      writeSucceeded: false, cleanupSucceeded: false, cleanupLegacy: true,
    });
    expect(storage.values.get(INSTANCES_V5_STORAGE_KEY)).toBe('legacy');
    expect(storage.events).not.toContain(`remove:${INSTANCES_V5_STORAGE_KEY}`);

    storage.failWrite = false;
    storage.failRemove = true;
    expect(saveInstances(storage, [instance('saved')], true).cleanupLegacy).toBe(true);
    storage.failRemove = false;
    expect(saveInstances(storage, [instance('saved')], true).cleanupLegacy).toBe(false);
  });
});
