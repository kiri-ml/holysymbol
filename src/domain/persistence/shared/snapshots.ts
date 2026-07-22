import type { CharacterSnapshot } from '../../types';
import { epochToIso, isRecord, relativeSecondsToIso, validIsoString } from './values';

export type SnapshotMetadata = Pick<CharacterSnapshot, 'ign' | 'job' | 'guild'>;

export function normalizeSnapshot(
  value: unknown,
  metadata: SnapshotMetadata,
  baseEpochSeconds?: number,
): CharacterSnapshot | undefined {
  const tuple = Array.isArray(value) ? value : undefined;
  const record = isRecord(value) ? value : {};
  const level = tuple ? tuple[0] : typeof record.l === 'number' ? record.l : record.level;
  const expPercent = tuple ? tuple[1] : typeof record.e === 'number' ? record.e : record.expPercent;
  const capturedAt = tuple
    ? baseEpochSeconds === undefined ? epochToIso(tuple[2]) : relativeSecondsToIso(tuple[2], baseEpochSeconds)
    : epochToIso(record.t) ?? validIsoString(record.capturedAt);
  const source = tuple
    ? tuple[3] === 0 ? 'api' : tuple[3] === 1 ? 'manual' : undefined
    : record.s === 'a' || record.source === 'api'
      ? 'api'
      : record.s === 'm' || record.source === 'manual'
        ? 'manual'
        : undefined;
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 200) return undefined;
  if (typeof expPercent !== 'number' || !Number.isFinite(expPercent)) return undefined;
  if (!capturedAt || !source) return undefined;
  const ign = typeof record.n === 'string' ? record.n : typeof record.ign === 'string' ? record.ign : metadata.ign;
  const job = typeof record.j === 'string' ? record.j : typeof record.job === 'string' ? record.job : metadata.job;
  const guild = typeof record.g === 'string' ? record.g : typeof record.guild === 'string' ? record.guild : metadata.guild;
  return { ign, level, expPercent, job, guild, capturedAt, source };
}
