import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(__dirname, 'src/job-research-agent/web/client');

export default defineConfig({
  root: clientDir,
  envDir: __dirname,
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 3355,
    proxy: {
      '/v1': {
        target: process.env.VITE_ATS_API_URL ?? 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
});
