import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Correlation id for every request: reuse the one a proxy/client sent, otherwise mint a UUID.
 * It is attached to the request (for logs, error responses and Sentry) and echoed in the
 * response header so a user can quote it when reporting a problem.
 */
export function requestIdMiddleware(req: Request & { id?: string }, res: Response, next: NextFunction) {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const id = typeof incoming === 'string' && /^[\w.-]{8,128}$/.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
