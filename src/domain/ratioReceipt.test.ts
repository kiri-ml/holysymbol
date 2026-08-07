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
};

describe('ratio receipt codec', () => {
  it('round trips through a fixed 10-character code and IGN suffix', () => {
    const encoded = encodeRatioReceipt(receipt);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]{10}\.Buyer123$/);
    expect(decodeRatioReceipt(encoded)).toEqual(receipt);
    expect(decodeRatioReceiptPath(ratioReceiptPath(receipt))).toEqual(receipt);
  });

  it('supports every field boundary', () => {
    const minimum = { ign: 'Ab12', startLevel: 1, startExpPercent: 0, endLevel: 1, endExpPercent: 0, ratio: 0 };
    const maximum = { ign: 'Abcdef123456', startLevel: 200, startExpPercent: 99.99, endLevel: 200, endExpPercent: 99.99, ratio: 11.24 };
    expect(decodeRatioReceipt(encodeRatioReceipt(minimum))).toEqual(minimum);
    expect(decodeRatioReceipt(encodeRatioReceipt(maximum))).toEqual(maximum);
  });

  it('detects changes to the encoded data and IGN', () => {
    const encoded = encodeRatioReceipt(receipt);
    const replacement = encoded[0] === 'A' ? 'B' : 'A';
    expect(() => decodeRatioReceipt(replacement + encoded.slice(1))).toThrow(/checksum|range/);
    expect(() => decodeRatioReceipt(encoded.replace('Buyer123', 'Buyer124'))).toThrow('Receipt checksum does not match');
  });

  it('rejects noncanonical and out-of-range input', () => {
    expect(() => encodeRatioReceipt({ ...receipt, ign: 'no' })).toThrow(RatioReceiptError);
    expect(() => encodeRatioReceipt({ ...receipt, ratio: 11.25 })).toThrow(/11\.24/);
    expect(() => encodeRatioReceipt({ ...receipt, startExpPercent: 1.234 })).toThrow(/precision/);
    expect(() => decodeRatioReceiptPath('/other/value')).toThrow(/\/r1\//);
  });
});
