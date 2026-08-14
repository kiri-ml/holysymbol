import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../i18n';
import { ConfirmProvider } from '../../../app/confirmation';
import type { CharacterSnapshot, HourlyBilling, LeechBuyer, RatioBilling } from '../../../domain/types';
import { BuyerRow } from './BuyerRow';
import { createBuyerReceiptLink } from './buyerReceiptLink';

const snapshot = (level: number, expPercent: number): CharacterSnapshot => ({
  ign: 'Buyer123',
  level,
  expPercent,
  capturedAt: '2026-08-14T00:00:00.000Z',
  source: 'api',
});
const buyer: LeechBuyer = {
  id: 1,
  ign: 'Buyer123',
  start: snapshot(120, 25.5),
  current: snapshot(121, 10.2),
};
const ratio: RatioBilling = { type: 'ratio', expPerMesoRatio: 3.3, tiers: [] };
const hourly: HourlyBilling = {
  type: 'hourly',
  hourlyRateMesos: 12_000_000,
  ledger: { status: 'idle', accumulatedMs: 0, accounts: {} },
};

function renderBuyer(rowBuyer: LeechBuyer, billing: RatioBilling | HourlyBilling) {
  return renderToStaticMarkup(
    <ConfirmProvider>
      <BuyerRow
        billing={billing}
        buyer={rowBuyer}
        busy={false}
        now={0}
        onRefreshSnapshot={async () => undefined}
        onSetManualSnapshot={() => undefined}
        onSetCompleted={() => undefined}
        onDelete={() => undefined}
      />
    </ConfirmProvider>,
  );
}

describe('BuyerRow receipt footer', () => {
  it('keeps the editor for an unlocked buyer', () => {
    const markup = renderBuyer(buyer, ratio);
    expect(markup).toContain('<summary>Edit buyer</summary>');
    expect(markup).not.toContain('View receipt');
  });

  it('replaces the editor with a new-tab receipt link for an eligible locked buyer', () => {
    const locked = { ...buyer, locked: true };
    const result = createBuyerReceiptLink(locked, ratio);
    expect(result.status).toBe('available');
    const markup = renderBuyer(locked, ratio);

    expect(markup).not.toContain('<summary>Edit buyer</summary>');
    expect(markup).toContain('View receipt');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    if (result.status === 'available') expect(markup).toContain(`href="${result.path}"`);
  });

  it('disables incomplete receipts and links tiered receipts', () => {
    const incomplete = renderBuyer({ ...buyer, locked: true, current: undefined }, ratio);
    expect(incomplete).toContain('aria-disabled="true"');
    expect(incomplete).toContain('add a valid IGN and both snapshots');
    expect(incomplete).not.toContain('href="/r1/');

    const tiered = renderBuyer(
      { ...buyer, locked: true },
      { ...ratio, tiers: [{ minLevel: 121, expPerMesoRatio: 4 }] },
    );
    expect(tiered).toContain('View receipt');
    expect(tiered).toContain('href="/r1/');
  });

  it('shows neither editor nor ratio receipt footer for a locked hourly buyer', () => {
    const markup = renderBuyer({ ...buyer, locked: true }, hourly);
    expect(markup).not.toContain('<summary>Edit buyer</summary>');
    expect(markup).not.toContain('View receipt');
    expect(markup).not.toContain('Receipt unavailable');
  });
});
