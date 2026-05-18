import type { ServerResponse } from 'node:http';

import type { LatestPayload } from '../services/latest-payload.service.js';
import { readLatestPayload } from '../services/latest-payload.service.js';
import { sendJson } from '../shared/send-json.js';

export async function latestRoute(
  response: ServerResponse,
  latestDir: string,
  maxAgeDays: number,
): Promise<void> {
  const payload: LatestPayload = await readLatestPayload(latestDir, maxAgeDays);
  await sendJson(response, payload);
}
