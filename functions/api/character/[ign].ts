const LEGENDS_ORIGIN = 'https://legends.ml';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers ?? {}),
    },
  });
}

export async function onRequestGet(context: any) {
  const ign = String(context.params.ign ?? '').trim();
  if (!ign) return jsonResponse({ error: 'Missing IGN.' }, { status: 400 });

  const upstream = `${LEGENDS_ORIGIN}/api/character?name=${encodeURIComponent(ign)}`;
  const init: RequestInit = {
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      'user-agent': 'legends-leech-calculator/0.1 (+https://legends.ml)',
    },
  };
  const response = await fetch(upstream, init);

  const text = await response.text();
  if (!response.ok) {
    return jsonResponse(
      { error: 'Legends character API failed.', status: response.status, details: text.slice(0, 400) },
      { status: response.status },
    );
  }

  return new Response(text, {
    status: 200,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
