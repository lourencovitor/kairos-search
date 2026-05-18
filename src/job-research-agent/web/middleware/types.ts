import type { IncomingMessage, ServerResponse } from 'node:http';

export type Next = () => Promise<void>;
export type Middleware = (req: IncomingMessage, res: ServerResponse, next: Next) => Promise<void>;
