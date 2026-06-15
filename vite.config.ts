import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function lastPathSegment(path: string) {
  return decodeURIComponent(path.split('/').filter(Boolean).at(-1) ?? '').trim();
}

export default defineConfig({
  plugins: [react()],
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
