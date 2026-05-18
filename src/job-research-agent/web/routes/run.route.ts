import type { ServerResponse } from 'node:http';

import type { JobResearchConfig } from '../../config/job-research.config.js';
import type { JobResearchRunResult } from '../../domain/job.types.js';
import { createDefaultJobResearchAgent } from '../../index.js';
import { sendJson } from '../shared/send-json.js';

export interface RunState {
  runningPromise: Promise<JobResearchRunResult> | null;
  lastRunError: string | null;
}

export async function runRoute(
  response: ServerResponse,
  config: JobResearchConfig,
  state: RunState,
): Promise<void> {
  if (state.runningPromise) {
    await sendJson(
      response,
      { running: true, message: 'A job research run is already in progress.' },
      409,
    );
    return;
  }

  state.lastRunError = null;
  state.runningPromise = createDefaultJobResearchAgent(config)
    .run()
    .catch((error: unknown) => {
      state.lastRunError = error instanceof Error ? error.message : 'Unknown job research error';
      throw error;
    })
    .finally(() => {
      state.runningPromise = null;
    });

  await sendJson(response, { running: true, message: 'Job research started.' }, 202);
}
