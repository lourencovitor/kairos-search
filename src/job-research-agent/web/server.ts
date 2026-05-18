import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createJobResearchConfig,
  defaultJobResearchConfig,
} from '../config/job-research.config.js';
import type { RunState } from './app.js';
import { handleApiRequest, runMiddlewares } from './app.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { createRateLimitMiddleware } from './middleware/rate-limit.js';
import type { Middleware } from './middleware/types.js';
import { getMimeType } from './shared/mime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.join(__dirname, 'client');
const distDir = path.join(process.cwd(), 'dist');

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3355);
const apiPort = Number(process.env.API_PORT ?? 3356);
const listenAll = process.env.KAIROS_LISTEN_ALL === 'true';
const bindHost = listenAll || isProd ? '0.0.0.0' : '127.0.0.1';

const browserMcpDisabled = isProd || process.env.DISABLE_BROWSER === 'true';
const config = createJobResearchConfig(
  browserMcpDisabled
    ? { browserMcp: { ...defaultJobResearchConfig.browserMcp, enabled: false } }
    : {},
);

const latestDir = path.join(config.outputRootDir, 'latest');

const state: RunState = { runningPromise: null, lastRunError: null };

const allowedOrigins = (process.env.KAIROS_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const apiMiddlewares: Middleware[] = [
  createCorsMiddleware(allowedOrigins),
  createRateLimitMiddleware(60),
  createAuthMiddleware(process.env.KAIROS_API_TOKEN),
];

if (isProd) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname.startsWith('/api')) {
        await runMiddlewares(apiMiddlewares, req, res, () =>
          handleApiRequest(url, req, res, config, latestDir, state),
        );
        return;
      }
      const filePath = path.join(distDir, url.pathname === '/' ? 'index.html' : url.pathname);
      try {
        const content = await readFile(filePath);
        res.writeHead(200, { 'content-type': getMimeType(filePath) });
        res.end(content);
      } catch {
        const html = await readFile(path.join(distDir, 'index.html'));
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected server error';
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: message }));
    }
  });

  server.listen(port, bindHost, () => {
    console.log(`Kairos running at http://${bindHost}:${port}`);
  });

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const { default: react } = await import('@vitejs/plugin-react');

  const apiServer = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      await runMiddlewares(apiMiddlewares, req, res, () =>
        handleApiRequest(url, req, res, config, latestDir, state),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected server error';
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: message }));
    }
  });

  await new Promise<void>((resolve) => {
    apiServer.listen(apiPort, '127.0.0.1', resolve);
  });

  const viteServer = await createViteServer({
    root: clientDir,
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
      proxy: { '/api': `http://127.0.0.1:${apiPort}` },
    },
  });
  await viteServer.listen();
  console.log(`Job Research API running at http://127.0.0.1:${apiPort}`);
  console.log(`Job Research web UI running at http://127.0.0.1:${port}`);
}
