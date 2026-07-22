import {
  ignKey,
  MAX_BATCH_SIZE,
  normalizeIgn,
  normalizeIgns,
  type CharacterApiPayload,
  type CharacterBatchResponse,
} from '../../shared/legendsCharacters';
import { normalizeCharacter } from '../domain/character';
import type { CharacterSnapshot } from '../domain/types';

export type CharacterBatch = {
  snapshots: Map<string, CharacterSnapshot>;
  failures: string[];
};

export async function fetchCharacter(ign: string) {
  const cleanIgn = normalizeIgn(ign);
  if (!cleanIgn) throw new Error('Enter an IGN first.');

  const result = await fetchCharacters([cleanIgn]);
  const snapshot = result.snapshots.get(ignKey(cleanIgn));
  if (!snapshot) throw new Error('Could not fetch character.');
  return snapshot;
}

export async function fetchCharacters(igns: string[]): Promise<CharacterBatch> {
  const snapshots = new Map<string, CharacterSnapshot>();
  const failures: string[] = [];
  const cleanIgns = normalizeIgns(igns) ?? [];

  for (let offset = 0; offset < cleanIgns.length; offset += MAX_BATCH_SIZE) {
    const batchIgns = cleanIgns.slice(offset, offset + MAX_BATCH_SIZE);
    let results: CharacterBatchResponse<CharacterApiPayload>['results'];
    try {
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ igns: batchIgns }),
      });
      if (!response.ok) throw new Error(`Could not refresh characters (${response.status})`);
      const payload = await response.json() as CharacterBatchResponse<CharacterApiPayload>;
      results = payload.results;
    } catch {
      failures.push(...batchIgns);
      continue;
    }
    for (const result of results) {
      if ('error' in result) {
        failures.push(result.ign);
        continue;
      }
      try {
        snapshots.set(ignKey(result.ign), normalizeCharacter(result.character, result.ign));
      } catch {
        failures.push(result.ign);
      }
    }
  }
  return { snapshots, failures };
}

export function avatarUrl(ign: string, animated = true) {
  const params = new URLSearchParams({ name: ign.trim() });
  if (animated) params.set('animated', '1');
  return `https://legends.ml/api/getavatar?${params.toString()}`;
}
