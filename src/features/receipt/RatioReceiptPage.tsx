import { ArrowLeft, BadgeCheck, CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatExp, formatMesosShortPrecise, formatPercent, formatRatio } from '../../domain/format';
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

          <section className={styles.items} aria-labelledby="receipt-details">
            <h2 id="receipt-details">{t('receipt.details')}</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>{t('receipt.progress')}</th><th>{t('billing.ratio')}</th><th>EXP</th><th>{t('common.due')}</th></tr></thead>
                <tbody>
                  {calculation.segments.map((segment, index) => (
                    <tr key={`${segment.startLevel}-${segment.startExpPercent}-${index}`}>
                      <td>
                        <span>{t('snapshot.short', { level: segment.startLevel, expPercent: formatPercent(segment.startExpPercent) })}</span>
                        <span className={styles.rangeTo}>→ {t('snapshot.short', { level: segment.endLevel, expPercent: formatPercent(segment.endExpPercent) })}</span>
                      </td>
                      <td>{formatRatio(segment.ratio)}</td>
                      <td>{formatExp(segment.expGained)}</td>
                      <td>{formatMesosShortPrecise(segment.mesosDue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className={styles.summary}>
            <div className={styles.subtotal}><span>{t('receipt.expSubtotal')}</span><strong>{formatExp(calculation.expGained)} EXP</strong></div>
            <CopyMesosMetric
              className={styles.total}
              format="precise"
              value={calculation.mesosDue}
              disabled={calculation.mesosDue === undefined}
              label={t('receipt.total')}
              copiedLabel={t('common.copied')}
              copyAriaLabel={t('receipt.copyDue')}
              copiedAriaLabel={t('receipt.dueCopied')}
            />
          </div>

        </Surface>
        <footer className={styles.footer}><HomeLink /></footer>
      </div>
    </main>
  );
}
