import { useEffect, useState } from 'react';
import { applyTheme, readStoredTheme, type ThemeMode, writeStoredTheme } from './theme';

export type { ThemeMode } from './theme';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme(window.localStorage));

  useEffect(() => {
    applyTheme(document.documentElement, theme);
    writeStoredTheme(window.localStorage, theme);
  }, [theme]);

  return [theme, setTheme] as const;
}
