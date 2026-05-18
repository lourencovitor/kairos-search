import type { Middleware } from './types.js';

interface Entry {
  count: number;
  resetAt: number;
}

export function createRateLimitMiddleware(maxPerMinute = 60): Middleware {
  const store = new Map<string, Entry>();

  return async (req, res, next) => {
    const ip = req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    const windowMs = 60_000;

    let entry = store.get(ip);
    if (!entry || entry.resetAt <= now) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    entry.count += 1;
    if (entry.count > maxPerMinute) {
      res.writeHead(429, {
        'content-type': 'application/json; charset=utf-8',
        'retry-after': String(Math.ceil((entry.resetAt - now) / 1000)),
      });
      res.end(JSON.stringify({ error: 'Too Many Requests' }));
      return;
    }

    await next();
  };
}
