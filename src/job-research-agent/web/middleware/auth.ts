import type { Middleware } from './types.js';

export function createAuthMiddleware(token: string | undefined): Middleware {
  return async (req, res, next) => {
    if (!token) {
      await next();
      return;
    }
    const auth = req.headers.authorization ?? '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (bearer !== token) {
      res.writeHead(401, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    await next();
  };
}
