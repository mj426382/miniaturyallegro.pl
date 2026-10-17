import type { Request, Response } from 'express';
import { NATIVE_APP_ORIGINS } from '../common/cors';

/**
 * Session transport.
 *
 * The JWT is delivered in an httpOnly cookie so an XSS in the SPA cannot read it.
 * app.allgrafika.pl and server.allgrafika.pl (the API host) are different sites, so the cookie must be
 * SameSite=None; Secure – which means a cross-site form could still *send* it. The
 * CSRF defence is the custom header below: browsers only attach it after a CORS
 * preflight that our allow-list has approved, so evil.com cannot set it.
 *
 * `Authorization: Bearer` is still accepted (tests, scripts, mobile clients).
 */
export const SESSION_COOKIE = 'ag_session';
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'XMLHttpRequest';

const isProd = () => process.env.NODE_ENV === 'production';

function maxAgeMs(): number {
  const raw = process.env.JWT_EXPIRES_IN || '7d';
  const m = /^(\d+)([smhd])$/.exec(raw);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  return n * { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd']!;
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: isProd() ? 'none' : 'lax',
    path: '/',
    maxAge: maxAgeMs(),
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: isProd(),
    sameSite: isProd() ? 'none' : 'lax',
    path: '/',
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  });
}

export function tokenFromCookie(req: Request): string | null {
  const value = (req as any).cookies?.[SESSION_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Spec 03 AC-AUTH-028 / spec 18 AC-MOB-009: may the JWT also travel in the response body?
 *
 * Only for clients without a web page an XSS could read it from:
 * - the Android/iOS app – recognised by its Origin, which the WebView sets itself and a web page cannot
 *   forge (browsers own the Origin header; the host is ours and serves no site),
 * - non-browser clients (scripts, tests, server integrations) – no Origin and no Sec-Fetch-* headers.
 * Any browser page (an Origin of a website, or Sec-Fetch-* metadata without Origin) gets the cookie only.
 */
export function mayReceiveTokenInBody(req: Request): boolean {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.length > 0) {
    return NATIVE_APP_ORIGINS.includes(origin.toLowerCase().replace(/\/$/, ''));
  }
  const fromBrowser = Object.keys(req.headers).some((h) => h.toLowerCase().startsWith('sec-fetch-'));
  return !fromBrowser;
}

/** Drops `token` from an auth response unless the client may receive it (see mayReceiveTokenInBody). */
export function withBodyToken<T extends { token?: string }>(req: Request, result: T): T | Omit<T, 'token'> {
  if (mayReceiveTokenInBody(req)) return result;
  const { token: _token, ...rest } = result;
  return rest;
}

export function hasCsrfHeader(req: Request): boolean {
  return String(req.headers[CSRF_HEADER] || '').toLowerCase() === CSRF_HEADER_VALUE.toLowerCase();
}
