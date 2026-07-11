import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCharacters } from './legends';

afterEach(() => vi.unstubAllGlobals());

describe('fetchCharacters', () => {
  it('uses one batch request and separates successes from failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [
        { ign: 'Alice', character: { name: 'Alice', level: 120, exp: '42.5' } },
        { ign: 'Missing', error: { status: 404, message: 'Could not fetch character.' } },
      ],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCharacters(['Alice', 'Missing']);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('/api/characters', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ igns: ['Alice', 'Missing'] }),
    }));
    expect(result.snapshots.get('alice')).toMatchObject({ ign: 'Alice', level: 120, expPercent: 42.5 });
    expect(result.failures).toEqual(['Missing']);
  });

  it('splits more than 50 unique IGNs into sequential requests and merges results', async () => {
    const igns = Array.from({ length: 101 }, (_, index) => `Buyer${index + 1}`);
    const fetchMock = vi.fn().mockImplementation(async (_path: string, init: RequestInit) => {
      const requested = (JSON.parse(String(init.body)) as { igns: string[] }).igns;
      return new Response(JSON.stringify({
        results: requested.map((ign) => ign === 'Buyer51'
          ? { ign, error: { status: 404, message: 'Could not fetch character.' } }
          : { ign, character: { name: ign, level: 120, exp: 10 } }),
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCharacters([...igns, ' buyer1 ']);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).igns).toHaveLength(50);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).igns).toHaveLength(50);
    expect(JSON.parse(String(fetchMock.mock.calls[2][1].body)).igns).toEqual(['Buyer101']);
    expect(result.snapshots).toHaveLength(100);
    expect(result.failures).toEqual(['Buyer51']);
  });

  it('does not call the API for an empty IGN list', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCharacters([' ', ''])).resolves.toMatchObject({ failures: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves completed batches when a later request fails', async () => {
    const igns = Array.from({ length: 51 }, (_, index) => `Buyer${index + 1}`);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: igns.slice(0, 50).map((ign) => ({ ign, character: { name: ign, level: 120, exp: 10 } })),
      }), { status: 200 }))
      .mockRejectedValueOnce(new Error('network failure'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCharacters(igns);

    expect(result.snapshots).toHaveLength(50);
    expect(result.failures).toEqual(['Buyer51']);
  });
});
