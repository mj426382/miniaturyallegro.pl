import { HttpException } from '@nestjs/common';
import { createTestApp, registerUser, resetDatabase, STRONG_PASSWORD, TestContext } from './test-app';
import { UploadQuotaService } from '../src/images/upload-quota.service';
import { AccountTombstoneService } from '../src/users/account-tombstone.service';
import { validateEnv } from '../src/config/env.validation';

/**
 * Regulamin § 11 (change of 18 October 2026): rules that limit users – upload limits (§ 5 ust. 4) and the
 * e-mail hash of deleted accounts (§ 3 ust. 6) – apply 14 days after publication (§ 2 ust. 4).
 * Before the date the backend only prepares (records uploads), then enforces from the first second.
 */
describe('rules that start on a date (spec 04 AC-UPL-025, spec 03 AC-AUTH-033)', () => {
  let ctx: TestContext;
  const FROM = '2026-11-01T00:00:00+01:00';
  const before = (minutes: number) => new Date(Date.parse(FROM) - minutes * 60_000);
  const after = (minutes: number) => new Date(Date.parse(FROM) + minutes * 60_000);
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  /** A quota service configured like production (limits from 1.11.2026) on the test database. */
  function quotaFrom(settings: Record<string, string>) {
    const config = {
      get: (key: string) => ({ UPLOAD_LIMITS_FROM: FROM, EMAIL_VERIFICATION_REQUIRED: 'true', ...settings })[key],
    };
    return new UploadQuotaService(ctx.prisma as any, config as any);
  }

  async function expectHttp(promise: Promise<unknown>, status: number, code: string) {
    const err = await promise.then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(status);
    expect(((err as HttpException).getResponse() as any).code).toBe(code);
  }

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  it('[AC-UPL-025] before the date uploads over the limit pass and are recorded; from the date the limits count them', async () => {
    const unverified = await registerUser(ctx, undefined, { verified: false });
    const verified = await registerUser(ctx);
    const quota = quotaFrom({ UPLOAD_LIMIT_UNVERIFIED: '5', UPLOAD_LIMIT_PER_DAY: '3' });

    // Unconfirmed account: 7 uploads in the last days before the date – all pass.
    for (let i = 0; i < 7; i++) await quota.reserve(unverified.userId, before(60 * 24 * 3 - i));
    expect(await ctx.prisma.uploadLog.count({ where: { userId: unverified.userId } })).toBe(7);
    // First second of the new rules: the 7 recorded uploads already exceed 5 → 403.
    await expectHttp(quota.reserve(unverified.userId, after(0)), 403, 'UPLOAD_LIMIT_UNVERIFIED');

    // Confirmed account: 4 uploads in the last hour before the date pass (limit 3 / 24 h not yet enforced).
    for (let i = 0; i < 4; i++) await quota.reserve(verified.userId, before(50 - i));
    // 30 minutes after the date those uploads are still in the rolling window → 429 with Retry-After.
    await expectHttp(quota.reserve(verified.userId, after(30)), 429, 'UPLOAD_LIMIT_DAILY');
    // Once the window has moved past them, uploads pass again.
    await quota.reserve(verified.userId, after(24 * 60));
    expect(await ctx.prisma.uploadLog.count({ where: { userId: verified.userId } })).toBe(5);

    // The application uses the same service from DI: in tests the rules are already in force (setup-env).
    const live = ctx.app.get(UploadQuotaService);
    await expectHttp(live.reserve(unverified.userId), 403, 'UPLOAD_LIMIT_UNVERIFIED');
  });

  it('[AC-AUTH-033] before the date a deleted account leaves no e-mail hash and re-registration gets the full pool', async () => {
    const tombstones = ctx.app.get(AccountTombstoneService) as any;
    const original = tombstones.from as Date;
    try {
      // Production default: hashes only from 1.11.2026 – simulate "now" before that date.
      tombstones.from = new Date('2099-01-01T00:00:00Z');
      expect(tombstones.isActive()).toBe(false);
      const first = await registerUser(ctx);
      const pool = async (token: string) =>
        (await ctx.http().get('/api/users/me').set(auth(token)).expect(200)).body.freeCreditsLimit as number;
      const fullPool = await pool(first.token);
      await ctx.http().delete('/api/users/me').set(auth(first.token)).send({ confirmEmail: first.email }).expect(200);
      expect(await ctx.prisma.accountTombstone.count()).toBe(0);
      const again = await ctx
        .http()
        .post('/api/auth/register')
        .send({ email: first.email, password: STRONG_PASSWORD, acceptedTerms: true })
        .expect(201);
      expect(await pool(again.body.token)).toBe(fullPool);

      // From the date the same deletion stores the hash and the next sign-up gets no free pool.
      tombstones.from = new Date('2020-01-01T00:00:00Z');
      expect(tombstones.isActive()).toBe(true);
      await ctx
        .http()
        .delete('/api/users/me')
        .set(auth(again.body.token))
        .send({ confirmEmail: first.email })
        .expect(200);
      expect(await ctx.prisma.accountTombstone.count()).toBe(1);
      const third = await ctx
        .http()
        .post('/api/auth/register')
        .send({ email: first.email, password: STRONG_PASSWORD, acceptedTerms: true })
        .expect(201);
      expect(await pool(third.body.token)).toBe(0);
    } finally {
      tombstones.from = original;
    }
  });

  it('[AC-UPL-025, AC-AUTH-033] a wrong date in UPLOAD_LIMITS_FROM or ACCOUNT_TOMBSTONES_FROM blocks start-up', () => {
    const base = {
      DATABASE_URL: 'postgresql://x',
      JWT_SECRET: 'a-very-long-random-secret-value-of-32-chars!!',
      GEMINI_API_KEY: 'g',
      OPENAI_API_KEY: 'o',
      FRONTEND_URL: 'https://app.allgrafika.pl',
    };
    expect(() => validateEnv({ ...base, UPLOAD_LIMITS_FROM: 'od listopada' })).toThrow(/UPLOAD_LIMITS_FROM/);
    expect(() => validateEnv({ ...base, ACCOUNT_TOMBSTONES_FROM: '1 listopada' })).toThrow(/ACCOUNT_TOMBSTONES_FROM/);
    expect(() => validateEnv({ ...base, UPLOAD_LIMITS_FROM: FROM, ACCOUNT_TOMBSTONES_FROM: FROM })).not.toThrow();
    expect(() => validateEnv(base)).not.toThrow();
  });
});
