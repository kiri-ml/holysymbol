import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet } from './character/[ign]';
import { onRequestPost } from './characters';

afterEach(() => vi.unstubAllGlobals());

function context(body: unknown) {
  return { request: new Request('https://example.test/api/characters', { method: 'POST', body: JSON.stringify(body) }) };
}

describe('POST /api/characters', () => {
  it('deduplicates IGNs and returns partial failures in input order', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: 'Alice', level: 120, exp: 10 }), { status: 200 }))
      .mockResolvedValueOnce(new Response('missing', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await onRequestPost(context({ igns: [' Alice ', 'alice', 'Missing'] }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await response.json()).toEqual({ results: [
      { ign: 'Alice', character: { name: 'Alice', level: 120, exp: 10 } },
      { ign: 'Missing', error: { status: 404, message: 'Could not fetch character.' } },
    ] });
  });

  it('rejects empty and oversized batches', async () => {
    expect((await onRequestPost(context({ igns: [] }))).status).toBe(400);
    expect((await onRequestPost(context({ igns: Array.from({ length: 51 }, (_, index) => `Buyer${index}`) }))).status).toBe(400);
  });

  it('does not opt into cross-origin access', async () => {
    const response = await onRequestPost(context({ igns: [] }));
    expect(response.headers.has('access-control-allow-origin')).toBe(false);
  });
});

describe('GET /api/character/:ign compatibility adapter', () => {
  it('returns the single character from the shared batch implementation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ name: 'Alice', level: 120, exp: 10 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await onRequestGet({ params: { ign: ' Alice ' } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: 'Alice', level: 120, exp: 10 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('preserves upstream failure status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('missing', { status: 404 })));

    const response = await onRequestGet({ params: { ign: 'Missing' } });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Legends character API failed.', status: 404 });
  });
});
