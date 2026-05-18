import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { rename, unlink } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

import { sendJson } from '../shared/send-json.js';

const ALLOWED_FILES = new Set([
  'summary.json',
  'selected-jobs.json',
  'ranked-jobs.json',
  'filter-funnel.json',
  'report.csv',
  'report.md',
  'report-junior.csv',
  'report-pleno.csv',
  'report-mid-level.csv',
  'report-senior.csv',
  'report-senior-plus.csv',
  'report-staff.csv',
  'report-arq.csv',
  'report-architect.csv',
  'report-qa.csv',
  'report-devops.csv',
  'report-management.csv',
  'report-tech-lead.csv',
]);

export async function uploadLatestRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  latestDir: string,
  uploadKey: string | undefined,
): Promise<void> {
  if (!uploadKey) {
    await sendJson(response, { error: 'Upload not configured.' }, 503);
    return;
  }

  const auth = request.headers.authorization ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (bearer !== uploadKey) {
    await sendJson(response, { error: 'Unauthorized.' }, 401);
    return;
  }

  const filename = decodeURIComponent(pathname.replace('/api/upload-latest/', ''));
  if (!ALLOWED_FILES.has(filename)) {
    await sendJson(response, { error: `File not allowed: ${filename}` }, 400);
    return;
  }

  if (!existsSync(latestDir)) mkdirSync(latestDir, { recursive: true });

  const dest = path.join(latestDir, filename);
  const tmp = dest + '.tmp';

  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(tmp);
    request.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error', reject);
    request.on('error', reject);
  }).catch(async (err) => {
    await unlink(tmp).catch(() => undefined);
    throw err;
  });

  await rename(tmp, dest);
  await sendJson(response, { ok: true, file: filename });
}
