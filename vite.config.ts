import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { legendsApiPlugin } from './dev/legendsApi';

export default defineConfig({
  plugins: [react(), legendsApiPlugin()],
});
