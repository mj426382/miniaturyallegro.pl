import { createTestApp, registerUser, resetDatabase, STRONG_PASSWORD, TestContext, uniqueEmail } from './test-app';

describe('Auth & users (integration)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    ctx.mail.sent = [];
  });
  afterAll(async () => {
    await ctx.close();
  });

  describe('registration', () => {
    it('[AC-AUTH-001, AC-PRC-001] creates an account, records terms acceptance and returns a JWT', async () => {
      const email = uniqueEmail();
      const res = await ctx
        .http()
        .post('/api/auth/register')
        .send({ email: `  ${email.toUpperCase()} `, password: STRONG_PASSWORD, acceptedTerms: true })
        .expect(201);

      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user.email).toBe(email);
      expect(res.body.user).not.toHaveProperty('password');

      const dbUser = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
      expect(dbUser.termsAcceptedAt).toBeInstanceOf(Date);
      expect(dbUser.password).not.toBe(STRONG_PASSWORD);
      expect(dbUser.credits).toBe(0);
      expect(dbUser.freeCreditsUsed).toBe(0);
    });

    it('[AC-AUTH-002] rejects registration without accepting the terms', async () => {
      const res = await ctx
        .http()
        .post('/api/auth/register')
        .send({ email: uniqueEmail(), password: STRONG_PASSWORD, acceptedTerms: false })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toContain('regulamin');
    });

    it('[AC-AUTH-003] rejects weak passwords and passwords containing the e-mail', async () => {
      await ctx
        .http()
        .post('/api/auth/register')
        .send({ email: uniqueEmail(), password: 'short', acceptedTerms: true })
        .expect(400);

      await ctx
        .http()
        .post('/api/auth/register')
        .send({ email: 'janek@test.pl', password: 'Janek!2345', acceptedTerms: true })
        .expect(400);
    });

    it('[AC-AUTH-004, AC-API-002] rejects unknown body fields (whitelist) and duplicate e-mails', async () => {
      const email = uniqueEmail();
      await ctx
        .http()
        .post('/api/auth/register')
        .send({ email, password: STRONG_PASSWORD, acceptedTerms: true, credits: 9999 })
        .expect(400);

      await registerUser(ctx, email);
      await ctx
        .http()
        .post('/api/auth/register')
        .send({ email, password: STRONG_PASSWORD, acceptedTerms: true })
        .expect(409);
    });
  });

  describe('login', () => {
    it('[AC-AUTH-005] logs in with correct credentials and rejects wrong ones with a generic message', async () => {
      const { email } = await registerUser(ctx);

      const ok = await ctx.http().post('/api/auth/login').send({ email, password: STRONG_PASSWORD }).expect(200);
      expect(ok.body.token).toEqual(expect.any(String));

      const wrong = await ctx.http().post('/api/auth/login').send({ email, password: 'Wrong!Pass1' }).expect(401);
      const unknown = await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: uniqueEmail('nobody'), password: 'Wrong!Pass1' })
        .expect(401);
      // Same message for wrong password and unknown user – no account enumeration.
      expect(wrong.body.message).toBe(unknown.body.message);
    });

    it('[AC-AUTH-006] protects routes with JWT', async () => {
      await ctx.http().get('/api/users/me').expect(401);
      await ctx.http().get('/api/users/me').set('Authorization', 'Bearer not-a-token').expect(401);
    });
  });

  describe('password reset', () => {
    it('[AC-AUTH-007] sends a single-use reset link and allows setting a new password', async () => {
      const { email } = await registerUser(ctx);

      await ctx.http().post('/api/auth/forgot-password').send({ email }).expect(200);
      // Unknown e-mail: same response, no mail.
      await ctx
        .http()
        .post('/api/auth/forgot-password')
        .send({ email: uniqueEmail('ghost') })
        .expect(200);
      expect(ctx.mail.sent).toHaveLength(1);
      expect(ctx.mail.sent[0].to).toBe(email);

      const token = ctx.mail.lastResetToken();
      expect(token).toBeDefined();

      const newPassword = 'N3w!Password';
      await ctx.http().post('/api/auth/reset-password').send({ token, password: newPassword }).expect(200);

      // Old password no longer works, new one does.
      await ctx.http().post('/api/auth/login').send({ email, password: STRONG_PASSWORD }).expect(401);
      await ctx.http().post('/api/auth/login').send({ email, password: newPassword }).expect(200);

      // Token is single-use.
      await ctx.http().post('/api/auth/reset-password').send({ token, password: 'An0ther!Pass' }).expect(400);
    });

    it('[AC-AUTH-008] invalidates sessions issued before the password reset', async () => {
      const { email, token: oldToken } = await registerUser(ctx);
      await ctx.http().get('/api/users/me').set('Authorization', `Bearer ${oldToken}`).expect(200);

      // JWT `iat` has second precision – make sure the reset lands in a later second.
      await new Promise((r) => setTimeout(r, 1100));
      await ctx.http().post('/api/auth/forgot-password').send({ email }).expect(200);
      await ctx
        .http()
        .post('/api/auth/reset-password')
        .send({ token: ctx.mail.lastResetToken(), password: 'N3w!Password' })
        .expect(200);

      await ctx.http().get('/api/users/me').set('Authorization', `Bearer ${oldToken}`).expect(401);
      const fresh = await ctx.http().post('/api/auth/login').send({ email, password: 'N3w!Password' }).expect(200);
      await ctx.http().get('/api/users/me').set('Authorization', `Bearer ${fresh.body.token}`).expect(200);
    });

    it('[AC-AUTH-009] rejects invalid or expired tokens', async () => {
      const { userId } = await registerUser(ctx);
      await ctx.http().post('/api/auth/reset-password').send({ token: 'bogus', password: 'N3w!Password' }).expect(400);

      const { hashResetToken } = await import('../src/auth/auth.service');
      await ctx.prisma.passwordResetToken.create({
        data: { userId, tokenHash: hashResetToken('expired-token'), expiresAt: new Date(Date.now() - 1000) },
      });
      await ctx
        .http()
        .post('/api/auth/reset-password')
        .send({ token: 'expired-token', password: 'N3w!Password' })
        .expect(400);
    });
  });

  describe('password change', () => {
    it('[AC-AUTH-010] needs the current password, re-issues the session and logs other sessions out', async () => {
      const { token, email } = await registerUser(ctx);
      const other = (await ctx.http().post('/api/auth/login').send({ email, password: STRONG_PASSWORD }).expect(200))
        .body.token as string;
      await new Promise((r) => setTimeout(r, 1100)); // JWT iat has second precision – make the old tokens clearly older

      await ctx
        .http()
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'Wrong!Pass1', newPassword: 'N3w!Password' })
        .expect(400);
      await ctx
        .http()
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: STRONG_PASSWORD, newPassword: 'weak' })
        .expect(400);
      await ctx
        .http()
        .post('/api/auth/change-password')
        .send({ currentPassword: STRONG_PASSWORD, newPassword: 'N3w!Password' })
        .expect(401);

      const res = await ctx
        .http()
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: STRONG_PASSWORD, newPassword: 'N3w!Password' })
        .expect(201);
      expect(res.body.token).toEqual(expect.any(String));
      expect(String(res.headers['set-cookie'])).toContain('ag_session=');

      await ctx.http().get('/api/users/me').set('Authorization', `Bearer ${res.body.token}`).expect(200);
      await ctx.http().get('/api/users/me').set('Authorization', `Bearer ${other}`).expect(401);
      await ctx.http().post('/api/auth/login').send({ email, password: STRONG_PASSWORD }).expect(401);
      await ctx.http().post('/api/auth/login').send({ email, password: 'N3w!Password' }).expect(200);
    });

    it('[AC-AUTH-011] tells the UI whether the account has a password', async () => {
      const { token } = await registerUser(ctx);
      const me = await ctx.http().get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(200);
      expect(me.body.hasPassword).toBe(true);
      expect(me.body.password).toBeUndefined();
    });
  });

  describe('Google sign-in', () => {
    it('[AC-AUTH-012] requires explicit terms acceptance for a brand-new account and verified e-mail', async () => {
      const { AuthService } = await import('../src/auth/auth.service');
      const service = ctx.app.get(AuthService) as any;
      service.googleClientId = 'test-client';
      const payloads: any[] = [];
      service.googleClient = { verifyIdToken: async () => ({ getPayload: () => payloads.shift() }) };

      payloads.push({ sub: 'g-1', email: 'G-User@Example.com', email_verified: false });
      await ctx.http().post('/api/auth/google').send({ googleToken: 't' }).expect(401);

      payloads.push({ sub: 'g-1', email: 'G-User@Example.com', email_verified: true });
      const refused = await ctx.http().post('/api/auth/google').send({ googleToken: 't' }).expect(400);
      expect(refused.body.code).toBe('TERMS_REQUIRED');
      expect(await ctx.prisma.user.count()).toBe(0);

      payloads.push({ sub: 'g-1', email: 'G-User@Example.com', email_verified: true, given_name: 'Grażyna' });
      const created = await ctx
        .http()
        .post('/api/auth/google')
        .send({ googleToken: 't', acceptedTerms: true })
        .expect(200);
      expect(created.body.user.email).toBe('g-user@example.com');
      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'g-user@example.com' } });
      expect(user.termsAcceptedAt).toBeInstanceOf(Date);
      expect(user.googleId).toBe('g-1');

      // existing account: no consent needed on subsequent logins
      payloads.push({ sub: 'g-1', email: 'g-user@example.com', email_verified: true });
      await ctx.http().post('/api/auth/google').send({ googleToken: 't' }).expect(200);
    });
  });

  describe('profile & account deletion (RODO)', () => {
    it('[AC-AUTH-013] returns the profile with credit information', async () => {
      const { token, email } = await registerUser(ctx);
      const res = await ctx.http().get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(200);
      expect(res.body).toMatchObject({ email, credits: 0, freeCreditsUsed: 0, totalGenerations: 0 });
      expect(res.body).not.toHaveProperty('password');
    });

    it('[AC-AUTH-014] updates the display name', async () => {
      const { token } = await registerUser(ctx);
      const res = await ctx
        .http()
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '  Anna  ' })
        .expect(200);
      expect(res.body.name).toBe('Anna');
    });

    it('[AC-AUTH-015] deletes the account only after e-mail confirmation and cascades data', async () => {
      const { token, email, userId } = await registerUser(ctx);

      await ctx
        .http()
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ confirmEmail: 'wrong@example.com' })
        .expect(400);

      await ctx
        .http()
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ confirmEmail: email })
        .expect(200);

      expect(await ctx.prisma.user.findUnique({ where: { id: userId } })).toBeNull();
      // the token of a deleted user is rejected by JwtStrategy outright
      await ctx.http().get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(401);
    });
  });

  it('[AC-API-003] exposes a health endpoint', async () => {
    const res = await ctx.http().get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });
});
