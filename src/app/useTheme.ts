import { useEffect } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'legends-leech-calculator.theme.v1';

export function useTheme() {
  const [theme, setTheme] = useLocalStorage<ThemeMode>(THEME_STORAGE_KEY, 'system');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return [theme, setTheme] as const;
}
