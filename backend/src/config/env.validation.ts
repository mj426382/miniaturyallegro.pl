/**
 * Startup validation of environment variables.
 *
 * The application refuses to boot with an insecure or incomplete configuration
 * (e.g. the placeholder JWT secret from .env.example in production). Fail-fast
 * is much cheaper than discovering a misconfiguration after users signed up.
 */

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
    const stripeKey = config.STRIPE_SECRET_KEY as string | undefined;
    if (stripeKey && !isPlaceholder(stripeKey) && isPlaceholder(config.STRIPE_WEBHOOK_SECRET as string)) {
      errors.push('STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is set (credits are granted by webhook)');
    }
    if (config.ALLEGRO_CLIENT_ID && String(config.ALLEGRO_TOKEN_KEY || '').length < 32) {
      errors.push('ALLEGRO_TOKEN_KEY (32+ random chars) is required when the Allegro integration is enabled');
    }
  }

  const freeLimit = Number(config.FREE_CREDITS_LIMIT ?? 10);
  if (!Number.isInteger(freeLimit) || freeLimit < 0 || freeLimit > 100) {
    errors.push('FREE_CREDITS_LIMIT must be an integer between 0 and 100');
  }

  if (errors.length) {
    throw new Error(`Invalid environment configuration:\n - ${errors.join('\n - ')}`);
  }

  return config;
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
