/**
 * Startup validation of environment variables.
 *
 * The application refuses to boot with an insecure or incomplete configuration
 * (e.g. the placeholder JWT secret from .env.example in production). Fail-fast
 * is much cheaper than discovering a misconfiguration after users signed up.
 */

import { DEDICATED_SECRET_ENV_VARS } from '../common/keys';

const PLACEHOLDER_PATTERNS = [/change[-_]?me/i, /your-/i, /placeholder/i, /change_this/i];

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  return PLACEHOLDER_PATTERNS.some((p) => p.test(value));
}

export interface AppEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  FRONTEND_URL: string;
  CORS_ORIGINS: string[];
  TRUST_PROXY: boolean;
  SWAGGER_ENABLED: boolean;
  FREE_CREDITS_LIMIT: number;
  DEFAULT_STYLE_IDS: string[];
  LOCAL_UPLOAD_DIR: string;
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const env = (config.NODE_ENV as string) || 'development';
  const isProd = env === 'production';
  const errors: string[] = [];

  const jwtSecret = config.JWT_SECRET as string | undefined;
  if (!jwtSecret) {
    errors.push('JWT_SECRET is required');
  } else if (isProd && (jwtSecret.length < 32 || isPlaceholder(jwtSecret))) {
    errors.push('JWT_SECRET must be a random string of at least 32 characters in production');
  }

  if (!config.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  if (isProd) {
    if (isPlaceholder(config.GEMINI_API_KEY as string)) errors.push('GEMINI_API_KEY is required in production');
    if (isPlaceholder(config.OPENAI_API_KEY as string)) errors.push('OPENAI_API_KEY is required in production');
    if (!config.FRONTEND_URL || !/^https:\/\//.test(String(config.FRONTEND_URL))) {
      errors.push('FRONTEND_URL must be an https:// URL in production');
    }
    // Without B2 the app would silently keep files on the container disk and serve them unauthenticated.
    for (const key of ['B2_BUCKET_NAME', 'B2_ENDPOINT', 'B2_KEY_ID', 'B2_APPLICATION_KEY']) {
      if (isPlaceholder(config[key] as string)) errors.push(`${key} is required in production (object storage)`);
    }
    // Password reset tells users "we sent a link" – it must actually be able to send it.
    if (!config.SMTP_HOST && config.ALLOW_NO_SMTP !== 'true') {
      errors.push('SMTP_HOST is required in production (password reset e-mails); set ALLOW_NO_SMTP=true to override');
    }
    // The test-only switch would remove brute-force protection from login and reset (AC-SEC-011).
    if (String(config.THROTTLE_DISABLED ?? '').toLowerCase() === 'true') {
      errors.push('THROTTLE_DISABLED=true is only for tests and is not allowed in production');
    }
    const stripeKey = config.STRIPE_SECRET_KEY as string | undefined;
    if (stripeKey && !isPlaceholder(stripeKey) && isPlaceholder(config.STRIPE_WEBHOOK_SECRET as string)) {
      errors.push('STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is set (credits are granted by webhook)');
    }
  }

  // Same default as freeCreditsForNewAccounts() – 5 since spec 19.
  const freeLimit = Number(config.FREE_CREDITS_LIMIT ?? 5);
  if (!Number.isInteger(freeLimit) || freeLimit < 0 || freeLimit > 100) {
    errors.push('FREE_CREDITS_LIMIT must be an integer between 0 and 100');
  }

  // Spec 01, AC-SEC-012: dedicated purpose keys are optional (derived from JWT_SECRET otherwise),
  // but when given in production they must be real secrets.
  for (const key of DEDICATED_SECRET_ENV_VARS) {
    const value = config[key] as string | undefined;
    if (isProd && value && (value.length < 32 || isPlaceholder(value))) {
      errors.push(`${key} must be a random string of at least 32 characters in production (or unset)`);
    }
  }
  const cutover = config.UNSUBSCRIBE_LEGACY_CUTOVER as string | undefined;
  if (cutover && Number.isNaN(Date.parse(cutover))) {
    errors.push('UNSUBSCRIBE_LEGACY_CUTOVER must be an ISO date (e.g. 2026-12-01T00:00:00Z)');
  }

  for (const key of Object.keys(DATE_SETTINGS)) {
    const raw = config[key] as string | undefined;
    if (raw && Number.isNaN(Date.parse(raw)))
      errors.push(`${key} must be an ISO date (e.g. 2026-11-01T00:00:00+01:00)`);
  }

  // Spec 04 and 03: limits and retention, each an integer in its range (unset = default).
  for (const [key, { min, max }] of Object.entries(INTEGER_SETTINGS)) {
    const raw = config[key];
    if (raw === undefined || raw === '') continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) errors.push(`${key} must be an integer between ${min} and ${max}`);
  }

  if (errors.length) {
    throw new Error(`Invalid environment configuration:\n - ${errors.join('\n - ')}`);
  }

  return config;
}

/** Integer settings with their allowed range and default (used by the services that read them). */
export const INTEGER_SETTINGS = {
  /** Spec 04: uploads an unconfirmed account may make in total. */
  UPLOAD_LIMIT_UNVERIFIED: { min: 0, max: 1000, default: 5 },
  /** Spec 04: uploads a confirmed account may make in a rolling 24 h window. */
  UPLOAD_LIMIT_PER_DAY: { min: 1, max: 10000, default: 200 },
  /** Spec 03: how long the hash of a deleted account's e-mail is kept. */
  ACCOUNT_TOMBSTONE_RETENTION_MONTHS: { min: 1, max: 36, default: 12 },
} as const;

/**
 * Dates from which rules that limit users apply (regulamin § 11: 14 days after publication, § 2 ust. 4).
 * Spec 04 AC-UPL-025 (upload limits) and spec 03 AC-AUTH-033 (e-mail hash of deleted accounts).
 */
export const DATE_SETTINGS = {
  UPLOAD_LIMITS_FROM: '2026-11-01T00:00:00+01:00',
  ACCOUNT_TOMBSTONES_FROM: '2026-11-01T00:00:00+01:00',
} as const;

/** Reads a validated date setting, falling back to its default when unset. */
export function dateSetting(key: keyof typeof DATE_SETTINGS, value: string | undefined): Date {
  const parsed = value ? Date.parse(value) : NaN;
  return new Date(Number.isNaN(parsed) ? DATE_SETTINGS[key] : parsed);
}

/** Reads a validated integer setting, falling back to its default when unset. */
export function integerSetting(key: keyof typeof INTEGER_SETTINGS, value: string | undefined): number {
  const { min, max, default: fallback } = INTEGER_SETTINGS[key];
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

/** Comma separated list helper (trims and drops empty entries). */
export function parseList(value: string | undefined, fallback: string[] = []): string[] {
  if (!value) return fallback;
  const items = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

export function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}
