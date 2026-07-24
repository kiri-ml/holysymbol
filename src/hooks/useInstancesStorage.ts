import { useEffect, useRef, useState } from 'react';
import {
  hasLegacyInstances,
  loadInstances,
  readV6StorageUpdate,
  saveInstances,
} from '../domain/instancesRepository';
import type { LeechInstance } from '../domain/types';
import { createDebouncedPersistence } from './debouncedPersistence';

export function useInstancesStorage(initialValue: LeechInstance[]) {
  const loadedRef = useRef<ReturnType<typeof loadInstances> | null>(null);
  if (loadedRef.current === null) loadedRef.current = loadInstances(window.localStorage, initialValue);
  const fingerprintRef = useRef(loadedRef.current.fingerprint);
  const migrationPendingRef = useRef(hasLegacyInstances(window.localStorage));
  const externalInstancesRef = useRef<LeechInstance[] | null>(null);
  const [instances, setInstances] = useState(loadedRef.current.instances);
  const latestInstancesRef = useRef(instances);
  latestInstancesRef.current = instances;
  const persistenceRef = useRef<ReturnType<typeof createDebouncedPersistence> | null>(null);
  if (persistenceRef.current === null) {
    persistenceRef.current = createDebouncedPersistence(() => {
      const result = saveInstances(
        window.localStorage,
        latestInstancesRef.current,
        migrationPendingRef.current,
      );
      migrationPendingRef.current = result.cleanupLegacy;
      if (result.fingerprint !== undefined) fingerprintRef.current = result.fingerprint;
      return result.writeSucceeded;
    });
  }
  const mountedRef = useRef(false);
  const processedInstancesRef = useRef<LeechInstance[] | null>(null);

  useEffect(() => {
    // Skip only the exact externally loaded state; a local update batched after it must still save.
    if (instances === externalInstancesRef.current) {
      externalInstancesRef.current = null;
      processedInstancesRef.current = instances;
      return;
    }
    externalInstancesRef.current = null;
    if (instances === processedInstancesRef.current) return;
    processedInstancesRef.current = instances;
    if (!mountedRef.current) {
      mountedRef.current = true;
      persistenceRef.current!.schedule();
      persistenceRef.current!.flush();
      return;
    }
    persistenceRef.current!.schedule();
  }, [instances]);

  useEffect(() => {
    const syncFromStorage = () => {
      const update = readV6StorageUpdate(window.localStorage, fingerprintRef.current);
      if (update.status !== 'updated') return;
      persistenceRef.current!.cancel();
      fingerprintRef.current = update.fingerprint;
      externalInstancesRef.current = update.instances;
      setInstances(update.instances);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') persistenceRef.current!.flush();
      else syncFromStorage();
    };
    const handlePageHide = () => persistenceRef.current!.flush();

    window.addEventListener('focus', syncFromStorage);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', syncFromStorage);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      persistenceRef.current!.flush();
    };
  }, []);

  return [instances, setInstances] as const;
}
