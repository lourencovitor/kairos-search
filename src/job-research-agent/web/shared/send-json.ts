import type { ServerResponse } from 'node:http';

export async function sendJson(
  response: ServerResponse,
  payload: unknown,
  status = 200,
): Promise<void> {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}
