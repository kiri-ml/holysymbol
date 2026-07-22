import { afterEach, describe, expect, it, vi } from 'vitest';
import { runsCsvFilename } from './exportRunsCsv';

describe('runs CSV filename', () => {
  afterEach(() => vi.useRealTimers());

  it('uses the current time when the export is requested', () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-07-22T00:00:00.000Z');

    expect(runsCsvFilename()).toBe('holy-symbol-2026-07-22.csv');
  });
});
