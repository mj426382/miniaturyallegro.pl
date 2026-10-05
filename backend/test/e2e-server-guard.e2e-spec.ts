import { assertSafeE2eEnv } from './e2e-server-guard';

const LOCAL = 'postgresql://postgres:postgres@localhost:5437/allgrafika_e2e_test?schema=public';

describe('full-stack e2e server guard (spec 17)', () => {
  it('[AC-E2E-002] refuses NODE_ENV=production', () => {
    expect(() => assertSafeE2eEnv({ NODE_ENV: 'production', E2E_DATABASE_URL: LOCAL })).toThrow(/NODE_ENV=production/);
  });

  it('[AC-E2E-002] refuses a database without "test" in its name or on a remote host', () => {
    expect(() =>
      assertSafeE2eEnv({ E2E_DATABASE_URL: 'postgresql://u:p@localhost:5432/allgrafika?schema=public' }),
    ).toThrow(/must contain "test"/);
    expect(() =>
      assertSafeE2eEnv({ E2E_DATABASE_URL: 'postgresql://u:p@db.example.com:5432/allgrafika_test' }),
    ).toThrow(/only a local database/);
    expect(() => assertSafeE2eEnv({})).toThrow(/E2E_DATABASE_URL is required/);
    expect(() => assertSafeE2eEnv({ E2E_DATABASE_URL: 'not a url' })).toThrow(/not a valid URL/);
  });

  it('[AC-E2E-002] accepts a local test database', () => {
    expect(assertSafeE2eEnv({ NODE_ENV: 'development', E2E_DATABASE_URL: LOCAL })).toBe(LOCAL);
    expect(assertSafeE2eEnv({ E2E_DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/x_test' })).toBe(
      'postgresql://u:p@127.0.0.1:5432/x_test',
    );
  });
});
