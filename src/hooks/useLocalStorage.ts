import { useEffect, useRef, useState } from 'react';
import { createDebouncedPersistence } from './debouncedPersistence';

export type LocalStorageOptions<T> = {
  normalize?: (value: unknown) => T;
  debounceMs?: number;
  flushOnHide?: boolean;
};

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  {
    normalize,
    debounceMs = 0,
    flushOnHide = false,
  }: LocalStorageOptions<T> = {},
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (!stored) return initialValue;
      const parsed = JSON.parse(stored) as unknown;
      return normalize ? normalize(parsed) : (parsed as T);
    } catch {
      return initialValue;
    }
  });
  const latestRef = useRef(value);
  latestRef.current = value;
  const keyRef = useRef(key);
  keyRef.current = key;
  const persistenceRef = useRef<ReturnType<typeof createDebouncedPersistence> | null>(null);
  if (persistenceRef.current === null) {
    persistenceRef.current = createDebouncedPersistence(() => {
      try {
        window.localStorage.setItem(keyRef.current, JSON.stringify(latestRef.current));
        return true;
      } catch {
        // Local storage can fail in private windows or quota-limited contexts.
        return false;
      }
    }, debounceMs);
  }
  const mountedRef = useRef(false);
  const processedRef = useRef<{ key: string; value: T } | null>(null);

  useEffect(() => {
    if (processedRef.current?.key === key && processedRef.current.value === value) return;
    processedRef.current = { key, value };
    persistenceRef.current!.schedule();
    if (!mountedRef.current || debounceMs === 0) {
      mountedRef.current = true;
      persistenceRef.current!.flush();
    }
  }, [debounceMs, key, value]);

  useEffect(() => {
    if (!flushOnHide) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') persistenceRef.current!.flush();
    };
    const handlePageHide = () => persistenceRef.current!.flush();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      persistenceRef.current!.flush();
    };
  }, [flushOnHide]);

  return [value, setValue] as const;
}
