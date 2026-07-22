import type { TFunction } from 'i18next';
import { buyerLookupIgn } from '../../domain/buyers';
import { calculateBuyer, getBuyerBillableMs } from '../../domain/calculator';
import type { LeechInstance } from '../../domain/types';
import { formatRunBillingLabel, runNameWithFallback } from './runPresentation';

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function buildRunsCsv(runs: LeechInstance[], t: TFunction, now: number) {
  const columns = [
    t('csv.instance'),
    t('csv.createdAt'),
    t('csv.billing'),
    t('csv.buyer'),
    t('csv.startLevel'),
    t('csv.startExpPercent'),
    t('csv.startTime'),
    t('csv.currentLevel'),
    t('csv.currentExpPercent'),
    t('csv.currentTime'),
    t('csv.expGained'),
    t('csv.mesosDue'),
    t('csv.billableMs'),
  ];

  const rows = runs.flatMap((run) => run.buyers.map((buyer) => {
    const calculation = calculateBuyer(buyer, run.billing, now);
    const due = run.billing.type === 'ratio' ? calculation.ratioMesosDue : calculation.hourlyMesosDue;
    return [
      runNameWithFallback(run, t('common.untitled')),
      run.createdAt,
      formatRunBillingLabel(run.billing, t),
      buyerLookupIgn(buyer),
      buyer.start?.level,
      buyer.start?.expPercent,
      buyer.start?.capturedAt,
      buyer.current?.level,
      buyer.current?.expPercent,
      buyer.current?.capturedAt,
      calculation.expGained,
      due,
      run.billing.type === 'hourly' ? getBuyerBillableMs(run.billing, buyer.id, now) : undefined,
    ].map(csvEscape).join(',');
  }));

  return ['\uFEFF', [columns.join(','), ...rows].join('\n')].join('');
}

export function runsCsvFilename() {
  return `holy-symbol-${new Date(Date.now()).toISOString().slice(0, 10)}.csv`;
}

export function downloadRunsCsv(runs: LeechInstance[], t: TFunction, now: number) {
  const blob = new Blob([buildRunsCsv(runs, t, now)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = runsCsvFilename();
  anchor.click();
  URL.revokeObjectURL(url);
}
