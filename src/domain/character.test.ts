import { describe, expect, it } from 'vitest';
import { createManualSnapshot, normalizeCharacter } from './character';

describe('character snapshots', () => {
  it('creates API snapshots without persistent identity', () => {
    const snapshot = normalizeCharacter({ name: 'Buyer', level: 120, exp: '12.5%', job: 'Bishop' }, 'Fallback');

    expect(snapshot).not.toHaveProperty('id');
    expect(snapshot).toMatchObject({ ign: 'Buyer', level: 120, expPercent: 12.5, source: 'api' });
  });

  it('creates manual snapshots without persistent identity', () => {
    const snapshot = createManualSnapshot({
      ign: 'Buyer', level: 120, expPercent: 25, capturedAt: '2026-06-09T00:00:00.123Z',
    });

    expect(snapshot).not.toHaveProperty('id');
    expect(snapshot).toEqual({
      ign: 'Buyer', level: 120, expPercent: 25, capturedAt: '2026-06-09T00:00:00.123Z', source: 'manual',
    });
  });
});
