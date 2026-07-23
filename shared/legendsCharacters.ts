export const LEGENDS_ORIGIN = 'https://legends.ml';
export const MAX_BATCH_SIZE = 50;

export type CharacterApiPayload = {
  name?: string;
  guild?: string | null;
  level?: number | string;
  job?: string;
  exp?: string | number;
  [key: string]: unknown;
};

export type CharacterResult<TCharacter = CharacterApiPayload> =
  | { ign: string; character: TCharacter }
  | { ign: string; error: { status: number; message: string } };

export type CharacterBatchResponse<TCharacter = CharacterApiPayload> = {
  results: CharacterResult<TCharacter>[];
};

export function normalizeIgn(value: unknown) {
  return typeof value === 'string' ? value.trim() : null;
}

export function ignKey(ign: string) {
  return ign.trim().toLowerCase();
}

export function normalizeIgns(value: unknown) {
  if (!Array.isArray(value)) return null;

  const unique = new Map<string, string>();
  for (const rawIgn of value) {
    const ign = normalizeIgn(rawIgn);
    if (ign === null) return null;
    const key = ignKey(ign);
    if (key && !unique.has(key)) unique.set(key, ign);
  }
  return [...unique.values()];
}

export async function fetchLegendsCharacter(ign: string): Promise<CharacterResult> {
  try {
    const response = await fetch(`${LEGENDS_ORIGIN}/api/character?name=${encodeURIComponent(ign)}`, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'user-agent': 'holy-symbol/0.3.0 (+https://holysymbol.pages.dev)',
      },
    });
    return response.ok
      ? { ign, character: await response.json() as CharacterApiPayload }
      : { ign, error: { status: response.status, message: 'Could not fetch character.' } };
  } catch {
    return { ign, error: { status: 502, message: 'Could not fetch character.' } };
  }
}

export function fetchLegendsCharacters(igns: readonly string[]) {
  return Promise.all(igns.map(fetchLegendsCharacter));
}
