import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { legendsApiPlugin, legendsApiProxy } from './dev/legendsApi';

export default defineConfig({
  plugins: [tailwindcss(), react(), legendsApiPlugin()],
  server: {
    proxy: legendsApiProxy,
  },
});
