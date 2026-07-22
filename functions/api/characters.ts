import {
  fetchLegendsCharacters,
  MAX_BATCH_SIZE,
  normalizeIgns,
  type CharacterBatchResponse,
} from '../../shared/legendsCharacters';

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers ?? {}),
    },
  });
}

export async function createCharactersResponse(rawIgns: unknown) {
  const igns = normalizeIgns(rawIgns);
  if (!igns || igns.length === 0) return jsonResponse({ error: 'Provide at least one IGN.' }, { status: 400 });
  if (igns.length > MAX_BATCH_SIZE) return jsonResponse({ error: `A maximum of ${MAX_BATCH_SIZE} IGNs is allowed.` }, { status: 400 });

  const body: CharacterBatchResponse = { results: await fetchLegendsCharacters(igns) };
  return jsonResponse(body);
}

export async function onRequestPost(context: { request: Request }) {
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  return createCharactersResponse((body as { igns?: unknown } | null)?.igns);
}
