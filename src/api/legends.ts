import { normalizeCharacter } from '../domain/character';
import type { CharacterApiPayload } from '../domain/types';

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

export function avatarUrl(ign: string, animated = true) {
  const params = new URLSearchParams({ name: ign.trim() });
  if (animated) params.set('animated', '1');
  return `https://legends.ml/api/getavatar?${params.toString()}`;
}
