import { parseBool, parseList, validateEnv } from './env.validation';

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
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', ALLEGRO_CLIENT_ID: 'id', ALLEGRO_TOKEN_KEY: 'short' }),
    ).toThrow(/ALLEGRO_TOKEN_KEY/);
    // development stays permissive
    expect(() => validateEnv({ ...base, NODE_ENV: 'development', B2_BUCKET_NAME: '', SMTP_HOST: '' })).not.toThrow();
  });

  it('[AC-SEC-006] validates FREE_CREDITS_LIMIT', () => {
    expect(() => validateEnv({ ...base, FREE_CREDITS_LIMIT: '-1' })).toThrow(/FREE_CREDITS_LIMIT/);
    expect(() => validateEnv({ ...base, FREE_CREDITS_LIMIT: '3' })).not.toThrow();
  });
});

describe('helpers', () => {
  it('[AC-SEC-007] parses lists and booleans', () => {
    expect(parseList(' a, b ,,c ')).toEqual(['a', 'b', 'c']);
    expect(parseList('', ['x'])).toEqual(['x']);
    expect(parseBool('true', false)).toBe(true);
    expect(parseBool('0', true)).toBe(false);
    expect(parseBool(undefined, true)).toBe(true);
  });
});
