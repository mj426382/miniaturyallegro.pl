import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

type RequestWithContext = Request & { user?: { userId?: string } };

/** pino-http types the id as unknown-ish ReqId – normalise to a string for logs and responses. */
function requestIdOf(request: RequestWithContext): string | undefined {
  const id = (request as { id?: unknown }).id;
  if (id !== undefined && id !== null && id !== '-') return String(id);
  const header = request.headers['x-request-id'];
  return typeof header === 'string' ? header : undefined;
}

/**
 * One place that shapes every error response and records every unexpected failure.
 *
 * - HttpException (validation, 401/403/404/402…): passed through unchanged, plus `requestId`.
 * - Anything else: 500 with a generic message (no stack/internal text leaks), logged with the
 *   request id, method, path and user, and reported to Sentry when a DSN is configured.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithContext>();
    const requestId = requestIdOf(request);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const payload =
        typeof body === 'string' ? { statusCode: status, message: body } : (body as Record<string, unknown>);
      if (status >= 500) this.report(exception, request, requestId);
      response.status(status).json({ ...payload, requestId });
      return;
    }

    this.report(exception, request, requestId);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie, a jeśli problem wraca, podaj nam identyfikator żądania.',
      requestId,
    });
  }

  private report(exception: unknown, request: RequestWithContext, requestId?: string) {
    const error = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(
      `${request.method} ${request.originalUrl ?? request.url} failed (requestId=${requestId ?? '-'}, user=${request.user?.userId ?? 'anonymous'}): ${error.message}`,
      error.stack,
    );
    if (Sentry.getClient()) {
      Sentry.withScope((scope) => {
        scope.setTag('requestId', requestId ?? 'unknown');
        if (request.user?.userId) scope.setUser({ id: request.user.userId });
        scope.setContext('request', { method: request.method, url: request.originalUrl ?? request.url });
        Sentry.captureException(error);
      });
    }
  }
}
