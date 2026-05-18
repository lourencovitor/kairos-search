import type { Middleware } from './types.js';

export function createCorsMiddleware(allowedOrigins: string[]): Middleware {
  const originSet = new Set(allowedOrigins);

  return async (req, res, next) => {
    const origin = req.headers.origin ?? '';

    if (origin && (originSet.size === 0 || originSet.has(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    await next();
  };
}
