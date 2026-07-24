import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedPersistence } from './debouncedPersistence';

describe('debounced persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('coalesces schedules and persists the latest state after the delay', () => {
    let latest = 'first';
    const persisted: string[] = [];
    const persistence = createDebouncedPersistence(() => {
      persisted.push(latest);
      return true;
    }, 350);

    persistence.schedule();
    latest = 'second';
    vi.advanceTimersByTime(200);
    persistence.schedule();
    vi.advanceTimersByTime(349);
    expect(persisted).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(persisted).toEqual(['second']);
  });

  it('flushes immediately and cancels scheduled work', () => {
    const persist = vi.fn(() => true);
    const persistence = createDebouncedPersistence(persist, 350);

    persistence.schedule();
    persistence.flush();
    expect(persist).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(350);
    expect(persist).toHaveBeenCalledTimes(1);

    persistence.schedule();
    persistence.cancel();
    vi.advanceTimersByTime(350);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed write pending for a later flush', () => {
    const persist = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const persistence = createDebouncedPersistence(persist, 350);

    persistence.schedule();
    vi.advanceTimersByTime(350);
    expect(persist).toHaveBeenCalledTimes(1);

    persistence.flush();
    expect(persist).toHaveBeenCalledTimes(2);
    persistence.flush();
    expect(persist).toHaveBeenCalledTimes(2);
  });
});
