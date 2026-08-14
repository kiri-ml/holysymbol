import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ratioReceiptPath, type RatioReceipt } from '../../domain/ratioReceipt';
import { RatioReceiptDemo } from './RatioReceiptDemo';
import { RatioReceiptPage } from './RatioReceiptPage';

const receipt: RatioReceipt = {
  ign: 'Buyer123',
  startLevel: 120,
  startExpPercent: 25.5,
  endLevel: 121,
  endExpPercent: 10.2,
  ratio: 3.3,
};

function renderReceipt(pathname: string) {
  vi.stubGlobal('window', { location: { pathname } });
  return renderToStaticMarkup(<RatioReceiptPage />);
}

afterEach(() => vi.unstubAllGlobals());

describe('RatioReceiptPage', () => {
  it('renders a valid URL as a read-only billing receipt', () => {
    const markup = renderReceipt(ratioReceiptPath(receipt));
    expect(markup).toContain('Ratio receipt');
    expect(markup).toContain('Buyer123');
    expect(markup).toContain('Mesos due');
    expect(markup).toContain('1:3.3');
    expect(markup).toContain('Lv.120 · 25.50%');
    expect(markup).toContain('Lv.121 · 10.20%');
    expect(markup).toContain('href="/"');
    expect(markup).not.toContain('<input');
  });

  it('renders a generic invalid state without sample receipt data', () => {
    const markup = renderReceipt('/r1/broken.Buyer123');
    expect(markup).toContain('Invalid receipt');
    expect(markup).not.toContain('Buyer123');
    expect(markup).not.toContain('<input');
  });

  it('keeps editable entry controls on the separate demo page', () => {
    const markup = renderToStaticMarkup(<RatioReceiptDemo />);
    expect(markup).toContain('Ratio receipt URL');
    expect(markup).toContain('<input');
    expect(markup).toContain('href="/r1/');
  });
});
