import { useEffect, useRef, useState } from 'react';
import { hasLegacyInstances, loadInstances, saveInstances } from '../domain/instancesRepository';
import type { LeechInstance } from '../domain/types';

export function useInstancesStorage(initialValue: LeechInstance[]) {
  const loadedRef = useRef<ReturnType<typeof loadInstances> | null>(null);
  if (loadedRef.current === null) loadedRef.current = loadInstances(window.localStorage, initialValue);
  const migrationPendingRef = useRef(hasLegacyInstances(window.localStorage));
  const [instances, setInstances] = useState(loadedRef.current.instances);

  useEffect(() => {
    const result = saveInstances(window.localStorage, instances, migrationPendingRef.current);
    migrationPendingRef.current = result.cleanupLegacy;
  }, [instances]);

  return [instances, setInstances] as const;
}
