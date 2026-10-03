import type { Request, Response } from 'express';

/**
 * Session transport.
 *
 * The JWT is delivered in an httpOnly cookie so an XSS in the SPA cannot read it.
 * app.allgrafika.pl and api.allgrafika.pl are different sites, so the cookie must be
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

export function hasCsrfHeader(req: Request): boolean {
  return String(req.headers[CSRF_HEADER] || '').toLowerCase() === CSRF_HEADER_VALUE.toLowerCase();
}
