import { ArrowLeft, ArrowRight, BadgeCheck, CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCompact, formatExp, formatPercent, formatRatio } from '../../domain/format';
import { decodeRatioReceiptPath } from '../../domain/ratioReceipt';
import { calculateRatioReceipt } from '../../domain/ratioReceiptCalculation';
import { CopyMesosMetric } from '../../ui/metric';
import { Surface } from '../../ui/surface';
import styles from './RatioReceiptPage.module.css';

function ReceiptBrand() {
  const { t } = useTranslation();
  return (
    <div className={styles.brand}>
      <img src="/assets/icons/hs.png" alt="" className={styles.logo} />
      <span>{t('app.name')}</span>
    </div>
  );
}

function HomeLink() {
  const { t } = useTranslation();
  return <a className={styles.home} href="/"><ArrowLeft size={16} aria-hidden="true" />{t('receipt.backToCalculator')}</a>;
}

export function RatioReceiptPage() {
  const { t } = useTranslation();
  let receipt;
  try {
    receipt = decodeRatioReceiptPath(window.location.pathname);
  } catch {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <ReceiptBrand />
          <Surface className={`${styles.card} ${styles.invalid}`} padding="large">
            <CircleAlert className={styles.invalidIcon} size={36} aria-hidden="true" />
            <h1>{t('receipt.invalidTitle')}</h1>
            <p>{t('receipt.invalidBody')}</p>
            <HomeLink />
          </Surface>
        </div>
      </main>
    );
  }

  const calculation = calculateRatioReceipt(receipt);
  const start = t('snapshot.short', { level: receipt.startLevel, expPercent: formatPercent(receipt.startExpPercent) });
  const end = t('snapshot.short', { level: receipt.endLevel, expPercent: formatPercent(receipt.endExpPercent) });

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <ReceiptBrand />
        <Surface as="article" className={styles.card} padding="large">
          <header className={styles.heading}>
            <div>
              <p className={styles.eyebrow}>{t('receipt.title')}</p>
              <h1 className={styles.name}>{receipt.ign}</h1>
            </div>
            <span className={styles.valid}><BadgeCheck size={15} aria-hidden="true" />{t('receipt.validLink')}</span>
          </header>

          <CopyMesosMetric
            className={styles.due}
            format="precise"
            value={calculation.mesosDue}
            disabled={calculation.mesosDue === undefined}
            label={t('receipt.mesosDue')}
            copiedLabel={t('common.copied')}
            copyAriaLabel={t('receipt.copyDue')}
            copiedAriaLabel={t('receipt.dueCopied')}
          />

          <section className={styles.progress} aria-label={t('receipt.progress')}>
            <div className={styles.snapshot}><span>{t('common.start')}</span><strong>{start}</strong></div>
            <ArrowRight className={styles.arrow} size={20} aria-hidden="true" />
            <div className={styles.snapshot}><span>{t('common.current')}</span><strong>{end}</strong></div>
          </section>

          <dl className={styles.breakdown}>
            <div>
              <dt>{t('buyer.expGained')}</dt>
              <dd>{formatCompact(calculation.expGained)}</dd>
              <span className={styles.detail}>{formatExp(calculation.expGained)} EXP</span>
            </div>
            <div>
              <dt>{t('billing.baseRatio')}</dt>
              <dd>{formatRatio(receipt.ratio)}</dd>
              <span className={styles.detail}>{t('receipt.expPerMeso')}</span>
            </div>
          </dl>

          {receipt.tiers.length > 0 ? (
            <section className={styles.pricing} aria-labelledby="receipt-pricing">
              <h2 id="receipt-pricing">{t('billing.pricing')}</h2>
              <dl className={styles.schedule}>
                <div><dt>{t('billing.tierLevel')} 1</dt><dd>{formatRatio(receipt.ratio)}</dd></div>
                {receipt.tiers.map((tier) => (
                  <div key={tier.minLevel}>
                    <dt>{t('billing.tierLevel')} {tier.minLevel}</dt>
                    <dd>{formatRatio(tier.expPerMesoRatio)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {calculation.mesosDue === undefined ? <p className={styles.notice}>{t('receipt.zeroRatio')}</p> : null}
        </Surface>
        <footer className={styles.footer}><HomeLink /></footer>
      </div>
    </main>
  );
}
