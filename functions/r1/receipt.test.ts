import { describe, expect, it } from 'vitest';
import { encodeRatioReceipt, type RatioReceipt } from '../../src/domain/ratioReceipt';
import { createReceiptPreviewMetadata, receiptOpenGraphTags } from './[receipt]';

const receipt: RatioReceipt = {
  ign: 'Buyer123',
  startLevel: 120,
  startExpPercent: 25.5,
  endLevel: 121,
  endExpPercent: 10.2,
  ratio: 3.3,
  tiers: [],
};

describe('ratio receipt Discord metadata', () => {
  it('creates text-only receipt metadata from a valid payload', () => {
    const payload = encodeRatioReceipt(receipt);
    const metadata = createReceiptPreviewMetadata(payload, `https://test.holysymbol.pages.dev/r1/${payload}?source=discord`);

    expect(metadata).toMatchObject({
      title: expect.stringMatching(/^Buyer123 · .* mesos due$/),
      description: expect.stringMatching(/^Lv\.120 25\.50% → Lv\.121 10\.20% · 1:3\.3 · .* EXP$/),
      url: `https://test.holysymbol.pages.dev/r1/${payload}`,
    });
    expect(metadata).not.toHaveProperty('image');
    const tags = receiptOpenGraphTags(metadata!);
    expect(tags).toContain('property="og:title"');
    expect(tags).toContain('property="og:description"');
    expect(tags).not.toContain('og:image');
  });

  it('summarizes tiered billing as its ratio range', () => {
    const payload = encodeRatioReceipt({ ...receipt, tiers: [{ minLevel: 121, expPerMesoRatio: 4.5 }, { minLevel: 150, expPerMesoRatio: 3.8 }] });
    expect(createReceiptPreviewMetadata(payload, `https://example.test/r1/${payload}`)?.description).toContain('1:3.3~4.5');
  });

  it('uses a receipt title when a zero ratio has no calculable charge', () => {
    const payload = encodeRatioReceipt({ ...receipt, ratio: 0 });
    expect(createReceiptPreviewMetadata(payload, `https://example.test/r1/${payload}`)?.title).toBe('Buyer123 · Ratio receipt');
  });

  it('rejects damaged and malformed receipt payloads', () => {
    const payload = encodeRatioReceipt(receipt);
    expect(createReceiptPreviewMetadata(payload.replace('Buyer123', 'Buyer124'), 'https://example.test/r1/bad')).toBeUndefined();
    expect(createReceiptPreviewMetadata('bad', 'https://example.test/r1/bad')).toBeUndefined();
  });
});
