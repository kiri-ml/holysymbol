import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { legendsApiPlugin } from './dev/legendsApi';

function receiptHtmlPlugin() {
  const rewriteReceiptUrl = (request: { url?: string }) => {
    if (!request.url) return;
    const queryIndex = request.url.indexOf('?');
    const pathname = queryIndex >= 0 ? request.url.slice(0, queryIndex) : request.url;
    if (!pathname.startsWith('/r1/')) return;
    request.url = `/receipt.html${queryIndex >= 0 ? request.url.slice(queryIndex) : ''}`;
  };

  return {
    name: 'receipt-html-route',
    configureServer(server: { middlewares: { use(handler: (request: { url?: string }, response: unknown, next: () => void) => void): void } }) {
      server.middlewares.use((request, _response, next) => {
        rewriteReceiptUrl(request);
        next();
      });
    },
    configurePreviewServer(server: { middlewares: { use(handler: (request: { url?: string }, response: unknown, next: () => void) => void): void } }) {
      server.middlewares.use((request, _response, next) => {
        rewriteReceiptUrl(request);
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [receiptHtmlPlugin(), react(), legendsApiPlugin()],
  build: {
    assetsDir: 'build',
    rollupOptions: {
      input: {
        main: 'index.html',
        receipt: 'receipt.html',
      },
    },
  },
});
