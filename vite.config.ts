import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const LEGENDS_ORIGIN = 'https://legends.ml';
const MAX_BATCH_SIZE = 50;

function lastPathSegment(path: string) {
  return decodeURIComponent(path.split('/').filter(Boolean).at(-1) ?? '').trim();
}

async function readJson(request: any) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(body)) as unknown;
}

function batchCharactersPlugin() {
  return {
    name: 'batch-characters-api',
    configureServer(server: { middlewares: { use: (path: string, handler: (request: any, response: any) => void) => void } }) {
      server.middlewares.use('/api/characters', (request, response) => {
        void (async () => {
          response.setHeader('content-type', 'application/json; charset=utf-8');
          response.setHeader('cache-control', 'no-store');
          if (request.method !== 'POST') {
            response.statusCode = 405;
            response.end(JSON.stringify({ error: 'Method not allowed.' }));
            return;
          }
          try {
            const body = await readJson(request) as { igns?: unknown };
            if (!Array.isArray(body?.igns) || body.igns.some((ign) => typeof ign !== 'string')) throw new Error('invalid');
            const unique = new Map<string, string>();
            for (const rawIgn of body.igns as string[]) {
              const ign = rawIgn.trim();
              if (ign && !unique.has(ign.toLocaleLowerCase())) unique.set(ign.toLocaleLowerCase(), ign);
            }
            const igns = [...unique.values()];
            if (igns.length === 0 || igns.length > MAX_BATCH_SIZE) throw new Error('invalid');
            const results = await Promise.all(igns.map(async (ign) => {
              try {
                const upstream = await fetch(`${LEGENDS_ORIGIN}/api/character?name=${encodeURIComponent(ign)}`, { headers: { accept: 'application/json' } });
                return upstream.ok
                  ? { ign, character: await upstream.json() }
                  : { ign, error: { status: upstream.status, message: 'Could not fetch character.' } };
              } catch {
                return { ign, error: { status: 502, message: 'Could not fetch character.' } };
              }
            }));
            response.end(JSON.stringify({ results }));
          } catch {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: `Provide between 1 and ${MAX_BATCH_SIZE} IGNs.` }));
          }
        })();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), batchCharactersPlugin()],
  server: {
    proxy: {
      '/api/character': {
        target: 'https://legends.ml',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => `/api/character?name=${encodeURIComponent(lastPathSegment(path))}`,
      },
      '/api/levels': {
        target: 'https://legends.ml',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => `/levels?name=${encodeURIComponent(lastPathSegment(path))}`,
      },
    },
  },
});
