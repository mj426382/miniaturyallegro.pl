import { LoggerModule, Params } from 'nestjs-pino';
import type { IncomingMessage } from 'http';
import * as Sentry from '@sentry/node';

/** Headers/fields that must never reach the logs. */
const REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
];

export function logLevel(): string {
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL;
  if (process.env.NODE_ENV === 'test') return 'silent';
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

/**
 * Structured JSON logs (pino) with one line per request, the correlation id and the user id.
 * Development gets pretty output; tests are silent; production ships JSON for log collectors.
 */
export function loggingModule() {
  const isProd = process.env.NODE_ENV === 'production';
  const params: Params = {
    pinoHttp: {
      level: logLevel(),
      genReqId: (req: IncomingMessage & { id?: string }) => req.id ?? (req.headers['x-request-id'] as string) ?? '-',
      customProps: (req: IncomingMessage & { user?: { userId?: string } }) => ({ userId: req.user?.userId }),
      autoLogging: {
        ignore: (req: IncomingMessage) => (req.url ?? '').startsWith('/api/health') || process.env.NODE_ENV === 'test',
      },
      redact: { paths: REDACT, censor: '[redacted]' },
      serializers: {
        req: (req: { id?: string; method?: string; url?: string; remoteAddress?: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          ip: req.remoteAddress,
        }),
        res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
      },
      ...(isProd || process.env.NODE_ENV === 'test'
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true, singleLine: true, translateTime: 'HH:MM:ss' },
            },
          }),
    },
  };
  return LoggerModule.forRoot(params);
}

/** Error reporting is opt-in: without SENTRY_DSN nothing is sent anywhere. */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
  return true;
}
