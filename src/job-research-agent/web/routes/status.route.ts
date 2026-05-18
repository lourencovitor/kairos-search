import type { ServerResponse } from 'node:http';

import { sendJson } from '../shared/send-json.js';

export async function statusRoute(
  response: ServerResponse,
  running: boolean,
  lastRunError: string | null,
): Promise<void> {
  await sendJson(response, { running, lastRunError });
}
