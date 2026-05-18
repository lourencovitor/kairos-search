import { describe, expect, it } from 'vitest';

import type { IncomingMessage, ServerResponse } from 'node:http';

import { createCorsMiddleware } from './cors.js';

function makeReq(origin = '', method = 'GET'): IncomingMessage {
  return {
    headers: origin ? { origin } : {},
    method,
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as IncomingMessage;
}

function makeRes() {
  const res = {
    statusCode: 200,
    writtenHeaders: {} as Record<string, string>,
    body: '',
    writeHead(status: number) {
      res.statusCode = status;
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

describe('createCorsMiddleware', () => {
  it('allows any origin when allowedOrigins is empty', async () => {
    const mw = createCorsMiddleware([]);
    const res = makeRes();
    let called = false;
    await mw(makeReq('https://example.com'), res, async () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(res.writtenHeaders['Access-Control-Allow-Origin']).toBe('https://example.com');
  });

  it('sets CORS headers for allowed origin', async () => {
    const mw = createCorsMiddleware(['https://kairos.app']);
    const res = makeRes();
    await mw(makeReq('https://kairos.app'), res, async () => {});
    expect(res.writtenHeaders['Access-Control-Allow-Origin']).toBe('https://kairos.app');
    expect(res.writtenHeaders['Access-Control-Allow-Methods']).toContain('POST');
  });

  it('does not set CORS headers for disallowed origin', async () => {
    const mw = createCorsMiddleware(['https://kairos.app']);
    const res = makeRes();
    let called = false;
    await mw(makeReq('https://evil.com'), res, async () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(res.writtenHeaders['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('handles OPTIONS preflight and returns 204', async () => {
    const mw = createCorsMiddleware([]);
    const res = makeRes();
    let called = false;
    await mw(makeReq('https://example.com', 'OPTIONS'), res, async () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(204);
  });

  it('does not set headers when no origin header is present', async () => {
    const mw = createCorsMiddleware([]);
    const res = makeRes();
    await mw(makeReq(''), res, async () => {});
    expect(res.writtenHeaders['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
