import {
  createTestApp,
  registerUser,
  resetDatabase,
  STRONG_PASSWORD,
  TestContext,
  uniqueEmail,
  uploadImage,
  waitForGenerations,
} from './test-app';

describe('Hardening (integration)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.close();
  });

  describe('session cookie', () => {
    it('[AC-SEC-009] public auth endpoints refuse non-JSON bodies (login CSRF through a cross-site form)', async () => {
      const { email } = await registerUser(ctx);
      const login = await ctx
        .http()
        .post('/api/auth/login')
        .type('form')
        .send({ email, password: STRONG_PASSWORD })
        .expect(415);
      expect(login.headers['set-cookie']).toBeUndefined();

      const fresh = uniqueEmail();
      await ctx
        .http()
        .post('/api/auth/register')
        .set('Content-Type', 'text/plain')
        .send(JSON.stringify({ email: fresh, password: STRONG_PASSWORD, acceptedTerms: true }))
        .expect(415);
      expect(await ctx.prisma.user.findUnique({ where: { email: fresh } })).toBeNull();
      await ctx.http().post('/api/auth/forgot-password').type('form').send({ email }).expect(415);
      // The app sends JSON – unchanged.
      await ctx.http().post('/api/auth/login').send({ email, password: STRONG_PASSWORD }).expect(200);
    });

    it('sets an httpOnly cookie on login and requires the CSRF header for cookie auth', async () => {
      const { email } = await registerUser(ctx);
      const login = await ctx.http().post('/api/auth/login').send({ email, password: STRONG_PASSWORD }).expect(200);
      const setCookie = (login.headers['set-cookie'] as unknown as string[]) || [];
      const session = setCookie.find((c) => c.startsWith('ag_session='))!;
      expect(session).toBeDefined();
      expect(session).toMatch(/HttpOnly/i);
      expect(session).toMatch(/SameSite=Lax/i); // non-production
      const cookie = session.split(';')[0];

      // cookie without the custom header → rejected (cross-site form could send that)
      await ctx.http().get('/api/users/me').set('Cookie', cookie).expect(401);
      // cookie + header → accepted
      const me = await ctx
        .http()
        .get('/api/users/me')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .expect(200);
      expect(me.body.email).toBe(email);
      // bearer still works without the header
      await ctx.http().get('/api/users/me').set('Authorization', `Bearer ${login.body.token}`).expect(200);

      const logout = await ctx
        .http()
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .expect(200);
      const cleared = ((logout.headers['set-cookie'] as unknown as string[]) || []).find((c) =>
        c.startsWith('ag_session='),
      )!;
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    });
  });

  describe('rate limiting', () => {
    it('[AC-SEC-008] answers every request with a correlation id and hides internals on unexpected errors', async () => {
      const res = await ctx.http().get('/api/health').set('x-request-id', 'client-abc-123').expect(200);
      expect(res.headers['x-request-id']).toBe('client-abc-123');
      const generated = await ctx.http().get('/api/health').expect(200);
      expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

      const unauthorized = await ctx.http().get('/api/users/me').expect(401);
      expect(unauthorized.body.requestId).toEqual(expect.any(String));
      expect(unauthorized.body.message).toBeDefined();
      expect(JSON.stringify(unauthorized.body)).not.toMatch(/at .*\.ts:\d+/);
    });

    it('[AC-SEC-001] throttles login attempts but never the Stripe webhook or results polling', async () => {
      process.env.THROTTLE_DISABLED = 'false';
      try {
        const { email, token } = await registerUser(ctx);
        const image = await uploadImage(ctx, token);
        let limited = false;
        for (let i = 0; i < 12; i++) {
          const res = await ctx.http().post('/api/auth/login').send({ email, password: 'Wrong!Pass1' });
          if (res.status === 429) {
            limited = true;
            break;
          }
          expect(res.status).toBe(401);
        }
        expect(limited).toBe(true);

        for (let i = 0; i < 40; i++) {
          // Stripe is not configured in this suite → 503 (or 400 with a bad signature); never 429.
          const hook = await ctx
            .http()
            .post('/api/payments/webhook')
            .set('stripe-signature', 't=1,v1=bad')
            .set('Content-Type', 'application/json')
            .send('{}');
          expect([400, 503]).toContain(hook.status);
          await ctx
            .http()
            .get(`/api/generation/${image.id}/results`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        }
      } finally {
        process.env.THROTTLE_DISABLED = 'true';
      }
    });
  });

  describe('in-flight cap under concurrency', () => {
    it('[AC-GEN-004] allows at most 30 active generations per user even for parallel starts', async () => {
      const { token, userId } = await registerUser(ctx);
      await ctx.prisma.user.update({ where: { id: userId }, data: { credits: 1000, freeCreditsUsed: 10 } });
      const image = await uploadImage(ctx, token);
      ctx.gemini.delayMs = 2000; // keep every row in flight while the whole burst is admitted

      const responses = await Promise.all(
        Array.from({ length: 12 }, () =>
          ctx.http().post(`/api/generation/${image.id}/start`).set('Authorization', `Bearer ${token}`).send({}),
        ),
      );
      const ok = responses.filter((r) => r.status === 201).length;
      const capped = responses.filter((r) => r.status === 429).length;
      expect(ok).toBe(10); // 10 × 3 styles = 30
      expect(capped).toBe(2);
      expect(await ctx.prisma.generation.count({ where: { imageId: image.id } })).toBe(30);
      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(user.credits).toBe(1000 - 30);
      await waitForGenerations(ctx, image.id, 120_000);
      ctx.gemini.delayMs = 0;
    });
  });

  describe('admin endpoints', () => {
    it('[AC-ADM-001] are limited to ADMIN_EMAILS and expose the operational overview', async () => {
      const admin = await registerUser(ctx, uniqueEmail('owner'));
      const user = await registerUser(ctx);
      const { AdminGuard } = await import('../src/admin/admin.guard');
      const guard = ctx.app.get(AdminGuard) as any;
      guard.admins = new Set([admin.email]);

      await ctx.http().get('/api/admin/overview').set('Authorization', `Bearer ${user.token}`).expect(403);
      const overview = await ctx
        .http()
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      expect(overview.body.users.total).toBe(2);
      expect(overview.body).toHaveProperty('staleGenerations');

      await ctx.prisma.subscription.create({
        data: { userId: user.userId, stripeSubscriptionId: 'sub_q', planId: 'sub_start', status: 'active' },
      });
      await ctx.prisma.user.update({ where: { id: user.userId }, data: { credits: 30 } });
      const quote = await ctx
        .http()
        .get(`/api/admin/withdrawal-quote?email=${encodeURIComponent(user.email)}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);
      // plan 40 credits for 1900 gr, 30 left → 10 used × 48 gr = 480 gr charged, refund 1420 gr
      expect(quote.body).toMatchObject({
        creditsUsedFromPlan: 10,
        chargeForUsedGrosze: 480,
        suggestedRefundGrosze: 1420,
        withinWithdrawalWindow: true,
      });
    });
  });
});
