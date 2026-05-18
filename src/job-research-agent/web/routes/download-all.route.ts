import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import path from 'node:path';

import { createZip } from '../services/zip.service.js';
import { downloadableFiles } from '../shared/downloadable-files.js';
import { sendJson } from '../shared/send-json.js';

export async function downloadAllRoute(response: ServerResponse, latestDir: string): Promise<void> {
  const files: Array<{ name: string; content: Buffer }> = [];

  for (const filename of downloadableFiles) {
    try {
      files.push({ name: filename, content: await readFile(path.join(latestDir, filename)) });
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
