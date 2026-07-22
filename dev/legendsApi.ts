import type { Connect, Plugin } from 'vite';
import { onRequestGet as getCharacter } from '../functions/api/character/[ign]';
import { createCharactersResponse, jsonResponse } from '../functions/api/characters';

// Vite's bundled Connect request type omits Node stream members that are
// present on the request at runtime.
type DevRequest = Connect.IncomingMessage & {
  method?: string;
  url?: string;
  on(event: 'data', listener: (chunk: Uint8Array | string) => void): DevRequest;
  on(event: 'end', listener: () => void): DevRequest;
  on(event: 'error', listener: (error: Error) => void): DevRequest;
};
type DevResponse = Parameters<Connect.SimpleHandleFunction>[1];

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

async function sendResponse(response: DevResponse, result: Response) {
  response.statusCode = result.status;
  result.headers.forEach((value, name) => response.setHeader(name, value));
  response.end(await result.text());
}

async function handleBatchCharacters(request: DevRequest, response: DevResponse) {
  if (request.method !== 'POST') {
    await sendResponse(response, jsonResponse({ error: 'Method not allowed.' }, { status: 405 }));
    return;
  }

  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    await sendResponse(response, jsonResponse({ error: 'Invalid JSON body.' }, { status: 400 }));
    return;
  }

  await sendResponse(
    response,
    await createCharactersResponse((body as { igns?: unknown } | null)?.igns),
  );
}

function getRouteIgn(request: DevRequest) {
  const path = request.url?.split('?')[0] ?? '';
  const encodedIgn = path.split('/').filter(Boolean).at(-1) ?? '';
  try {
    return decodeURIComponent(encodedIgn);
  } catch {
    return '';
  }
}

async function handleSingleCharacter(request: DevRequest, response: DevResponse) {
  if (request.method !== 'GET') {
    await sendResponse(response, jsonResponse({ error: 'Method not allowed.' }, { status: 405 }));
    return;
  }

  await sendResponse(response, await getCharacter({ params: { ign: getRouteIgn(request) } }));
}

export function legendsApiPlugin(): Plugin {
  return {
    name: 'legends-characters-api',
    configureServer(server) {
      server.middlewares.use('/api/characters', (request, response) => {
        void handleBatchCharacters(request as unknown as DevRequest, response);
      });
      server.middlewares.use('/api/character', (request, response) => {
        void handleSingleCharacter(request as unknown as DevRequest, response);
      });
    },
  };
}
