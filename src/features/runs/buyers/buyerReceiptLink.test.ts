import { describe, expect, it } from 'vitest';
import { decodeRatioReceiptPath } from '../../../domain/ratioReceipt';
import type { CharacterSnapshot, HourlyBilling, LeechBuyer, RatioBilling } from '../../../domain/types';
import { createBuyerReceiptLink } from './buyerReceiptLink';

const snapshot = (ign: string, level: number, expPercent: number): CharacterSnapshot => ({
  ign,
  level,
  expPercent,
  capturedAt: '2026-08-14T00:00:00.000Z',
  source: 'api',
});
const buyer: LeechBuyer = {
  id: 1,
  ign: 'Buyer123',
  locked: true,
  start: snapshot('Buyer123', 120, 25.5),
  current: snapshot('Buyer123', 121, 10.2),
};
const ratio: RatioBilling = { type: 'ratio', expPerMesoRatio: 3.3, tiers: [] };

describe('createBuyerReceiptLink', () => {
  it('creates a round-trippable v1 URL for a complete flat-ratio buyer', () => {
    const result = createBuyerReceiptLink(buyer, ratio);
    expect(result.status).toBe('available');
    if (result.status === 'available') {
      expect(decodeRatioReceiptPath(result.path)).toEqual({
        ign: 'Buyer123',
        startLevel: 120,
        startExpPercent: 25.5,
        endLevel: 121,
        endExpPercent: 10.2,
        ratio: 3.3,
        tiers: [],
      });
    }
  });

  it('reports missing or invalid receipt identity and snapshots', () => {
    expect(createBuyerReceiptLink({ ...buyer, current: undefined }, ratio)).toEqual({ status: 'unavailable', reason: 'missing-data' });
    expect(createBuyerReceiptLink({ ...buyer, ign: 'bad_name', start: undefined }, ratio)).toEqual({ status: 'unavailable', reason: 'missing-data' });
  });

  it('encodes the complete tiered pricing schedule', () => {
    const result = createBuyerReceiptLink(buyer, { ...ratio, tiers: [{ minLevel: 121, expPerMesoRatio: 4 }] });
    expect(result.status).toBe('available');
    if (result.status === 'available') {
      expect(decodeRatioReceiptPath(result.path).tiers).toEqual([{ minLevel: 121, expPerMesoRatio: 4 }]);
    }
  });

  it('reports values outside the v1 encoding range', () => {
    expect(createBuyerReceiptLink(buyer, { ...ratio, expPerMesoRatio: 11.26 }))
      .toEqual({ status: 'unavailable', reason: 'encoding' });
  });

  it('does not offer a ratio receipt for hourly billing', () => {
    const hourly: HourlyBilling = {
      type: 'hourly',
      hourlyRateMesos: 12_000_000,
      ledger: { status: 'idle', accumulatedMs: 0, accounts: {} },
    };
    expect(createBuyerReceiptLink(buyer, hourly)).toEqual({ status: 'unsupported' });
  });
});
