import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJobResearchConfig } from '../config/job-research.config.js';
import { createDefaultJobResearchAgent } from '../index.js';
import type { JobOpportunity, JobResearchRunResult } from '../domain/job.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.join(__dirname, 'client');
const distDir   = path.join(process.cwd(), 'dist');

const isProd   = process.env.NODE_ENV === 'production';
const port     = Number(process.env.PORT     ?? 3355);
const apiPort  = Number(process.env.API_PORT ?? 3356);

const config = createJobResearchConfig();
if (isProd || process.env.DISABLE_BROWSER === 'true') {
  config.browserMcp = { ...config.browserMcp, enabled: false };
}
const latestDir = path.join(config.outputRootDir, 'latest');

let runningPromise: Promise<JobResearchRunResult> | null = null;
let lastRunError: string | null = null;

const downloadableFiles = [
  'report.csv',
  'report-junior.csv',
  'report-pleno.csv',
  'report-senior.csv',
  'report-staff.csv',
  'report-arq.csv',
  'report-qa.csv',
  'report-devops.csv',
  'report-management.csv',
  'report.md',
  'summary.json',
  'filter-funnel.json',
] as const;

async function handleApiRequest(requestUrl: URL, request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (requestUrl.pathname === '/api/status') {
    await sendJson(response, { running: runningPromise !== null, lastRunError });
    return;
  }
  if (requestUrl.pathname === '/api/latest') {
    await sendJson(response, await readLatestPayload());
    return;
  }
  if (requestUrl.pathname === '/api/run' && request.method === 'POST') {
    await handleRun(response);
    return;
  }
  if (requestUrl.pathname.startsWith('/api/download/')) {
    await handleSingleDownload(requestUrl.pathname, response);
    return;
  }
  if (requestUrl.pathname === '/api/download-all') {
    await handleDownloadAll(response);
    return;
  }
  await sendJson(response, { error: 'Not found' }, 404);
}

if (isProd) {
  // ── Production: single server — API + static files ────────────────────────
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', `http://localhost`);

      if (requestUrl.pathname.startsWith('/api')) {
        await handleApiRequest(requestUrl, request, response);
        return;
      }

      // Serve static file or fall back to index.html (SPA)
      const filePath = path.join(distDir, requestUrl.pathname === '/' ? 'index.html' : requestUrl.pathname);
      try {
        const content = await readFile(filePath);
        response.writeHead(200, { 'content-type': getMimeType(filePath) });
        response.end(content);
      } catch {
        const html = await readFile(path.join(distDir, 'index.html'));
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(html);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected server error';
      await sendJson(response, { error: message }, 500);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Kairos running at http://0.0.0.0:${port}`);
  });
} else {
  // ── Dev: separate API server + Vite dev server ────────────────────────────
  const { createServer: createViteServer } = await import('vite');
  const { default: react } = await import('@vitejs/plugin-react');

  const apiServer = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', `http://localhost`);
      await handleApiRequest(requestUrl, request, response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected server error';
      await sendJson(response, { error: message }, 500);
    }
  });

  await new Promise<void>((resolve) => { apiServer.listen(apiPort, '127.0.0.1', resolve); });

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

async function handleRun(response: ServerResponse): Promise<void> {
  if (runningPromise) {
    await sendJson(response, { running: true, message: 'A job research run is already in progress.' }, 409);
    return;
  }

  lastRunError = null;
  runningPromise = createDefaultJobResearchAgent(config)
    .run()
    .catch((error: unknown) => {
      lastRunError = error instanceof Error ? error.message : 'Unknown job research error';
      throw error;
    })
    .finally(() => {
      runningPromise = null;
    });

  // Respond immediately so the connection doesn't timeout on slow hosts.
  // The client should poll /api/status to know when it finishes.
  await sendJson(response, { running: true, message: 'Job research started.' }, 202);
}

async function readLatestPayload(): Promise<{
  summary: { generatedAt?: string } | null;
  jobs: JobOpportunity[];
  downloads: Array<{ name: string; label: string; size: number }>;
  funnel: unknown | null;
}> {
  const [summary, selectedJobs, rankedJobs, funnel] = await Promise.all([
    readJsonOrNull<{ generatedAt?: string }>(path.join(latestDir, 'summary.json')),
    readJsonOrNull<JobOpportunity[]>(path.join(latestDir, 'selected-jobs.json')),
    readJsonOrNull<JobOpportunity[]>(path.join(latestDir, 'ranked-jobs.json')),
    readJsonOrNull(path.join(latestDir, 'filter-funnel.json')),
  ]);
  const downloads = await listDownloads(summary?.generatedAt);

  return {
    summary,
    // Per-group CSVs are built from ranked jobs, not only from the final
    // selected report slice. Use ranked jobs so the UI counts match downloads.
    jobs: rankedJobs ?? selectedJobs ?? [],
    downloads,
    funnel,
  };
}

async function handleSingleDownload(pathname: string, response: ServerResponse): Promise<void> {
  const filename = decodeURIComponent(pathname.replace('/api/download/', ''));
  if (!isDownloadableFile(filename)) {
    await sendJson(response, { error: 'Unknown download file.' }, 404);
    return;
  }

  const filePath = path.join(latestDir, filename);
  const content = await readFile(filePath);
  response.writeHead(200, {
    'content-type': getMimeType(filename),
    'content-disposition': `attachment; filename="${filename}"`,
  });
  response.end(content);
}

async function handleDownloadAll(response: ServerResponse): Promise<void> {
  const files: Array<{ name: string; content: Buffer }> = [];

  for (const filename of downloadableFiles) {
    const filePath = path.join(latestDir, filename);
    try {
      files.push({ name: filename, content: await readFile(filePath) });
    } catch {
      // Missing per-group CSVs are expected when a group has no selected jobs.
    }
  }

  if (files.length === 0) {
    await sendJson(response, { error: 'No downloadable reports were found.' }, 404);
    return;
  }

  const zip = createZip(files);
  response.writeHead(200, {
    'content-type': 'application/zip',
    'content-disposition': 'attachment; filename="job-research-reports.zip"',
  });
  response.end(zip);
}

async function listDownloads(generatedAt?: string): Promise<Array<{ name: string; label: string; size: number }>> {
  const entries = await readdir(latestDir).catch(() => []);
  const entrySet = new Set(entries);
  const downloads: Array<{ name: string; label: string; size: number }> = [];
  const generatedAtMs = generatedAt ? Date.parse(generatedAt) : Number.NaN;

  for (const filename of downloadableFiles) {
    if (!entrySet.has(filename)) {
      continue;
    }
    const fileStat = await stat(path.join(latestDir, filename));
    if (
      filename.startsWith('report-') &&
      Number.isFinite(generatedAtMs) &&
      fileStat.mtimeMs + 1_000 < generatedAtMs
    ) {
      continue;
    }
    downloads.push({ name: filename, label: labelDownload(filename), size: fileStat.size });
  }

  return downloads;
}

async function sendJson(response: ServerResponse, payload: unknown, status = 200): Promise<void> {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function readJsonOrNull<T = unknown>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function isDownloadableFile(filename: string): filename is (typeof downloadableFiles)[number] {
  return downloadableFiles.includes(filename as (typeof downloadableFiles)[number]);
}

function labelDownload(filename: string): string {
  return filename
    .replace('report-', '')
    .replace('.csv', '')
    .replace('.md', '')
    .replace('.json', '')
    .replace('report', 'all jobs')
    .replace('summary', 'summary')
    .replace('filter-funnel', 'filter funnel');
}

function getMimeType(filePath: string): string {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.csv')) return 'text/csv; charset=utf-8';
  if (filePath.endsWith('.md')) return 'text/markdown; charset=utf-8';
  return 'application/octet-stream';
}

function createZip(files: Array<{ name: string; content: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name);
    const crc = crc32(file.content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(file.content.length, 18);
    localHeader.writeUInt32LE(file.content.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, file.content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(file.content.length, 20);
    centralHeader.writeUInt32LE(file.content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + file.content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(content: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of content) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
