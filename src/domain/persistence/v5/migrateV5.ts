import type { LeechInstance } from '../../types';
import { normalizeBuyers } from '../shared/buyers';
import { normalizeRatioBilling } from '../shared/ratioBilling';
import { isRecord, validIsoString } from '../shared/values';
import { migrateLegacyHourlyBilling } from './migrateLegacyHourly';

function migrateInstance(value: unknown, now: number): LeechInstance | undefined {
  if (!isRecord(value)) return undefined;
  const normalizedBuyers = normalizeBuyers(value.buyers, undefined, true);
  const billingRecord = isRecord(value.billing) ? value.billing : {};
  const isHourly = billingRecord.type === 'hourly';
  const billing = isHourly
    ? migrateLegacyHourlyBilling(billingRecord, value.buyers, normalizedBuyers.idMap, now, true)
    : normalizeRatioBilling(billingRecord);
  const inactiveRecord = isRecord(value.inactiveBilling) ? value.inactiveBilling : {};
  const inactiveRatio = isRecord(inactiveRecord.ratio) && inactiveRecord.ratio.type === 'ratio'
    ? normalizeRatioBilling(inactiveRecord.ratio)
    : undefined;
  const inactiveHourly = isRecord(inactiveRecord.hourly) && inactiveRecord.hourly.type === 'hourly'
    ? migrateLegacyHourlyBilling(inactiveRecord.hourly, value.buyers, normalizedBuyers.idMap, now, false)
    : undefined;

  return {
    id: typeof value.id === 'string' ? value.id : '',
    name: typeof value.name === 'string' ? value.name : '',
    billing,
    inactiveBilling: {
      ratio: billing.type === 'ratio' ? billing : inactiveRatio,
      hourly: billing.type === 'hourly' ? billing : inactiveHourly,
    },
    buyers: normalizedBuyers.buyers,
    nextBuyerId: normalizedBuyers.nextBuyerId,
    createdAt: validIsoString(value.createdAt) ?? new Date(now).toISOString(),
    lastCurrentRefreshedAt: validIsoString(value.lastCurrentRefreshedAt),
  };
}

export function migrateV5Instances(value: unknown, now: number): LeechInstance[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (value.length === 0) return [];
  const instances = value.flatMap((instance) => {
    const migrated = migrateInstance(instance, now);
    return migrated ? [migrated] : [];
  });
  return instances.length > 0 ? instances : undefined;
}
