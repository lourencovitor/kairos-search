import type { IncomingMessage, ServerResponse } from 'node:http';

import type { JobResearchConfig } from '../config/job-research.config.js';
import type { Middleware } from './middleware/types.js';
import { downloadAllRoute } from './routes/download-all.route.js';
import { downloadRoute } from './routes/download.route.js';
import { latestRoute } from './routes/latest.route.js';
import type { RunState } from './routes/run.route.js';
import { runRoute } from './routes/run.route.js';
import { statusRoute } from './routes/status.route.js';
import { uploadLatestRoute } from './routes/upload-latest.route.js';
import { sendJson } from './shared/send-json.js';

export type { RunState };

export async function runMiddlewares(
  middlewares: Middleware[],
  req: IncomingMessage,
  res: ServerResponse,
  handler: () => Promise<void>,
): Promise<void> {
  let i = 0;
  const next = async (): Promise<void> => {
    if (i < middlewares.length) {
      await middlewares[i++]!(req, res, next);
    } else {
      await handler();
    }
  };
  await next();
}

export async function handleApiRequest(
  requestUrl: URL,
  request: IncomingMessage,
  response: ServerResponse,
  config: JobResearchConfig,
  latestDir: string,
  state: RunState,
  uploadKey?: string,
): Promise<void> {
  if (requestUrl.pathname.startsWith('/api/upload-latest/') && request.method === 'POST') {
    await uploadLatestRoute(request, response, requestUrl.pathname, latestDir, uploadKey);
    return;
  }
  if (requestUrl.pathname === '/api/status') {
    await statusRoute(response, state.runningPromise !== null, state.lastRunError);
    return;
  }
  if (requestUrl.pathname === '/api/latest') {
    await latestRoute(response, latestDir, config.maxJobAgeDays);
    return;
  }
  if (requestUrl.pathname === '/api/run' && request.method === 'POST') {
    await runRoute(response, config, state);
    return;
  }
  if (requestUrl.pathname.startsWith('/api/download/')) {
    await downloadRoute(response, requestUrl.pathname, latestDir);
    return;
  }
  if (requestUrl.pathname === '/api/download-all') {
    await downloadAllRoute(response, latestDir);
    return;
  }
  await sendJson(response, { error: 'Not found' }, 404);
}
