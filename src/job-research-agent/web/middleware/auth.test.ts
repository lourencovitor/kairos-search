import { describe, expect, it } from 'vitest';

import type { IncomingMessage, ServerResponse } from 'node:http';

import { createAuthMiddleware } from './auth.js';

function makeReq(headers: Record<string, string> = {}): IncomingMessage {
  return { headers, socket: { remoteAddress: '127.0.0.1' } } as unknown as IncomingMessage;
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

describe('createAuthMiddleware', () => {
  it('passes through when no token configured', async () => {
    const mw = createAuthMiddleware(undefined);
    let called = false;
    const res = makeRes();
    await mw(makeReq(), res, async () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('returns 401 when no Authorization header', async () => {
    const mw = createAuthMiddleware('secret');
    let called = false;
    const res = makeRes();
    await mw(makeReq(), res, async () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 with wrong token', async () => {
    const mw = createAuthMiddleware('secret');
    let called = false;
    const res = makeRes();
    await mw(makeReq({ authorization: 'Bearer wrong' }), res, async () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('passes through with correct Bearer token', async () => {
    const mw = createAuthMiddleware('secret');
    let called = false;
    const res = makeRes();
    await mw(makeReq({ authorization: 'Bearer secret' }), res, async () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(res.statusCode).toBe(200);
  });
});
