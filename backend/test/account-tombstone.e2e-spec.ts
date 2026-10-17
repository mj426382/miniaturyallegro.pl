import { createHash } from 'crypto';
import {
  createTestApp,
  registerUser,
  resetDatabase,
  STRONG_PASSWORD,
  TestContext,
  uploadImage,
  waitForGenerations,
} from './test-app';
import { AuthService } from '../src/auth/auth.service';
import { AccountTombstoneService } from '../src/users/account-tombstone.service';
import { REFERRAL_GRANTED_BY } from '../src/referrals/referrals.service';

/**
 * Spec 03 "Ślad usuniętego konta" + spec 20: deleting an account and signing up again must not give a
 * second free pool or a second referral bonus – while only a keyed hash of the mailbox is kept.
 */
describe('account tombstone (spec 03 / 20)', () => {
  let ctx: TestContext;
  let tombstones: AccountTombstoneService;
  const googlePayloads: any[] = [];
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  /** FREE_CREDITS_LIMIT in test/setup-env.ts. */
  const FULL_POOL = 10;

  beforeAll(async () => {
    ctx = await createTestApp();
    tombstones = ctx.app.get(AccountTombstoneService);
    const service = ctx.app.get(AuthService) as any;
    service.googleClientId = 'test-client';
    service.googleClient = { verifyIdToken: async () => ({ getPayload: () => googlePayloads.shift() }) };
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    ctx.mail.sent = [];
    googlePayloads.length = 0;
  });

  async function signUp(email: string, referralCode?: string) {
    const res = await ctx
      .http()
      .post('/api/auth/register')
      .send({ email, password: STRONG_PASSWORD, acceptedTerms: true, ...(referralCode ? { referralCode } : {}) })
      .expect(201);
    return {
      userId: res.body.user.id as string,
      token: res.body.token as string,
      email: res.body.user.email as string,
    };
  }

  async function deleteAccount(token: string, email: string) {
    await ctx.http().delete('/api/users/me').set(auth(token)).send({ confirmEmail: email }).expect(200);
  }

  async function googleSignUp(sub: string, email: string, referralCode?: string) {
    googlePayloads.push({ sub, email, email_verified: true, given_name: 'Jan' });
    const res = await ctx
      .http()
      .post('/api/auth/google')
      .send({ googleToken: 't', acceptedTerms: true, ...(referralCode ? { referralCode } : {}) })
      .expect(200);
    return {
      userId: res.body.user.id as string,
      token: res.body.token as string,
      email: res.body.user.email as string,
    };
  }

  async function pool(token: string) {
    const me = await ctx.http().get('/api/users/me').set(auth(token)).expect(200);
    return me.body.freeCreditsLimit as number;
  }

  function lastMailTo(email: string) {
    return [...ctx.mail.sent].reverse().find((m) => m.to === email)!;
  }

  function verificationToken(email: string) {
    return lastMailTo(email).text.match(/verify-email\?token=([A-Za-z0-9_-]+)/)![1];
  }

  /** Every text-like column of every table in the schema that contains `needle` (case-insensitive). */
  async function findInDatabase(needle: string): Promise<string[]> {
    const columns = await ctx.prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type IN ('text', 'character varying', 'ARRAY', 'jsonb', 'json')`;
    const hits: string[] = [];
    for (const { table_name, column_name } of columns) {
      const rows = await ctx.prisma.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM "${table_name}" WHERE "${column_name}"::text ILIKE $1`,
        `%${needle}%`,
      );
      if (Number(rows[0].n) > 0) hits.push(`${table_name}.${column_name}`);
    }
    return hits;
  }

  it('[AC-AUTH-029] keeps only an HMAC of the canonical address and the date – the address is gone from every table', async () => {
    // A well-used account: alias address, photos, graphics, a referral relation, a landing demo.
    const referrer = await registerUser(ctx, 'polecajacy-tomb@example.com');
    const code = (await ctx.http().get('/api/users/me/referral').set(auth(referrer.token)).expect(200)).body.code;
    const user = await signUp('Tomasz.Grobowy+sklep@GoogleMail.com', code);
    await ctx.prisma.user.update({ where: { id: user.userId }, data: { emailVerifiedAt: new Date() } });
    const image = await uploadImage(ctx, user.token);
    await ctx.http().post(`/api/generation/${image.id}/start`).set(auth(user.token)).send({}).expect(201);
    await waitForGenerations(ctx, image.id);
    await ctx.prisma.demoRequest.create({
      data: {
        email: 'tomasz.grobowy@gmail.com',
        emailCanonical: 'tomaszgrobowy@gmail.com',
        ipHash: 'h',
        imageKey: 'demo/x.png',
      },
    });
    const deletedAt = Date.now();
    // The scanner does find the address while the account exists (users, demo_requests).
    expect(await findInDatabase('tomasz.grobowy')).toEqual(
      expect.arrayContaining(['users.email', 'demo_requests.email']),
    );

    await deleteAccount(user.token, user.email);

    const rows = await ctx.prisma.accountTombstone.findMany();
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(['deletedAt', 'emailHash', 'id']);
    expect(rows[0].emailHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].emailHash).toBe(tombstones.hashEmail('tomaszgrobowy@gmail.com'));
    expect(Math.abs(rows[0].deletedAt.getTime() - deletedAt)).toBeLessThan(10_000);
    // Keyed: a plain SHA-256 of the address (rainbow-table-able) is not what we store.
    for (const plain of ['tomaszgrobowy@gmail.com', 'tomasz.grobowy+sklep@googlemail.com']) {
      expect(rows[0].emailHash).not.toBe(createHash('sha256').update(plain).digest('hex'));
    }

    // No trace of the address (exact, lower-case, canonical, local parts) anywhere in the database.
    for (const needle of ['tomasz.grobowy', 'tomaszgrobowy', 'grobowy+sklep', 'googlemail']) {
      expect(await findInDatabase(needle)).toEqual([]);
    }
    // The referrer's account is untouched.
    expect(await ctx.prisma.user.count({ where: { id: referrer.userId } })).toBe(1);

    // Deleting the same mailbox again refreshes the one row instead of adding another.
    const again = await signUp('tomaszgrobowy@gmail.com');
    await deleteAccount(again.token, again.email);
    expect(await ctx.prisma.accountTombstone.count()).toBe(1);
  });

  it('[AC-AUTH-030] a re-registration of the mailbox (any variant) gets no free pool; other addresses keep it', async () => {
    const original = await signUp('jan.tombowski@gmail.com');
    expect(await pool(original.token)).toBe(FULL_POOL);
    expect(lastMailTo(original.email).text).toMatch(/odblokować 10 darmowych grafik/);
    await deleteAccount(original.token, original.email);

    const variants = [
      'jan.tombowski@gmail.com',
      '  JAN.TOMBOWSKI@gmail.com  ',
      'j.a.n.t.o.m.b.o.w.s.k.i@gmail.com',
      'jantombowski+sklep@gmail.com',
      'Jan.Tombowski+promo@GoogleMail.com',
    ];
    for (const variant of variants) {
      const again = await signUp(variant);
      expect(await pool(again.token)).toBe(0);
      const row = await ctx.prisma.user.findUniqueOrThrow({ where: { id: again.userId } });
      expect(row).toMatchObject({ freeCreditsLimit: 0, freeCreditsUsed: 0, credits: 0, referredById: null });
      // The verification mail does not promise free graphics this account will not get.
      const mail = lastMailTo(again.email);
      expect(mail.text).toMatch(/verify-email\?token=/);
      expect(mail.text).not.toMatch(/darmow/i);
      await deleteAccount(again.token, again.email);
    }

    // Plus-aliases count everywhere (spec 13), not only at Gmail.
    const shop = await signUp('anna@firma-tomb.pl');
    await deleteAccount(shop.token, shop.email);
    expect(await pool((await signUp('Anna+oferta@Firma-Tomb.pl')).token)).toBe(0);

    // Another mailbox is unaffected – also one that differs only where Gmail does not ignore it.
    expect(await pool((await signUp('jan.tombowski@firma-tomb.pl')).token)).toBe(FULL_POOL);
    expect(await pool((await signUp('jan.tombowski2@gmail.com')).token)).toBe(FULL_POOL);
  });

  it('[AC-AUTH-031] a Google sign-up of the deleted mailbox gets no free pool', async () => {
    const original = await googleSignUp('g-tomb-1', 'ewa.grob@gmail.com');
    expect(await pool(original.token)).toBe(FULL_POOL);
    await deleteAccount(original.token, original.email);

    const again = await googleSignUp('g-tomb-1', 'Ewa.Grob@gmail.com');
    expect(await pool(again.token)).toBe(0);
    await deleteAccount(again.token, again.email);

    // E-mail sign-up after a deleted Google account and vice versa are the same mailbox.
    const byMail = await signUp('ewagrob+x@gmail.com');
    expect(await pool(byMail.token)).toBe(0);
  });

  it('[AC-AUTH-032] tombstones expire after the retention period (time travel) and are purged', async () => {
    const old = await signUp('stary.tomb@example.com');
    await deleteAccount(old.token, old.email);
    const recent = await signUp('nowy.tomb@example.com');
    await deleteAccount(recent.token, recent.email);
    // The first one was deleted 13 months ago, the second 11 months ago.
    const now = new Date();
    const monthsAgo = (m: number) => {
      const d = new Date(now);
      d.setUTCMonth(d.getUTCMonth() - m);
      return d;
    };
    await ctx.prisma.accountTombstone.update({
      where: { emailHash: tombstones.hashEmail('stary.tomb@example.com') },
      data: { deletedAt: monthsAgo(13) },
    });
    await ctx.prisma.accountTombstone.update({
      where: { emailHash: tombstones.hashEmail('nowy.tomb@example.com') },
      data: { deletedAt: monthsAgo(11) },
    });
    expect(tombstones.retentionMonths).toBe(12);

    // An expired tombstone no longer counts even before the job removes it…
    expect(await tombstones.isTombstoned('stary.tomb@example.com', now)).toBe(false);
    expect(await tombstones.isTombstoned('nowy.tomb@example.com', now)).toBe(true);
    // …and the young one expires when the clock moves past 12 months.
    const in2Months = new Date(now.getTime());
    in2Months.setUTCMonth(in2Months.getUTCMonth() + 2);
    expect(await tombstones.isTombstoned('nowy.tomb@example.com', in2Months)).toBe(false);

    // The purge job removes exactly the expired row.
    expect(await tombstones.purgeExpired(now)).toBe(1);
    expect(await ctx.prisma.accountTombstone.count()).toBe(1);
    expect(await tombstones.purgeExpired(now)).toBe(0);

    expect(await pool((await signUp('stary.tomb@example.com')).token)).toBe(FULL_POOL);
    expect(await pool((await signUp('nowy.tomb@example.com')).token)).toBe(0);

    // Time travel: a year later the remaining row goes too.
    expect(await tombstones.purgeExpired(in2Months)).toBe(1);
    expect(await ctx.prisma.accountTombstone.count()).toBe(0);
  });

  it('[AC-REF-007] neither side is rewarded again when the referred mailbox signs up after deletion (e-mail and Google)', async () => {
    const referrer = await registerUser(ctx, 'polecajacy-ref7@example.com');
    const code = (await ctx.http().get('/api/users/me/referral').set(auth(referrer.token)).expect(200)).body.code;

    // First time: the normal reward on both sides.
    const first = await signUp('marek.polecony@gmail.com', code);
    await ctx
      .http()
      .post('/api/auth/verify-email')
      .send({ token: verificationToken(first.email) })
      .expect(200);
    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: referrer.userId } })).credits).toBe(3);
    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: first.userId } })).credits).toBe(3);
    await deleteAccount(first.token, first.email);
    const grantsBefore = await ctx.prisma.creditGrant.count({ where: { grantedBy: REFERRAL_GRANTED_BY } });

    // Again by e-mail (a dotted variant) with the same link, confirmed.
    const second = await signUp('m.a.r.e.k.polecony+znowu@gmail.com', code);
    await ctx
      .http()
      .post('/api/auth/verify-email')
      .send({ token: verificationToken(second.email) })
      .expect(200);
    const secondRow = await ctx.prisma.user.findUniqueOrThrow({ where: { id: second.userId } });
    expect(secondRow).toMatchObject({ referredById: null, referralRewardedAt: null, credits: 0, freeCreditsLimit: 0 });
    await deleteAccount(second.token, second.email);

    // And through Google – rewarded immediately for new accounts normally.
    const third = await googleSignUp('g-ref7', 'marekpolecony@gmail.com', code);
    const thirdRow = await ctx.prisma.user.findUniqueOrThrow({ where: { id: third.userId } });
    expect(thirdRow).toMatchObject({ referredById: null, credits: 0, freeCreditsLimit: 0 });

    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: referrer.userId } })).credits).toBe(3);
    expect(await ctx.prisma.creditGrant.count({ where: { grantedBy: REFERRAL_GRANTED_BY } })).toBe(grantsBefore);
    const summary = await ctx.http().get('/api/users/me/referral').set(auth(referrer.token)).expect(200);
    expect(summary.body).toMatchObject({ referred: 0, creditsEarned: 3 });

    // A different new mailbox with the same link is still rewarded (the programme itself works).
    const fresh = await signUp('nowy.polecony@gmail.com', code);
    await ctx
      .http()
      .post('/api/auth/verify-email')
      .send({ token: verificationToken(fresh.email) })
      .expect(200);
    expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: referrer.userId } })).credits).toBe(6);
  });
});
