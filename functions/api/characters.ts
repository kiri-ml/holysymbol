const LEGENDS_ORIGIN = 'https://legends.ml';
const MAX_BATCH_SIZE = 50;

type BatchResult =
  | { ign: string; character: unknown }
  | { ign: string; error: { status: number; message: string } };

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      ...(init.headers ?? {}),
    },
  });
}

function normalizeIgns(value: unknown) {
  if (!Array.isArray(value)) return null;
  const unique = new Map<string, string>();
  for (const valueIgn of value) {
    if (typeof valueIgn !== 'string') return null;
    const ign = valueIgn.trim();
    if (ign && !unique.has(ign.toLocaleLowerCase())) unique.set(ign.toLocaleLowerCase(), ign);
  }
  return [...unique.values()];
}

async function fetchCharacter(ign: string): Promise<BatchResult> {
  try {
    const response = await fetch(`${LEGENDS_ORIGIN}/api/character?name=${encodeURIComponent(ign)}`, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'user-agent': 'legends-leech-calculator/0.1 (+https://legends.ml)',
      },
    });
    if (!response.ok) {
      return { ign, error: { status: response.status, message: 'Could not fetch character.' } };
    }
    return { ign, character: await response.json() };
  } catch {
    return { ign, error: { status: 502, message: 'Could not fetch character.' } };
  }
}

export async function onRequestPost(context: any) {
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const igns = normalizeIgns((body as { igns?: unknown } | null)?.igns);
  if (!igns || igns.length === 0) return jsonResponse({ error: 'Provide at least one IGN.' }, { status: 400 });
  if (igns.length > MAX_BATCH_SIZE) return jsonResponse({ error: `A maximum of ${MAX_BATCH_SIZE} IGNs is allowed.` }, { status: 400 });

  return jsonResponse({ results: await Promise.all(igns.map(fetchCharacter)) });
}
