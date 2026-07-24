import { useEffect, useRef, useState } from 'react';
import {
  hasLegacyInstances,
  loadInstances,
  readV6StorageUpdate,
  saveInstances,
} from '../domain/instancesRepository';
import type { LeechInstance } from '../domain/types';

export function useInstancesStorage(initialValue: LeechInstance[]) {
  const loadedRef = useRef<ReturnType<typeof loadInstances> | null>(null);
  if (loadedRef.current === null) loadedRef.current = loadInstances(window.localStorage, initialValue);
  const fingerprintRef = useRef(loadedRef.current.fingerprint);
  const migrationPendingRef = useRef(hasLegacyInstances(window.localStorage));
  const externalInstancesRef = useRef<LeechInstance[] | null>(null);
  const [instances, setInstances] = useState(loadedRef.current.instances);

  useEffect(() => {
    // Skip only the exact externally loaded state; a local update batched after it must still save.
    if (instances === externalInstancesRef.current) {
      externalInstancesRef.current = null;
      return;
    }
    externalInstancesRef.current = null;
    const result = saveInstances(window.localStorage, instances, migrationPendingRef.current);
    migrationPendingRef.current = result.cleanupLegacy;
    if (result.fingerprint !== undefined) fingerprintRef.current = result.fingerprint;
  }, [instances]);

  useEffect(() => {
    const syncFromStorage = () => {
      const update = readV6StorageUpdate(window.localStorage, fingerprintRef.current);
      if (update.status !== 'updated') return;
      fingerprintRef.current = update.fingerprint;
      externalInstancesRef.current = update.instances;
      setInstances(update.instances);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncFromStorage();
    };

    window.addEventListener('focus', syncFromStorage);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', syncFromStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return [instances, setInstances] as const;
}
