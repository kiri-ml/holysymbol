import { describe, expect, it } from 'vitest';
import {
  decodeRatioReceipt,
  decodeRatioReceiptPath,
  encodeRatioReceipt,
  ratioReceiptPath,
  RatioReceiptError,
  type RatioReceipt,
} from './ratioReceipt';

const receipt: RatioReceipt = {
  ign: 'Buyer123',
  startLevel: 120,
  startExpPercent: 25.5,
  endLevel: 121,
  endExpPercent: 10.2,
  ratio: 3.3,
  tiers: [],
};

describe('ratio receipt codec', () => {
  it('round trips through a fixed 10-character code and IGN suffix', () => {
    const encoded = encodeRatioReceipt(receipt);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]{10}\.Buyer123$/);
    expect(decodeRatioReceipt(encoded)).toEqual(receipt);
    expect(decodeRatioReceiptPath(ratioReceiptPath(receipt))).toEqual(receipt);
  });

  it('supports every field boundary', () => {
    const minimum: RatioReceipt = { ign: 'Ab12', startLevel: 1, startExpPercent: 0, endLevel: 1, endExpPercent: 0, ratio: 0.01, tiers: [{ minLevel: 2, expPerMesoRatio: 0.01 }] };
    const maximum: RatioReceipt = { ign: 'Abcdef123456', startLevel: 200, startExpPercent: 99.99, endLevel: 200, endExpPercent: 99.99, ratio: 11.25, tiers: [{ minLevel: 200, expPerMesoRatio: 13.1 }] };
    expect(decodeRatioReceipt(encodeRatioReceipt(minimum))).toEqual(minimum);
    expect(decodeRatioReceipt(encodeRatioReceipt(maximum))).toEqual(maximum);
  });

  it('uses exactly three characters per canonical tier', () => {
    const one = encodeRatioReceipt({ ...receipt, tiers: [{ minLevel: 121, expPerMesoRatio: 4 }] });
    const two = encodeRatioReceipt({ ...receipt, tiers: [{ minLevel: 121, expPerMesoRatio: 4 }, { minLevel: 150, expPerMesoRatio: 3.75 }] });
    expect(one.split('.')[0]).toHaveLength(13);
    expect(two.split('.')[0]).toHaveLength(16);
    expect(decodeRatioReceipt(two).tiers).toEqual([{ minLevel: 121, expPerMesoRatio: 4 }, { minLevel: 150, expPerMesoRatio: 3.75 }]);
  });

  it('normalizes tier order and folds a level 1 tier into the core ratio', () => {
    const encoded = encodeRatioReceipt({ ...receipt, tiers: [
      { minLevel: 121, expPerMesoRatio: 4 },
      { minLevel: 1, expPerMesoRatio: 3.5 },
    ] });
    expect(encoded.split('.')[0]).toHaveLength(13);
    expect(decodeRatioReceipt(encoded)).toMatchObject({ ratio: 3.5, tiers: [{ minLevel: 121, expPerMesoRatio: 4 }] });
  });

  it('keeps tier groups independent while CRC changes with tier data', () => {
    const first = encodeRatioReceipt({ ...receipt, tiers: [{ minLevel: 121, expPerMesoRatio: 4 }, { minLevel: 150, expPerMesoRatio: 3.75 }] }).split('.')[0];
    const second = encodeRatioReceipt({ ...receipt, tiers: [{ minLevel: 121, expPerMesoRatio: 4 }, { minLevel: 150, expPerMesoRatio: 3.76 }] }).split('.')[0];
    expect(first.slice(0, 8)).toBe(second.slice(0, 8));
    expect(first.slice(10, 13)).toBe(second.slice(10, 13));
    expect(first.slice(13, 16)).not.toBe(second.slice(13, 16));
    expect(first.slice(8, 10)).not.toBe(second.slice(8, 10));
  });

  it('detects changes to the encoded data and IGN', () => {
    const encoded = encodeRatioReceipt(receipt);
    const replacement = encoded[0] === 'A' ? 'B' : 'A';
    expect(() => decodeRatioReceipt(replacement + encoded.slice(1))).toThrow(/checksum|range/);
    expect(() => decodeRatioReceipt(encoded.replace('Buyer123', 'Buyer124'))).toThrow('Receipt checksum does not match');
  });

  it('rejects noncanonical and out-of-range input', () => {
    expect(() => encodeRatioReceipt({ ...receipt, ign: 'no' })).toThrow(RatioReceiptError);
    expect(() => encodeRatioReceipt({ ...receipt, ratio: 0 })).toThrow(/at least 0\.01/);
    expect(() => encodeRatioReceipt({ ...receipt, ratio: 11.26 })).toThrow(/11\.25/);
    expect(() => encodeRatioReceipt({ ...receipt, tiers: [{ minLevel: 2, expPerMesoRatio: 0 }] })).toThrow(/at least 0\.01/);
    expect(() => encodeRatioReceipt({ ...receipt, tiers: [{ minLevel: 2, expPerMesoRatio: 13.11 }] })).toThrow(/13\.10/);
    expect(() => encodeRatioReceipt({ ...receipt, tiers: [{ minLevel: 2, expPerMesoRatio: 4 }, { minLevel: 2, expPerMesoRatio: 5 }] })).toThrow(/unique/);
    expect(() => decodeRatioReceipt(`${encodeRatioReceipt(receipt).split('.')[0]}A.Buyer123`)).toThrow(/length/);
    expect(() => encodeRatioReceipt({ ...receipt, startExpPercent: 1.234 })).toThrow(/precision/);
    expect(() => decodeRatioReceiptPath('/other/value')).toThrow(/\/r1\//);
  });
});
