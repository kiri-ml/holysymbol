export const LEGENDS_ORIGIN = 'https://legends.ml';
export const MAX_BATCH_SIZE = 50;

export type BatchResult =
  | { ign: string; character: unknown }
  | { ign: string; error: { status: number; message: string } };

export function normalizeIgns(value: unknown) {
  if (!Array.isArray(value)) return null;

  const unique = new Map<string, string>();
  for (const valueIgn of value) {
    if (typeof valueIgn !== 'string') return null;
    const ign = valueIgn.trim();
    if (ign && !unique.has(ign.toLocaleLowerCase())) unique.set(ign.toLocaleLowerCase(), ign);
  }
  return [...unique.values()];
}

export async function fetchCharacter(ign: string): Promise<BatchResult> {
  try {
    const response = await fetch(`${LEGENDS_ORIGIN}/api/character?name=${encodeURIComponent(ign)}`, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'user-agent': 'legends-leech-calculator/0.1 (+https://legends.ml)',
      },
    });
    return response.ok
      ? { ign, character: await response.json() }
      : { ign, error: { status: response.status, message: 'Could not fetch character.' } };
  } catch {
    return { ign, error: { status: 502, message: 'Could not fetch character.' } };
  }
}
