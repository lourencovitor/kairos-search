import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import path from 'node:path';

import { isDownloadableFile } from '../shared/downloadable-files.js';
import { getMimeType } from '../shared/mime.js';
import { sendJson } from '../shared/send-json.js';

export async function downloadRoute(
  response: ServerResponse,
  pathname: string,
  latestDir: string,
): Promise<void> {
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
