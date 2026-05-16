import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(__dirname, 'src/job-research-agent/web/client');

export default defineConfig({
  root: clientDir,
  plugins: [react()],
  build: {
    outDir: resolve(clientDir, 'dist'),
    emptyOutDir: true,
  },
});
