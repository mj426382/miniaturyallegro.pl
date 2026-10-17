import { integerSetting, parseBool, parseList, validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://x',
  JWT_SECRET: 'a-very-long-random-secret-value-of-32-chars!!',
  GEMINI_API_KEY: 'g',
  OPENAI_API_KEY: 'o',
  FRONTEND_URL: 'https://app.allgrafika.pl',
  B2_BUCKET_NAME: 'bucket',
  B2_ENDPOINT: 'https://s3.example.com',
  B2_KEY_ID: 'key',
  B2_APPLICATION_KEY: 'secret',
  SMTP_HOST: 'smtp.example.com',
};

describe('validateEnv', () => {
  it('accepts a complete production configuration', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).not.toThrow();
  });

  it('rejects the placeholder JWT secret from .env.example in production', () => {
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: 'your-super-secret-jwt-key-change-in-production' }),
    ).toThrow(/JWT_SECRET/);
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('[AC-SEC-004] requires AI keys and an https frontend URL in production only', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', OPENAI_API_KEY: '' })).toThrow(/OPENAI_API_KEY/);
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', FRONTEND_URL: 'http://x' })).toThrow(/FRONTEND_URL/);
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'development', OPENAI_API_KEY: '', FRONTEND_URL: 'http://x' }),
    ).not.toThrow();
  });

  it('[AC-SEC-011] refuses to start production with rate limiting switched off', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', THROTTLE_DISABLED: 'true' })).toThrow(
      /THROTTLE_DISABLED/,
    );
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', THROTTLE_DISABLED: 'false' })).not.toThrow();
    expect(() => validateEnv({ ...base, NODE_ENV: 'test', THROTTLE_DISABLED: 'true' })).not.toThrow();
  });

  it('[AC-SEC-005] always requires DATABASE_URL and JWT_SECRET', () => {
    expect(() => validateEnv({ ...base, DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ ...base, JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
  });

  it('requires object storage, mail and a webhook secret in production', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', B2_BUCKET_NAME: '' })).toThrow(/B2_BUCKET_NAME/);
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', SMTP_HOST: '' })).toThrow(/SMTP_HOST/);
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', SMTP_HOST: '', ALLOW_NO_SMTP: 'true' })).not.toThrow();
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', STRIPE_SECRET_KEY: 'sk_live_abc' })).toThrow(
      /STRIPE_WEBHOOK_SECRET/,
    );
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        STRIPE_SECRET_KEY: 'sk_live_abc',
        STRIPE_WEBHOOK_SECRET: 'whsec_real',
      }),
    ).not.toThrow();
    // development stays permissive
    expect(() => validateEnv({ ...base, NODE_ENV: 'development', B2_BUCKET_NAME: '', SMTP_HOST: '' })).not.toThrow();
  });

  it('[AC-SEC-006] validates FREE_CREDITS_LIMIT', () => {
    expect(() => validateEnv({ ...base, FREE_CREDITS_LIMIT: '-1' })).toThrow(/FREE_CREDITS_LIMIT/);
    expect(() => validateEnv({ ...base, FREE_CREDITS_LIMIT: '3' })).not.toThrow();
  });
});

describe('helpers', () => {
  it('[AC-SEC-012] validates the optional purpose secrets and the unsubscribe cut-over date', () => {
    // Production keeps starting without any of the new variables (keys are derived from JWT_SECRET).
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).not.toThrow();
    for (const key of ['UNSUBSCRIBE_TOKEN_SECRET', 'DEMO_IP_HASH_SECRET', 'ACCOUNT_TOMBSTONE_SECRET']) {
      expect(() => validateEnv({ ...base, NODE_ENV: 'production', [key]: 'too-short' })).toThrow(new RegExp(key));
      expect(() =>
        validateEnv({ ...base, NODE_ENV: 'production', [key]: 'change-me-change-me-change-me-change-me' }),
      ).toThrow(new RegExp(key));
      expect(() =>
        validateEnv({ ...base, NODE_ENV: 'production', [key]: 'k9V2qL7xT4mR8wZ1nB5cY3hJ6fD0sA2e' }),
      ).not.toThrow();
      // Outside production a short value is fine (tests, local development).
      expect(() => validateEnv({ ...base, NODE_ENV: 'development', [key]: 'short' })).not.toThrow();
    }
    expect(() => validateEnv({ ...base, UNSUBSCRIBE_LEGACY_CUTOVER: 'next week' })).toThrow(
      /UNSUBSCRIBE_LEGACY_CUTOVER/,
    );
    expect(() => validateEnv({ ...base, UNSUBSCRIBE_LEGACY_CUTOVER: '2026-12-01T00:00:00Z' })).not.toThrow();
  });

  it('[AC-UPL-023] validates the upload limits and falls back to 5 and 200', () => {
    expect(integerSetting('UPLOAD_LIMIT_UNVERIFIED', undefined)).toBe(5);
    expect(integerSetting('UPLOAD_LIMIT_PER_DAY', undefined)).toBe(200);
    expect(integerSetting('UPLOAD_LIMIT_PER_DAY', '50')).toBe(50);
    for (const value of ['-1', '1.5', 'abc', '1001']) {
      expect(() => validateEnv({ ...base, UPLOAD_LIMIT_UNVERIFIED: value })).toThrow(/UPLOAD_LIMIT_UNVERIFIED/);
    }
    for (const value of ['0', '10001', '2.5']) {
      expect(() => validateEnv({ ...base, UPLOAD_LIMIT_PER_DAY: value })).toThrow(/UPLOAD_LIMIT_PER_DAY/);
    }
    expect(() => validateEnv({ ...base, UPLOAD_LIMIT_UNVERIFIED: '0', UPLOAD_LIMIT_PER_DAY: '10000' })).not.toThrow();
  });

  it('[AC-AUTH-032] validates the tombstone retention (1–36 months, default 12)', () => {
    expect(integerSetting('ACCOUNT_TOMBSTONE_RETENTION_MONTHS', undefined)).toBe(12);
    expect(integerSetting('ACCOUNT_TOMBSTONE_RETENTION_MONTHS', '6')).toBe(6);
    for (const value of ['0', '37', '1.5', 'twelve']) {
      expect(() => validateEnv({ ...base, ACCOUNT_TOMBSTONE_RETENTION_MONTHS: value })).toThrow(
        /ACCOUNT_TOMBSTONE_RETENTION_MONTHS/,
      );
    }
    expect(() => validateEnv({ ...base, ACCOUNT_TOMBSTONE_RETENTION_MONTHS: '36' })).not.toThrow();
  });

  it('[AC-SEC-007] parses lists and booleans', () => {
    expect(parseList(' a, b ,,c ')).toEqual(['a', 'b', 'c']);
    expect(parseList('', ['x'])).toEqual(['x']);
    expect(parseBool('true', false)).toBe(true);
    expect(parseBool('0', true)).toBe(false);
    expect(parseBool(undefined, true)).toBe(true);
  });
});
