export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'legends-leech-calculator.theme.v1';

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function readStoredTheme(storage: Pick<Storage, 'getItem'>): ThemeMode {
  try {
    const storedTheme = storage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === null) return 'system';

    const parsedTheme: unknown = JSON.parse(storedTheme);
    return isThemeMode(parsedTheme) ? parsedTheme : 'system';
  } catch {
    return 'system';
  }
}

export function writeStoredTheme(storage: Pick<Storage, 'setItem'>, theme: ThemeMode) {
  try {
    storage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // Theme changes still apply when storage is unavailable.
  }
}

export function applyTheme(root: Pick<HTMLElement, 'dataset'>, theme: ThemeMode) {
  root.dataset.theme = theme;
}
