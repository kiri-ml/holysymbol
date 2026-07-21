import { describe, expect, it } from 'vitest';
import { decodeV6Instances, encodeV6Instances } from './v6Codec';
import type { LeechInstance } from './types';

describe('v6 codec', () => {
  it('encodes the compact schema exactly and round-trips tuple snapshots', () => {
    const original: LeechInstance = {
      id: 'run', name: 'Run',
      billing: { type: 'ratio', expPerMesoRatio: 3.3, tiers: [{ minLevel: 120, expPerMesoRatio: 4 }] },
      buyers: [{
        id: 2, ign: 'Buyer', locked: true,
        start: { ign: 'Buyer', level: 120, expPercent: 10, job: 'Bishop', capturedAt: '2026-06-09T00:00:00.000Z', source: 'api' },
      }],
      nextBuyerId: 3,
      createdAt: '2026-06-09T00:00:00.000Z',
    };
    const encoded = encodeV6Instances([original]);
    expect(encoded).toEqual([{
      i: 'run', n: 'Run', b: { t: 'r', r: 3.3, q: [[120, 4]] },
      u: [{ i: 2, n: 'Buyer', l: 1, j: 'Bishop', s: [120, 10, 0, 0] }],
      d: 3, c: Date.parse(original.createdAt) / 1000,
    }]);
    expect(decodeV6Instances(encoded)?.[0]).toMatchObject(original);
  });

  it('stores metadata times as seconds while preserving hourly milliseconds', () => {
    const original: LeechInstance = {
      id: 'seconds', name: 'Seconds',
      billing: {
        type: 'hourly', hourlyRateMesos: 12_000_000,
        ledger: {
          status: 'running', accumulatedMs: 1_234,
          checkpointAt: 1_780_963_210_987,
          accounts: { 0: { accruedMs: 567, active: true } },
        },
      },
      buyers: [{
        id: 0, ign: 'Buyer',
        start: { ign: 'Buyer', level: 120, expPercent: 1, capturedAt: '2026-06-09T00:00:05.999Z', source: 'api' },
        current: { ign: 'Buyer', level: 121, expPercent: 2, capturedAt: '2026-06-09T00:01:10.123Z', source: 'manual' },
      }],
      nextBuyerId: 1,
      createdAt: '2026-06-09T00:00:10.987Z',
      lastCurrentRefreshedAt: '2026-06-09T00:02:10.999Z',
    };

    const encoded = encodeV6Instances([original])[0];
    expect(encoded.c).toBe(Date.parse(original.createdAt) / 1000 - 0.987);
    expect(encoded.r).toBe(120);
    expect(encoded.u[0].s?.[2]).toBe(-5);
    expect(encoded.u[0].c?.[2]).toBe(60);
    expect(encoded.b).toMatchObject({
      l: { t: 1_234, c: 1_780_963_210_987, a: { 0: { m: 567 } } },
    });

    const decoded = decodeV6Instances([encoded])![0];
    expect(decoded.createdAt).toBe('2026-06-09T00:00:10.000Z');
    expect(decoded.lastCurrentRefreshedAt).toBe('2026-06-09T00:02:10.000Z');
    expect(decoded.buyers[0].start?.capturedAt).toBe('2026-06-09T00:00:05.000Z');
    expect(decoded.buyers[0].current?.capturedAt).toBe('2026-06-09T00:01:10.000Z');
    expect((decoded.billing.type === 'hourly' ? decoded.billing.ledger : undefined)).toMatchObject({
      accumulatedMs: 1_234, checkpointAt: 1_780_963_210_987,
      accounts: { 0: { accruedMs: 567, active: true } },
    });
  });

  it('distinguishes an empty dataset from malformed data', () => {
    expect(decodeV6Instances([])).toEqual([]);
    expect(decodeV6Instances([null, 'bad'])).toBeUndefined();
    expect(decodeV6Instances([{
      id: 'verbose', name: 'Unsupported provisional v6',
      billing: { type: 'ratio', expPerMesoRatio: 3.3 }, buyers: [], createdAt: '2026-06-09T00:00:00.000Z',
    }])).toBeUndefined();
  });

  it('rejects invalid core fields and salvages optional nested data', () => {
    const invalidCore = [
      { i: '', n: 'Missing ID', b: { t: 'r', r: 3.3 }, u: [], d: 0, c: 0 },
      { i: 'bad-type', n: 'Bad type', b: { t: 'x', r: 3.3 }, u: [], d: 0, c: 0 },
      { i: 'bad-counter', n: 'Bad counter', b: { t: 'r', r: 3.3 }, u: [], d: -1, c: 0 },
      { i: 'bad-time', n: 'Bad time', b: { t: 'r', r: 3.3 }, u: [], d: 0, c: -1 },
      { i: 'fractional-time', n: 'Fractional time', b: { t: 'r', r: 3.3 }, u: [], d: 0, c: 1.5 },
      { i: 'unsafe-time', n: 'Unsafe time', b: { t: 'r', r: 3.3 }, u: [], d: 0, c: Number.MAX_SAFE_INTEGER },
      { i: 'bad-ledger', n: 'Bad ledger', b: { t: 'h', r: 1, l: { s: 'r', t: 0, a: {} } }, u: [], d: 0, c: 0 },
    ];
    expect(decodeV6Instances(invalidCore)).toBeUndefined();

    const decoded = decodeV6Instances([{
      i: 'salvage', n: 'Salvage',
      b: { t: 'h', r: 1, l: { s: 'p', t: 5, a: { 2: { m: -1, r: 1 }, missing: { m: 10 } } } },
      x: { t: 'r', r: 3, q: [[201, 4], [120, -1]] },
      u: [{ i: 2, n: 'A' }, { i: 2, n: 'Duplicate' }, { i: -1, n: 'Invalid' }], d: 3, c: 0,
    }])!;
    expect(decoded[0].buyers.map((buyer) => buyer.id)).toEqual([2]);
    expect(decoded[0].nextBuyerId).toBe(3);
    expect(decoded[0].billing).toMatchObject({ hourlyRateMesos: 1, ledger: { accumulatedMs: 5, accounts: { 2: { accruedMs: 0, active: false } } } });
    expect(decoded[0].inactiveBilling?.ratio?.tiers).toEqual([
      { minLevel: 120, expPerMesoRatio: 0 }, { minLevel: 200, expPerMesoRatio: 4 },
    ]);
  });

  it('drops snapshots with levels outside the supported integer range', () => {
    const decoded = decodeV6Instances([{
      i: 'levels', n: 'Levels', b: { t: 'r', r: 3.3 },
      u: [
        { i: 0, n: 'Zero', s: [0, 1, 0, 0] },
        { i: 1, n: 'High', s: [201, 1, 0, 0] },
        { i: 2, n: 'Fractional', s: [120.5, 1, 0, 0] },
        { i: 3, n: 'Valid', s: [120, 1, 0, 0] },
      ],
      d: 4, c: 1_780_963_200,
    }])![0];

    expect(decoded.buyers.slice(0, 3).map((buyer) => buyer.start)).toEqual([undefined, undefined, undefined]);
    expect(decoded.buyers[3].start?.level).toBe(120);
  });

  it('drops snapshots and refresh times with malformed relative offsets', () => {
    const decoded = decodeV6Instances([{
      i: 'offsets', n: 'Offsets', b: { t: 'r', r: 3.3 },
      u: [{ i: 0, n: 'Buyer', s: [120, 1, 0.5, 0], c: [121, 2, Number.MAX_SAFE_INTEGER, 1] }],
      d: 1, c: 1_780_963_200, r: 0.5,
    }])![0];
    expect(decoded.lastCurrentRefreshedAt).toBeUndefined();
    expect(decoded.buyers[0].start).toBeUndefined();
    expect(decoded.buyers[0].current).toBeUndefined();
  });

  it('ignores persisted fame metadata', () => {
    const decoded = decodeV6Instances([{
      i: 'fame', n: 'Fame', b: { t: 'r', r: 3.3 },
      u: [{ i: 0, n: 'Buyer', f: 999, s: [120, 1, 0, 0] }],
      d: 1, c: 1_780_963_200,
    }])![0];
    expect(decoded.buyers[0].start).not.toHaveProperty('fame');
  });

  it('salvages valid records from a mixed array', () => {
    expect(decodeV6Instances([
      {},
      { i: 'valid', n: 'Valid', b: { t: 'r', r: 3.3 }, u: [], d: 0, c: 0 },
    ])?.map((instance) => instance.id)).toEqual(['valid']);
  });
});
