import { describe, expect, it, vi } from 'vitest';
import { applyTheme, readStoredTheme, THEME_STORAGE_KEY, writeStoredTheme } from './theme';

describe('theme storage', () => {
  it.each(['system', 'light', 'dark'] as const)('reads JSON-encoded %s', (theme) => {
    const storage = { getItem: vi.fn(() => JSON.stringify(theme)) };

    expect(readStoredTheme(storage)).toBe(theme);
    expect(storage.getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
  });

  it.each([null, 'dark', '"unknown"', '{malformed'])('defaults invalid storage value %s to system', (value) => {
    expect(readStoredTheme({ getItem: () => value })).toBe('system');
  });

  it('defaults to system when storage cannot be read', () => {
    expect(readStoredTheme({ getItem: () => { throw new Error('unavailable'); } })).toBe('system');
  });

  it('writes the shared JSON storage format', () => {
    const storage = { setItem: vi.fn() };

    writeStoredTheme(storage, 'dark');

    expect(storage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, '"dark"');
  });

  it('ignores storage write failures', () => {
    expect(() => writeStoredTheme({ setItem: () => { throw new Error('unavailable'); } }, 'dark')).not.toThrow();
  });
});

describe('applyTheme', () => {
  it('updates the root theme attribute', () => {
    const root = { dataset: {} } as Pick<HTMLElement, 'dataset'>;

    applyTheme(root, 'dark');

    expect(root.dataset.theme).toBe('dark');
  });
});
