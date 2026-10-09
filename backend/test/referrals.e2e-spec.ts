import {
  createTestApp,
  getCredits,
  registerUser,
  resetDatabase,
  STRONG_PASSWORD,
  TestContext,
  uniqueEmail,
} from './test-app';
import { AuthService } from '../src/auth/auth.service';
import { ReferralsService } from '../src/referrals/referrals.service';

/** Spec 20: referral programme. */
describe('referrals (spec 20)', () => {
  let ctx: TestContext;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    ctx.mail.sent = [];
    (ctx.app.get(ReferralsService) as any).maxRewards = 25;
  });

  async function referrerWithLink() {
    const referrer = await registerUser(ctx, uniqueEmail('polecajacy'));
    const res = await ctx.http().get('/api/users/me/referral').set(auth(referrer.token)).expect(200);
    return { ...referrer, code: res.body.code as string, link: res.body.link as string };
  }

  /** Signs up with the code; the account is NOT confirmed yet. */
  async function signUpWithCode(code: string, email = uniqueEmail('polecony')) {
    const res = await ctx
      .http()
      .post('/api/auth/register')
      .send({ email, password: STRONG_PASSWORD, acceptedTerms: true, referralCode: code })
      .expect(201);
    return { email, userId: res.body.user.id as string, token: res.body.token as string };
  }

  function verificationTokenFor(email: string) {
    const mail = [...ctx.mail.sent].reverse().find((m) => m.to === email && /verify-email\?token=/.test(m.text));
    return mail!.text.match(/verify-email\?token=([A-Za-z0-9_-]+)/)![1];
  }

  it('[AC-REF-001] gives a stable random code, a sign-up link and the results', async () => {
    const referrer = await referrerWithLink();
    expect(referrer.code).toMatch(/^[a-z0-9]{8}$/);
    expect(referrer.code).not.toContain(referrer.email.split('@')[0].slice(0, 4));
    expect(referrer.link).toBe(`http://localhost:5173/register?ref=${referrer.code}`);
    const again = await ctx.http().get('/api/users/me/referral').set(auth(referrer.token)).expect(200);
    expect(again.body).toMatchObject({ code: referrer.code, bonus: 3, referred: 0, rewarded: 0, creditsEarned: 0 });
    await ctx.http().get('/api/users/me/referral').expect(401);
  });

  it('[AC-REF-002] pays 3 credits to both sides only after the referred e-mail is confirmed, once', async () => {
    const referrer = await referrerWithLink();
    const referred = await signUpWithCode(referrer.code.toUpperCase());

    expect((await getCredits(ctx, referrer.userId)).credits).toBe(0);
    expect((await getCredits(ctx, referred.userId)).credits).toBe(0);

    const token = verificationTokenFor(referred.email);
    await ctx.http().post('/api/auth/verify-email').send({ token }).expect(200);
    expect((await getCredits(ctx, referrer.userId)).credits).toBe(3);
    expect((await getCredits(ctx, referred.userId)).credits).toBe(3);
    const grants = await ctx.prisma.creditGrant.findMany({ where: { grantedBy: 'polecenia' } });
    expect(grants.map((g) => g.amount)).toEqual([3, 3]);

    // Opening the link again does not pay twice.
    await ctx.http().post('/api/auth/verify-email').send({ token }).expect(200);
    await ctx.app.get(ReferralsService).rewardIfEligible(referred.userId);
    expect((await getCredits(ctx, referrer.userId)).credits).toBe(3);

    const summary = await ctx.http().get('/api/users/me/referral').set(auth(referrer.token)).expect(200);
    expect(summary.body).toMatchObject({ referred: 1, rewarded: 1, creditsEarned: 3 });
  });

  it('[AC-REF-003] a Google sign-up with the code pays at once; an existing Google login with a code changes nothing', async () => {
    const referrer = await referrerWithLink();
    const service = ctx.app.get(AuthService) as any;
    service.googleClientId = 'test-client';
    const payloads: any[] = [];
    service.googleClient = { verifyIdToken: async () => ({ getPayload: () => payloads.shift() }) };

    payloads.push({ sub: 'g-ref-1', email: 'google-polecony@example.com', email_verified: true });
    await ctx
      .http()
      .post('/api/auth/google')
      .send({ googleToken: 't', acceptedTerms: true, referralCode: referrer.code })
      .expect(200);
    const referred = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'google-polecony@example.com' } });
    expect(referred.referredById).toBe(referrer.userId);
    expect((await getCredits(ctx, referred.id)).credits).toBe(3);
    expect((await getCredits(ctx, referrer.userId)).credits).toBe(3);

    const other = await registerUser(ctx, uniqueEmail('inny'));
    const otherCode = (await ctx.http().get('/api/users/me/referral').set(auth(other.token)).expect(200)).body.code;
    payloads.push({ sub: 'g-ref-1', email: 'google-polecony@example.com', email_verified: true });
    await ctx.http().post('/api/auth/google').send({ googleToken: 't', referralCode: otherCode }).expect(200);
    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: referred.id } })).referredById).toBe(
      referrer.userId,
    );
    expect((await getCredits(ctx, other.userId)).credits).toBe(0);
    expect((await getCredits(ctx, referred.id)).credits).toBe(3);
  });

  it('[AC-REF-004] ignores unknown codes and stops rewarding the referrer after the cap', async () => {
    const unknown = await signUpWithCode('nieistnieje1');
    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: unknown.userId } })).referredById).toBeNull();
    await ctx
      .http()
      .post('/api/auth/register')
      .send({ email: uniqueEmail('zly'), password: STRONG_PASSWORD, acceptedTerms: true, referralCode: '<script>' })
      .expect(201);

    (ctx.app.get(ReferralsService) as any).maxRewards = 1;
    const referrer = await referrerWithLink();
    for (const prefix of ['pierwszy', 'drugi']) {
      const referred = await signUpWithCode(referrer.code, uniqueEmail(prefix));
      await ctx
        .http()
        .post('/api/auth/verify-email')
        .send({ token: verificationTokenFor(referred.email) })
        .expect(200);
      expect((await getCredits(ctx, referred.userId)).credits).toBe(3);
    }
    expect((await getCredits(ctx, referrer.userId)).credits).toBe(3);
    const summary = await ctx.http().get('/api/users/me/referral').set(auth(referrer.token)).expect(200);
    expect(summary.body).toMatchObject({ referred: 2, rewarded: 2, creditsEarned: 3, maxRewards: 1 });
  });
});
