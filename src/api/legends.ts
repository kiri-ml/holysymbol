import { normalizeCharacter } from '../domain/character';
import type { CharacterApiPayload, CharacterSnapshot } from '../domain/types';

type BatchCharacterResult =
  | { ign: string; character: CharacterApiPayload }
  | { ign: string; error: { status: number; message: string } };

export type CharacterBatch = {
  snapshots: Map<string, CharacterSnapshot>;
  failures: string[];
};

const CHARACTER_BATCH_SIZE = 50;

async function fetchJson<T>(path: string, errorMessage: string): Promise<T> {
  const response = await fetch(path, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`${errorMessage} (${response.status})`);
  return response.json() as Promise<T>;
}

export async function fetchCharacter(ign: string) {
  const cleanIgn = ign.trim();
  if (!cleanIgn) throw new Error('Enter an IGN first.');
  const payload = await fetchJson<CharacterApiPayload>(`/api/character/${encodeURIComponent(cleanIgn)}`, 'Could not fetch character');
  return normalizeCharacter(payload, cleanIgn);
}

export async function fetchCharacters(igns: string[]): Promise<CharacterBatch> {
  const snapshots = new Map<string, CharacterSnapshot>();
  const failures: string[] = [];
  const uniqueIgns = new Map<string, string>();
  for (const rawIgn of igns) {
    const ign = rawIgn.trim();
    if (ign && !uniqueIgns.has(ign.toLocaleLowerCase())) uniqueIgns.set(ign.toLocaleLowerCase(), ign);
  }
  const cleanIgns = [...uniqueIgns.values()];

  for (let offset = 0; offset < cleanIgns.length; offset += CHARACTER_BATCH_SIZE) {
    const batchIgns = cleanIgns.slice(offset, offset + CHARACTER_BATCH_SIZE);
    let results: BatchCharacterResult[];
    try {
      const response = await fetch('/api/characters', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ igns: batchIgns }),
      });
      if (!response.ok) throw new Error(`Could not refresh characters (${response.status})`);
      const payload = await response.json() as { results: BatchCharacterResult[] };
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
        snapshots.set(result.ign.toLocaleLowerCase(), normalizeCharacter(result.character, result.ign));
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
