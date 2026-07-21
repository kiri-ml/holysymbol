import { migrateV5Instances as migrateInstances } from './persistenceInternals';
import type { LeechInstance } from './types';

export function migrateV5Instances(value: unknown, now: number): LeechInstance[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (value.length === 0) return [];
  const migrated = migrateInstances(value, [], now);
  return migrated.length > 0 ? migrated : undefined;
}
