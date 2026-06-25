import { useEffect, useState } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T, normalize?: (value: unknown) => T) {
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

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Local storage can fail in private windows or quota-limited contexts.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
