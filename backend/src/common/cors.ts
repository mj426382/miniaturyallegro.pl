import { parseList } from '../config/env.validation';

export const DEFAULT_CORS_ORIGINS = ['https://app.allgrafika.pl', 'https://allgrafika.pl', 'https://www.allgrafika.pl'];

/**
 * Spec 18: origins of the Android/iOS apps (Capacitor `server.hostname`). The host is on our own
 * domain and is never served by any website (no DNS record), so a page cannot impersonate it.
 * Always allowed, independent of CORS_ORIGINS, so a server env override cannot lock the apps out.
 */
export const NATIVE_APP_ORIGINS = ['https://native.allgrafika.pl', 'capacitor://native.allgrafika.pl'];

const DEV_CORS_ORIGINS = ['http://localhost:5173', 'http://localhost:5174'];

export function buildCorsOrigins(env: { CORS_ORIGINS?: string; NODE_ENV?: string }): string[] {
  const isProd = env.NODE_ENV === 'production';
  return [
    ...new Set([
      ...parseList(env.CORS_ORIGINS, DEFAULT_CORS_ORIGINS),
      ...NATIVE_APP_ORIGINS,
      ...(isProd ? [] : DEV_CORS_ORIGINS),
    ]),
  ];
}
