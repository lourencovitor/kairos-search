import { describe, expect, it } from 'vitest';

import type { IncomingMessage, ServerResponse } from 'node:http';

import { createRateLimitMiddleware } from './rate-limit.js';

function makeReq(ip = '1.2.3.4'): IncomingMessage {
  return { headers: {}, socket: { remoteAddress: ip } } as unknown as IncomingMessage;
}

function makeRes() {
  const res = {
    statusCode: 200,
    writtenHeaders: {} as Record<string, string>,
    body: '',
    writeHead(status: number, headers?: Record<string, string>) {
      res.statusCode = status;
      if (headers) Object.assign(res.writtenHeaders, headers);
    },
    end(data = '') {
      res.body = String(data);
    },
    setHeader(k: string, v: string) {
      res.writtenHeaders[k] = v;
    },
  };
  return res as unknown as ServerResponse & typeof res;
}

async function hitMiddleware(
  mw: ReturnType<typeof createRateLimitMiddleware>,
  ip: string,
  times: number,
): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < times; i++) {
    const res = makeRes();
    await mw(makeReq(ip), res, async () => {});
    statuses.push(res.statusCode);
  }
  return statuses;
}

describe('createRateLimitMiddleware', () => {
  it('allows requests under the limit', async () => {
    const mw = createRateLimitMiddleware(5);
    const statuses = await hitMiddleware(mw, '1.1.1.1', 5);
    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  it('returns 429 on the request that exceeds the limit', async () => {
    const mw = createRateLimitMiddleware(5);
    const statuses = await hitMiddleware(mw, '2.2.2.2', 6);
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it('counts per IP independently', async () => {
    const mw = createRateLimitMiddleware(2);
    await hitMiddleware(mw, '3.3.3.3', 3);
    const res = makeRes();
    await mw(makeReq('4.4.4.4'), res, async () => {});
    expect(res.statusCode).toBe(200);
  });

  it('429 response includes retry-after header', async () => {
    const mw = createRateLimitMiddleware(1);
    const statuses = await hitMiddleware(mw, '5.5.5.5', 1);
    expect(statuses[0]).toBe(200);
    const res = makeRes();
    await mw(makeReq('5.5.5.5'), res, async () => {});
    expect(res.statusCode).toBe(429);
    expect(res.writtenHeaders['retry-after']).toBeDefined();
  });
});
