import type { TFunction } from 'i18next';
import { formatPercent } from '../../../domain/format';
import type { CharacterSnapshot } from '../../../domain/types';
import { clampLevel, clampPercent } from '../../../modules/character-progress';
import type { LevelExpValue } from '../../../modules/character-progress';

export type DraftSnapshotState = LevelExpValue;

export function draftDiffersFromSnapshot(draft: DraftSnapshotState, snapshot?: CharacterSnapshot) {
  return !snapshot
    || snapshot.level !== clampLevel(draft.level)
    || snapshot.expPercent !== clampPercent(draft.expPercent);
}

export function formatSnapshotShort(snapshot: CharacterSnapshot | undefined, t: TFunction) {
  return snapshot
    ? t('snapshot.short', { level: snapshot.level, expPercent: formatPercent(snapshot.expPercent) })
    : '—';
}
