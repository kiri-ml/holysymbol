import type { CharacterBatchResponse } from '../../../shared/legendsCharacters';
import { createCharactersResponse, jsonResponse } from '../characters';

type CharacterRouteContext = {
  params: { ign?: string | string[] };
};

/** Compatibility adapter. New callers should use POST /api/characters. */
export async function onRequestGet(context: CharacterRouteContext) {
  const rawIgn = context.params.ign;
  const ign = String(Array.isArray(rawIgn) ? rawIgn[0] ?? '' : rawIgn ?? '').trim();
  if (!ign) return jsonResponse({ error: 'Missing IGN.' }, { status: 400 });

  const batchResponse = await createCharactersResponse([ign]);
  if (!batchResponse.ok) return batchResponse;

  const { results } = await batchResponse.json() as CharacterBatchResponse;
  const result = results[0];
  if (!result || 'error' in result) {
    const status = result?.error.status ?? 502;
    return jsonResponse(
      { error: 'Legends character API failed.', status },
      { status },
    );
  }

  return jsonResponse(result.character);
}
