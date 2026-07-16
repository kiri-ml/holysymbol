import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { legendsApiPlugin, legendsApiProxy } from './dev/legendsApi';

export default defineConfig({
  plugins: [react(), legendsApiPlugin()],
  server: {
    proxy: legendsApiProxy,
  },
});
