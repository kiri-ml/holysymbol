import type { TFunction } from 'i18next';
import { formatLocalDateTime, formatMesosShort, formatRatio, formatRatioRange } from '../../domain/format';
import type { LeechBilling, LeechInstance, TimerStatus } from '../../domain/types';

export function runNameWithFallback(run: LeechInstance, fallback: string) {
  return run.name.trim() || fallback;
}

export function getRunDisplayName(run: LeechInstance) {
  return runNameWithFallback(run, formatLocalDateTime(run.createdAt));
}

export function formatRunBillingLabel(billing: LeechBilling, t: TFunction) {
  if (billing.type === 'ratio') {
    return [
      formatRatio(billing.expPerMesoRatio),
      ...billing.tiers.map((tier) => `Lv.${tier.minLevel}+ ${formatRatio(tier.expPerMesoRatio)}`),
    ].join(' · ');
  }
  return t('billing.hourlyRateShort', { rate: formatMesosShort(billing.hourlyRateMesos) });
}

export function formatCompactRunBillingLabel(billing: LeechBilling, t: TFunction) {
  if (billing.type !== 'ratio') return formatRunBillingLabel(billing, t);
  const ratios = [billing.expPerMesoRatio, ...billing.tiers.map((tier) => tier.expPerMesoRatio)];
  return formatRatioRange(Math.min(...ratios), Math.max(...ratios), t('common.ratioPrefix'));
}

export function formatTimerStatus(status: TimerStatus, t: TFunction) {
  switch (status) {
    case 'running':
      return t('timer.running');
    case 'paused':
      return t('timer.paused');
    case 'idle':
    default:
      return t('timer.idle');
  }
}
