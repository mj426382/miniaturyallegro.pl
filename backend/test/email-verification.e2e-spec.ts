import * as fs from 'fs';
import * as path from 'path';
import { createTestApp, registerUser, resetDatabase, STRONG_PASSWORD, TestContext, uploadImage } from './test-app';
import { makePng } from './fakes';
import { canonicalEmail } from '../src/auth/email-canonical';
import { CANONICAL_CASES } from '../src/auth/email-canonical.cases';
import { hashResetToken } from '../src/auth/auth.service';

/** Spec 13 – canonical e-mail, verification link, gate on spending credits. */
describe('E-mail canonical form & verification (integration)', () => {
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

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const register = (email: string) =>
    ctx.http().post('/api/auth/register').send({ email, password: STRONG_PASSWORD, acceptedTerms: true });
  const lastVerificationToken = () => {
    const mail = [...ctx.mail.sent].reverse().find((m) => m.subject.includes('potwierdź'));
    return mail?.text.match(/verify-email\?token=([A-Za-z0-9_-]+)/)?.[1];
  };

  it('[AC-VER-002] treats letter case, Gmail dots, googlemail and +aliases as the same mailbox', async () => {
    await register('jan.kowalski@gmail.com').expect(201);
    for (const alias of ['Jan.Kowalski+promo@googlemail.com', 'JANKOWALSKI@gmail.com', 'j.a.n.kowalski@gmail.com']) {
      const res = await register(alias).expect(409);
      expect(res.body.message).toContain('traktujemy jako ten sam adres');
    }
    await register('jan.kowalski@firma.pl').expect(201);
    await register('jan.kowalski+x@firma.pl').expect(409);
    // dots are only ignored by Gmail
    await register('jankowalski@firma.pl').expect(201);
    expect(await ctx.prisma.user.count()).toBe(3);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'jan.kowalski@gmail.com' } });
    expect(user.emailCanonical).toBe('jankowalski@gmail.com');
  });

  it('[AC-VER-003] logs in and resets the password with any alias of the mailbox', async () => {
    const { userId } = await registerUser(ctx, 'jan.kowalski@gmail.com');
    const login = await ctx
      .http()
      .post('/api/auth/login')
      .send({ email: 'JanKowalski+abc@gmail.com', password: STRONG_PASSWORD })
      .expect(200);
    expect(login.body.user.id).toBe(userId);

    ctx.mail.sent = [];
    await ctx.http().post('/api/auth/forgot-password').send({ email: 'jankowalski+reset@googlemail.com' }).expect(200);
    expect(ctx.mail.sent).toHaveLength(1);
    expect(ctx.mail.sent[0].to).toBe('jan.kowalski@gmail.com');
  });

  it('[AC-VER-004] a fresh sign-up is unverified and gets a link; only the token hash is stored', async () => {
    const res = await register('nowy@example.com').expect(201);
    expect(res.body.user.emailVerified).toBe(false);
    const me = await ctx.http().get('/api/users/me').set(auth(res.body.token)).expect(200);
    expect(me.body.emailVerified).toBe(false);
    expect(me.body).not.toHaveProperty('emailVerifiedAt');
    expect(me.body).not.toHaveProperty('emailCanonical');

    const token = lastVerificationToken();
    expect(token).toBeDefined();
    expect(ctx.mail.sent[0]).toMatchObject({ to: 'nowy@example.com' });
    expect(ctx.mail.sent[0].text).toContain('/verify-email?token=');
    const rows = await ctx.prisma.emailVerificationToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashResetToken(token!));
    expect(rows[0].tokenHash).not.toBe(token);
  });

  it('[AC-VER-005] an unverified account cannot spend or buy credits', async () => {
    const { token, userId } = await registerUser(ctx, undefined, { verified: false });
    const image = await uploadImage(ctx, token);

    const start = await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set(auth(token))
      .send({ styles: ['white-bg'] })
      .expect(403);
    expect(start.body.code).toBe('EMAIL_NOT_VERIFIED');
    await ctx
      .http()
      .post(`/api/generation/${image.id}/custom`)
      .set(auth(token))
      .field('userPrompt', 'na drewnianym stole')
      .expect(403);

    // a failed generation that already exists cannot be retried either
    const failed = await ctx.prisma.generation.create({
      data: { imageId: image.id, style: 'white-bg', status: 'FAILED' },
    });
    await ctx.http().post(`/api/generation/retry/${failed.id}`).set(auth(token)).expect(403);

    // edit packs are bought with credits
    await ctx.prisma.offerDescription.create({
      data: { imageId: image.id, title: 'Kubek', body: '<p>Opis kubka testowego.</p>' },
    });
    await ctx.prisma.user.update({ where: { id: userId }, data: { credits: 5 } });
    await ctx.http().post(`/api/descriptions/${image.id}/edit-packs`).set(auth(token)).expect(403);

    const stripe: any = {
      customers: { create: async () => ({ id: 'cus_x' }) },
      checkout: { sessions: { create: jest.fn() } },
    };
    ctx.payments.setStripeClient(stripe);
    await ctx
      .http()
      .post('/api/payments/checkout')
      .set(auth(token))
      .send({ packageId: 'credits_5', acceptedWithdrawalWaiver: true })
      .expect(403);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();

    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user).toMatchObject({ credits: 5, freeCreditsUsed: 0 });
    expect(await ctx.prisma.generation.count()).toBe(1); // only the pre-seeded failed row
  });

  it('[AC-VER-006] the link confirms the address once; reuse is harmless; bad or expired tokens fail', async () => {
    const res = await register('klik@example.com').expect(201);
    const token = lastVerificationToken()!;

    await ctx.http().post('/api/auth/verify-email').send({ token: 'nope' }).expect(400);

    const ok = await ctx.http().post('/api/auth/verify-email').send({ token }).expect(200);
    expect(ok.body).toEqual({ verified: true });
    const me = await ctx.http().get('/api/users/me').set(auth(res.body.token)).expect(200);
    expect(me.body.emailVerified).toBe(true);
    const again = await ctx.http().post('/api/auth/verify-email').send({ token }).expect(200);
    expect(again.body).toEqual({ verified: true, alreadyVerified: true });

    const image = await uploadImage(ctx, res.body.token);
    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set(auth(res.body.token))
      .send({ styles: ['white-bg'] })
      .expect(201);

    // expired link of another, still unverified account
    await register('stary@example.com').expect(201);
    const expiredToken = lastVerificationToken()!;
    await ctx.prisma.emailVerificationToken.updateMany({
      where: { tokenHash: hashResetToken(expiredToken) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await ctx.http().post('/api/auth/verify-email').send({ token: expiredToken }).expect(400);
  });

  it('[AC-VER-007] resend issues a new link, invalidates the old one and respects the 60 s cooldown', async () => {
    const res = await register('ponownie@example.com').expect(201);
    const first = lastVerificationToken()!;

    // within the cooldown
    const early = await ctx.http().post('/api/auth/resend-verification').set(auth(res.body.token)).expect(429);
    expect(early.body.message).toMatch(/spróbuj ponownie za \d+ s/);

    await ctx.prisma.emailVerificationToken.updateMany({ data: { createdAt: new Date(Date.now() - 61_000) } });
    const sent = await ctx.http().post('/api/auth/resend-verification').set(auth(res.body.token)).expect(200);
    expect(sent.body).toEqual({ sent: true });
    const second = lastVerificationToken()!;
    expect(second).not.toBe(first);

    await ctx.http().post('/api/auth/verify-email').send({ token: first }).expect(400);
    await ctx.http().post('/api/auth/verify-email').send({ token: second }).expect(200);

    const mailsBefore = ctx.mail.sent.length;
    const done = await ctx.http().post('/api/auth/resend-verification').set(auth(res.body.token)).expect(200);
    expect(done.body).toEqual({ alreadyVerified: true });
    expect(ctx.mail.sent).toHaveLength(mailsBefore);
  });

  it('[AC-VER-008] Google sign-in verifies the account and joins an existing alias account', async () => {
    const { AuthService } = await import('../src/auth/auth.service');
    const service = ctx.app.get(AuthService) as any;
    service.googleClientId = 'test-client';
    const payloads: any[] = [];
    service.googleClient = { verifyIdToken: async () => ({ getPayload: () => payloads.shift() }) };

    // new Google account
    payloads.push({ sub: 'g-new', email: 'Nowa.Osoba@gmail.com', email_verified: true });
    await ctx.http().post('/api/auth/google').send({ googleToken: 't', acceptedTerms: true }).expect(200);
    const fresh = await ctx.prisma.user.findUniqueOrThrow({ where: { googleId: 'g-new' } });
    expect(fresh.emailVerifiedAt).toBeInstanceOf(Date);
    expect(fresh.emailCanonical).toBe('nowaosoba@gmail.com');

    // existing unverified password account on an alias of the same mailbox
    const { userId } = await registerUser(ctx, 'anna.nowak+sklep@gmail.com', { verified: false });
    payloads.push({ sub: 'g-anna', email: 'annanowak@gmail.com', email_verified: true });
    const res = await ctx.http().post('/api/auth/google').send({ googleToken: 't' }).expect(200);
    expect(res.body.user.id).toBe(userId);
    const joined = await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(joined.googleId).toBe('g-anna');
    expect(joined.emailVerifiedAt).toBeInstanceOf(Date);
    expect(await ctx.prisma.user.count()).toBe(2);
  });

  describe('[AC-VER-009] migration backfill on production-like data', () => {
    it('SQL canonical function mirrors the TypeScript one', async () => {
      for (const [input] of CANONICAL_CASES) {
        const rows = await ctx.prisma.$queryRaw<{ c: string }[]>`SELECT allgrafika_email_canonical(${input}) AS c`;
        expect({ input, sql: rows[0].c }).toEqual({ input, sql: canonicalEmail(input) });
      }
    });

    it('keeps old duplicates usable, gives the oldest the canonical form and trusts old accounts', async () => {
      const migration = fs.readFileSync(
        path.join(__dirname, '../prisma/migrations/20261004090000_email_verification_invoices/migration.sql'),
        'utf8',
      );
      const backfill = migration.split('-- backfill:start')[1].split('-- backfill:end')[0];
      const statements = backfill
        .split(/;\s*\n/)
        .map((s) => s.trim())
        .filter((s) => s && !s.split('\n').every((line) => line.trim().startsWith('--')));

      // Accounts as they existed before 2026-10-04 (placeholders stand in for the not-yet-filled column).
      const seed = [
        { id: 'u1', email: 'J.Mateusz14@gmail.com', createdAt: new Date('2026-05-01') },
        { id: 'u2', email: 'j.mateusz14+medicube@gmail.com', createdAt: new Date('2026-09-30') },
        { id: 'u3', email: 'Ola@Firma.pl', createdAt: new Date('2026-06-01') },
        { id: 'u4', email: 'ola@firma.pl', createdAt: new Date('2026-07-01') },
      ];
      for (const u of seed) {
        await ctx.prisma.user.create({
          data: { ...u, emailCanonical: `tmp-${u.id}`, termsAcceptedAt: u.createdAt },
        });
      }
      for (const statement of statements) await ctx.prisma.$executeRawUnsafe(statement);

      const users = Object.fromEntries((await ctx.prisma.user.findMany()).map((u) => [u.id, u]));
      expect(users.u1).toMatchObject({ email: 'j.mateusz14@gmail.com', emailCanonical: 'jmateusz14@gmail.com' });
      expect(users.u2.emailCanonical).toBe('j.mateusz14+medicube@gmail.com#legacy:u2');
      // letter-case twins: neither is lower-cased (that would collide), the older owns the mailbox
      expect(users.u3).toMatchObject({ email: 'Ola@Firma.pl', emailCanonical: 'ola@firma.pl' });
      expect(users.u4).toMatchObject({ email: 'ola@firma.pl', emailCanonical: 'ola@firma.pl#legacy:u4' });
      for (const u of seed) expect(users[u.id].emailVerifiedAt).toEqual(u.createdAt);

      // the legacy duplicate still logs in with its exact address
      const bcrypt = await import('bcryptjs');
      await ctx.prisma.user.update({ where: { id: 'u2' }, data: { password: await bcrypt.hash(STRONG_PASSWORD, 4) } });
      const login = await ctx
        .http()
        .post('/api/auth/login')
        .send({ email: 'j.mateusz14+medicube@gmail.com', password: STRONG_PASSWORD })
        .expect(200);
      expect(login.body.user.id).toBe('u2');
    });
  });

  it('[AC-VER-010] the demo limit counts per mailbox, not per spelling', async () => {
    const png = await makePng({ r: 1, g: 2, b: 3 }, 128);
    await ctx
      .http()
      .post('/api/demo')
      .field('email', 'anna+1@gmail.com')
      .attach('file', png, { filename: 'p.png', contentType: 'image/png' })
      .expect(201);
    await ctx
      .http()
      .post('/api/demo')
      .field('email', 'a.nna@gmail.com')
      .attach('file', png, { filename: 'p.png', contentType: 'image/png' })
      .expect(409);
    const row = await ctx.prisma.demoRequest.findFirstOrThrow();
    expect(row.emailCanonical).toBe('anna@gmail.com');
  });

  it('[AC-VER-011] the operator switch lets unverified accounts generate', async () => {
    const { CreditsService } = await import('../src/generation/credits.service');
    const credits = ctx.app.get(CreditsService) as any;
    credits.verificationRequired = false;
    try {
      const { token } = await registerUser(ctx, undefined, { verified: false });
      const image = await uploadImage(ctx, token);
      await ctx
        .http()
        .post(`/api/generation/${image.id}/start`)
        .set(auth(token))
        .send({ styles: ['white-bg'] })
        .expect(201);
    } finally {
      credits.verificationRequired = true;
    }
  });
});
