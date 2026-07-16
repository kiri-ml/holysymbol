import type { Connect, Plugin, ServerOptions } from 'vite';
import { fetchCharacter, LEGENDS_ORIGIN, MAX_BATCH_SIZE, normalizeIgns } from '../shared/legendsCharacters';

type DevRequest = Connect.IncomingMessage & {
  method?: string;
  on(event: 'data', listener: (chunk: Uint8Array | string) => void): DevRequest;
  on(event: 'end', listener: () => void): DevRequest;
  on(event: 'error', listener: (error: Error) => void): DevRequest;
};
type DevResponse = Parameters<Connect.SimpleHandleFunction>[1];

function lastPathSegment(path: string) {
  return decodeURIComponent(path.split('/').filter(Boolean).at(-1) ?? '').trim();
}

async function readJson(request: DevRequest) {
  const chunks = await new Promise<Uint8Array[]>((resolve, reject) => {
    const received: Uint8Array[] = [];
    request.on('data', (chunk) => {
      received.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
    });
    request.on('end', () => resolve(received));
    request.on('error', reject);
  });

  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(body)) as unknown;
}

function sendJson(response: DevResponse, body: unknown, status = 200) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}

async function handleBatchCharacters(request: DevRequest, response: DevResponse) {
  if (request.method !== 'POST') {
    sendJson(response, { error: 'Method not allowed.' }, 405);
    return;
  }

  try {
    const body = await readJson(request) as { igns?: unknown } | null;
    const igns = normalizeIgns(body?.igns);
    if (!igns || igns.length === 0 || igns.length > MAX_BATCH_SIZE) throw new Error('invalid');

    sendJson(response, { results: await Promise.all(igns.map(fetchCharacter)) });
  } catch {
    sendJson(response, { error: `Provide between 1 and ${MAX_BATCH_SIZE} IGNs.` }, 400);
  }
}

export function legendsApiPlugin(): Plugin {
  return {
    name: 'batch-characters-api',
    configureServer(server) {
      server.middlewares.use('/api/characters', (request, response) => {
        // Vite's bundled Connect request type omits Node's stream members, which
        // are present on the request at runtime.
        void handleBatchCharacters(request as unknown as DevRequest, response);
      });
    },
  };
}

export const legendsApiProxy = {
  '/api/character': {
    target: LEGENDS_ORIGIN,
    changeOrigin: true,
    secure: true,
    rewrite: (path) => `/api/character?name=${encodeURIComponent(lastPathSegment(path))}`,
  },
  '/api/levels': {
    target: LEGENDS_ORIGIN,
    changeOrigin: true,
    secure: true,
    rewrite: (path) => `/levels?name=${encodeURIComponent(lastPathSegment(path))}`,
  },
} satisfies NonNullable<ServerOptions['proxy']>;
