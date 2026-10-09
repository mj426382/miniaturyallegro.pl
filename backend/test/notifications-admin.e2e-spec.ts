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
import { NotificationsService, isSendingHour, seasonCampaignKey } from '../src/notifications/notifications.service';
import { AdminGuard } from '../src/admin/admin.guard';
import { UsersService } from '../src/users/users.service';
import { getStyle } from '../src/generation/styles';
import { AdminContentService } from '../src/admin/admin-content.service';

/** Spec 16 – automatic e-mails with consent, unsubscribe, admin panel. */
describe('Notifications & admin panel (integration)', () => {
  let ctx: TestContext;
  let notifications: NotificationsService;

  // 2026-10-20 12:00 Warsaw (10:00 UTC) – sending hours, outside every season start.
  const NOON = new Date('2026-10-20T10:00:00Z');
  const DAY = 24 * 60 * 60 * 1000;

  beforeAll(async () => {
    ctx = await createTestApp();
    notifications = ctx.app.get(NotificationsService);
  });
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    ctx.mail.sent = [];
  });
  afterAll(async () => {
    await ctx.close();
  });

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function consentingUser(createdAt: Date, extra: Record<string, unknown> = {}) {
    const user = await registerUser(ctx);
    await ctx.prisma.user.update({
      where: { id: user.userId },
      data: { createdAt, marketingConsentAt: createdAt, ...extra },
    });
    return user;
  }

  describe('consent and settings', () => {
    it('[AC-NOT-001] stores consent only when ticked at sign-up; Google sign-ups have none', async () => {
      const register = (marketingConsent?: boolean) =>
        ctx
          .http()
          .post('/api/auth/register')
          .send({
            email: uniqueEmail(),
            password: STRONG_PASSWORD,
            acceptedTerms: true,
            ...(marketingConsent === undefined ? {} : { marketingConsent }),
          })
          .expect(201);
      const yes = await register(true);
      const no = await register(false);
      const omitted = await register();
      const users = await ctx.prisma.user.findMany();
      const byId = Object.fromEntries(users.map((u) => [u.id, u]));
      expect(byId[yes.body.user.id].marketingConsentAt).toBeInstanceOf(Date);
      expect(byId[no.body.user.id].marketingConsentAt).toBeNull();
      expect(byId[omitted.body.user.id].marketingConsentAt).toBeNull();
      for (const u of users) expect(u.notifyBatchDone).toBe(true);

      const { AuthService } = await import('../src/auth/auth.service');
      const service = ctx.app.get(AuthService) as any;
      service.googleClientId = 'test-client';
      service.googleClient = {
        verifyIdToken: async () => ({
          getPayload: () => ({ sub: 'g-9', email: 'g9@example.com', email_verified: true }),
        }),
      };
      await ctx.http().post('/api/auth/google').send({ googleToken: 't', acceptedTerms: true }).expect(200);
      const google = await ctx.prisma.user.findUniqueOrThrow({ where: { googleId: 'g-9' } });
      expect(google.marketingConsentAt).toBeNull();
    });

    it('[AC-NOT-002] toggles consent and batch notifications from the account settings', async () => {
      const { token, userId } = await registerUser(ctx);
      let me = await ctx.http().get('/api/users/me').set(auth(token)).expect(200);
      expect(me.body).toMatchObject({ marketingConsent: false, notifyBatchDone: true, isAdmin: false });
      expect(me.body).not.toHaveProperty('marketingConsentAt');

      await ctx
        .http()
        .patch('/api/users/me')
        .set(auth(token))
        .send({ marketingConsent: true, notifyBatchDone: false })
        .expect(200);
      me = await ctx.http().get('/api/users/me').set(auth(token)).expect(200);
      expect(me.body).toMatchObject({ marketingConsent: true, notifyBatchDone: false });
      const given = (await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } })).marketingConsentAt;
      expect(given).toBeInstanceOf(Date);

      // re-saving keeps the original consent date
      await ctx.http().patch('/api/users/me').set(auth(token)).send({ marketingConsent: true }).expect(200);
      expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } })).marketingConsentAt).toEqual(given);

      await ctx.http().patch('/api/users/me').set(auth(token)).send({ marketingConsent: false }).expect(200);
      me = await ctx.http().get('/api/users/me').set(auth(token)).expect(200);
      expect(me.body.marketingConsent).toBe(false);
      await ctx.http().patch('/api/users/me').set(auth(token)).send({ marketingConsent: 'yes' }).expect(400);
    });
  });

  describe('free-credit reminder', () => {
    it('[AC-NOT-003] goes once to eligible accounts only, during sending hours', async () => {
      const eligible = await consentingUser(new Date(NOON.getTime() - 4 * DAY));
      await consentingUser(new Date(NOON.getTime() - 1 * DAY)); // too fresh
      await consentingUser(new Date(NOON.getTime() - 40 * DAY)); // too old
      await consentingUser(new Date(NOON.getTime() - 4 * DAY), { freeCreditsUsed: 10 }); // pool used
      await consentingUser(new Date(NOON.getTime() - 4 * DAY), { emailVerifiedAt: null }); // unverified
      const noConsent = await registerUser(ctx);
      await ctx.prisma.user.update({
        where: { id: noConsent.userId },
        data: { createdAt: new Date(NOON.getTime() - 4 * DAY) },
      });
      ctx.mail.sent = [];

      // 22:00 in Warsaw – nothing goes out at night
      expect(await notifications.runReminderJob(new Date('2026-10-20T20:00:00Z'))).toEqual({ free: 0, seasonal: 0 });
      expect(isSendingHour(new Date('2026-10-20T07:00:00Z'))).toBe(true); // 9:00 CEST
      expect(isSendingHour(new Date('2026-10-20T06:59:00Z'))).toBe(false);

      expect(await notifications.runReminderJob(NOON)).toEqual({ free: 1, seasonal: 0 });
      expect(await notifications.runReminderJob(NOON)).toEqual({ free: 0, seasonal: 0 });
      expect(ctx.mail.sent).toHaveLength(1);
      const mail = ctx.mail.sent[0];
      expect(mail.to).toBe(eligible.email);
      expect(mail.subject).toContain('10 darmowych grafik');
      expect(mail.text).toContain('http://localhost:5173/upload');
      expect(mail.text).toContain('http://localhost:5173/unsubscribe?token=');
      expect(mail.headers?.['List-Unsubscribe']).toMatch(/^<.+\/api\/notifications\/unsubscribe\?token=.+>$/);
      expect(mail.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
      expect(await ctx.prisma.emailLog.count({ where: { kind: 'free-credits-reminder' } })).toBe(1);
    });

    it('[AC-NOT-003] a failed send is not recorded, so the next run retries', async () => {
      await consentingUser(new Date(NOON.getTime() - 4 * DAY));
      ctx.mail.sent = [];
      const original = ctx.mail.send.bind(ctx.mail);
      ctx.mail.send = async () => {
        throw new Error('SMTP down');
      };
      try {
        expect(await notifications.runReminderJob(NOON)).toEqual({ free: 0, seasonal: 0 });
      } finally {
        ctx.mail.send = original;
      }
      expect(await ctx.prisma.emailLog.count()).toBe(0);
      expect((await notifications.runReminderJob(NOON)).free).toBe(1);
    });
  });

  describe('seasonal campaign', () => {
    it('[AC-NOT-004] mails the season once during its first 7 days, only with consent', async () => {
      const christmas = getStyle('christmas')!; // window starts 11-10
      expect(seasonCampaignKey(christmas, new Date('2026-11-10T10:00:00Z'))).toBe('season:christmas:2026');
      expect(seasonCampaignKey(christmas, new Date('2026-11-16T10:00:00Z'))).toBe('season:christmas:2026');
      expect(seasonCampaignKey(christmas, new Date('2026-11-17T10:00:00Z'))).toBeNull();
      expect(seasonCampaignKey(getStyle('white-bg')!, new Date('2026-11-10T10:00:00Z'))).toBeNull();

      const old = new Date('2026-01-01T10:00:00Z'); // long past the free-credit reminder window
      const fan = await consentingUser(old);
      await registerUser(ctx); // no consent
      ctx.mail.sent = [];

      const inSeason = new Date('2026-11-12T11:00:00Z');
      expect(await notifications.runReminderJob(inSeason)).toEqual({ free: 0, seasonal: 1 });
      expect(await notifications.runReminderJob(inSeason)).toEqual({ free: 0, seasonal: 0 });
      expect(ctx.mail.sent).toHaveLength(1);
      expect(ctx.mail.sent[0]).toMatchObject({ to: fan.email });
      expect(ctx.mail.sent[0].subject).toContain('Boże Narodzenie');
      expect(await ctx.prisma.emailLog.findFirst({ where: { key: 'season:christmas:2026' } })).not.toBeNull();

      expect(await notifications.runReminderJob(NOON)).toEqual({ free: 0, seasonal: 0 });
    });
  });

  describe('batch finished', () => {
    async function photosWithGraphics(token: string, count: number) {
      const ids: string[] = [];
      for (let i = 0; i < count; i++) {
        const image = await uploadImage(ctx, token);
        await ctx
          .http()
          .post(`/api/generation/${image.id}/start`)
          .set(auth(token))
          .send({ styles: ['white-bg'] })
          .expect(201);
        await waitForGenerations(ctx, image.id);
        ids.push(image.id);
      }
      return ids;
    }

    it('[AC-NOT-005] mails once when every graphic of the batch is finished', async () => {
      const { token, email } = await registerUser(ctx);
      const ids = await photosWithGraphics(token, 3);
      const other = await registerUser(ctx);
      const foreign = await uploadImage(ctx, other.token);

      await ctx
        .http()
        .post('/api/notifications/batches')
        .set(auth(token))
        .send({ imageIds: ids.slice(0, 2) })
        .expect(400);
      await ctx
        .http()
        .post('/api/notifications/batches')
        .set(auth(token))
        .send({ imageIds: [...ids.slice(0, 2), foreign.id] })
        .expect(404);
      const res = await ctx
        .http()
        .post('/api/notifications/batches')
        .set(auth(token))
        .send({ imageIds: ids })
        .expect(201);

      // one graphic still running → nothing yet
      const running = await ctx.prisma.generation.create({
        data: { imageId: ids[0], style: 'gradient-bg', status: 'PROCESSING' },
      });
      ctx.mail.sent = [];
      expect(await notifications.runBatchJob(new Date())).toBe(0);
      expect(ctx.mail.sent).toHaveLength(0);

      await ctx.prisma.generation.update({ where: { id: running.id }, data: { status: 'FAILED' } });
      expect(await notifications.runBatchJob(new Date())).toBe(1);
      expect(await notifications.runBatchJob(new Date())).toBe(0);
      expect(ctx.mail.sent).toHaveLength(1);
      expect(ctx.mail.sent[0].to).toBe(email);
      expect(ctx.mail.sent[0].text).toContain('Gotowe: 3, nieudane: 1');
      expect(ctx.mail.sent[0].text).toContain('http://localhost:5173/gallery');
      expect(ctx.mail.sent[0].headers).toBeUndefined(); // transactional, no unsubscribe header
      const batch = await ctx.prisma.notificationBatch.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(batch.notifiedAt).toBeInstanceOf(Date);
      expect(batch.closedAt).toBeInstanceOf(Date);
    });

    it('[AC-NOT-005] respects the setting and expires stale batches without a mail', async () => {
      const { token, userId } = await registerUser(ctx);
      const ids = await photosWithGraphics(token, 3);
      await ctx.prisma.user.update({ where: { id: userId }, data: { notifyBatchDone: false } });
      const off = await ctx
        .http()
        .post('/api/notifications/batches')
        .set(auth(token))
        .send({ imageIds: ids })
        .expect(201);
      ctx.mail.sent = [];
      expect(await notifications.runBatchJob(new Date())).toBe(0);
      expect(
        (await ctx.prisma.notificationBatch.findUniqueOrThrow({ where: { id: off.body.id } })).closedAt,
      ).toBeInstanceOf(Date);

      await ctx.prisma.user.update({ where: { id: userId }, data: { notifyBatchDone: true } });
      const stale = await ctx
        .http()
        .post('/api/notifications/batches')
        .set(auth(token))
        .send({ imageIds: ids })
        .expect(201);
      expect(await notifications.runBatchJob(new Date(Date.now() + 25 * 60 * 60 * 1000))).toBe(0);
      const closed = await ctx.prisma.notificationBatch.findUniqueOrThrow({ where: { id: stale.body.id } });
      expect(closed.closedAt).toBeInstanceOf(Date);
      expect(closed.notifiedAt).toBeNull();
      expect(ctx.mail.sent).toHaveLength(0);
    });
  });

  describe('unsubscribe', () => {
    it('[AC-NOT-006] the one-click link withdraws consent without a session; the token is not a session', async () => {
      const user = await consentingUser(new Date(NOON.getTime() - 4 * DAY));
      const token = notifications.unsubscribeToken(user.userId);

      await ctx.http().get('/api/users/me').set(auth(token)).expect(401);
      await ctx.http().post('/api/notifications/unsubscribe?token=nonsense').expect(400);
      // a normal session JWT is not an unsubscribe token
      await ctx.http().post(`/api/notifications/unsubscribe?token=${user.token}`).expect(400);

      const res = await ctx
        .http()
        .post(`/api/notifications/unsubscribe?token=${token}`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('List-Unsubscribe=One-Click')
        .expect(200);
      expect(res.body).toEqual({ unsubscribed: true });
      expect((await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.userId } })).marketingConsentAt).toBeNull();
      ctx.mail.sent = [];
      expect((await notifications.runReminderJob(NOON)).free).toBe(0);
    });
  });

  describe('admin panel', () => {
    async function asAdmin() {
      const admin = await registerUser(ctx, uniqueEmail('owner'));
      (ctx.app.get(AdminGuard) as any).admins = new Set([admin.email]);
      (ctx.app.get(UsersService) as any).admins = new Set([admin.email]);
      return admin;
    }

    it('[AC-ADM-002] only ADMIN_EMAILS reach the panel and see isAdmin', async () => {
      const admin = await asAdmin();
      const user = await registerUser(ctx);
      for (const [method, path] of [
        ['get', '/api/admin/users'],
        ['get', `/api/admin/users/${user.userId}`],
        ['post', `/api/admin/users/${user.userId}/email`],
      ] as const) {
        await (ctx.http() as any)
          [method](path)
          .set(auth(user.token))
          .send({ subject: 'Temat', message: 'Treść wiadomości' })
          .expect(403);
      }
      expect((await ctx.http().get('/api/users/me').set(auth(admin.token)).expect(200)).body.isAdmin).toBe(true);
      expect((await ctx.http().get('/api/users/me').set(auth(user.token)).expect(200)).body.isAdmin).toBe(false);
    });

    it('[AC-ADM-003] lists accounts with usage, plan, credits, payments and consent; searches and pages', async () => {
      const admin = await asAdmin();
      const shop = await registerUser(ctx, 'sklep.kubki@example.com');
      const image = await uploadImage(ctx, shop.token);
      await ctx
        .http()
        .post(`/api/generation/${image.id}/start`)
        .set(auth(shop.token))
        .send({ styles: ['white-bg', 'dark-luxury'] })
        .expect(201);
      await waitForGenerations(ctx, image.id);
      await ctx.prisma.user.update({
        where: { id: shop.userId },
        data: { credits: 7, marketingConsentAt: new Date(), googleId: 'g-shop' },
      });
      await ctx.prisma.paymentTransaction.create({
        data: { userId: shop.userId, stripeSessionId: 'cs_1', amountPln: 2800, creditsAdded: 15, status: 'completed' },
      });
      await ctx.prisma.paymentTransaction.create({
        data: { userId: shop.userId, stripeSessionId: 'cs_2', amountPln: 1000, creditsAdded: 5, status: 'pending' },
      });
      await ctx.prisma.subscription.create({
        data: { userId: shop.userId, stripeSubscriptionId: 'sub_x', planId: 'sub_start', status: 'active' },
      });
      await registerUser(ctx, undefined, { verified: false });

      const all = await ctx.http().get('/api/admin/users').set(auth(admin.token)).expect(200);
      expect(all.body.pagination).toMatchObject({ page: 1, total: 3 });
      expect(all.body.users[0].createdAt >= all.body.users[1].createdAt).toBe(true);
      const row = all.body.users.find((u: any) => u.id === shop.userId);
      expect(row).toMatchObject({
        email: 'sklep.kubki@example.com',
        emailVerified: true,
        provider: 'google+password',
        images: 1,
        completedGenerations: 2,
        failedGenerations: 0,
        credits: 7,
        freeCreditsLeft: 8,
        plan: { planId: 'sub_start', status: 'active' },
        paidTotalGrosze: 2800,
        marketingConsent: true,
      });
      expect(row.lastActivityAt).toBeTruthy();
      expect(row).not.toHaveProperty('password');
      expect(all.body.users.some((u: any) => u.emailVerified === false)).toBe(true);

      const found = await ctx.http().get('/api/admin/users?search=KUBKI').set(auth(admin.token)).expect(200);
      expect(found.body.users.map((u: any) => u.id)).toEqual([shop.userId]);
      const paged = await ctx.http().get('/api/admin/users?page=2&limit=2').set(auth(admin.token)).expect(200);
      expect(paged.body.users).toHaveLength(1);
      expect(paged.body.pagination).toMatchObject({ page: 2, limit: 2, total: 3, pages: 2 });
    });

    it('[AC-ADM-004, AC-ADM-005] shows payments and mail history and sends a safe individual message', async () => {
      const admin = await asAdmin();
      const user = await registerUser(ctx);
      await ctx.prisma.user.update({ where: { id: user.userId }, data: { name: 'Ania' } });
      await ctx.prisma.paymentTransaction.create({
        data: {
          userId: user.userId,
          stripeSessionId: 'cs_9',
          amountPln: 1000,
          creditsAdded: 5,
          status: 'completed',
          stripeInvoiceId: 'in_1',
        },
      });
      ctx.mail.sent = [];

      await ctx
        .http()
        .post(`/api/admin/users/${user.userId}/email`)
        .set(auth(admin.token))
        .send({ subject: 'Hi', message: 'Treść wiadomości' })
        .expect(400);
      await ctx
        .http()
        .post(`/api/admin/users/${user.userId}/email`)
        .set(auth(admin.token))
        .send({ subject: 'Pytanie o grafiki', message: 'za krótko' })
        .expect(400);
      await ctx.http().get('/api/admin/users/nope').set(auth(admin.token)).expect(404);

      const message = 'Dzień dobry,\nwidzimy, że <b>grafiki</b> nie powstały.\n\nCzy możemy pomóc?';
      const sent = await ctx
        .http()
        .post(`/api/admin/users/${user.userId}/email`)
        .set(auth(admin.token))
        .send({ subject: 'Pytanie o grafiki', message })
        .expect(201);
      expect(sent.body).toMatchObject({ kind: 'admin', subject: 'Pytanie o grafiki', sentBy: admin.email });

      expect(ctx.mail.sent).toHaveLength(1);
      const mail = ctx.mail.sent[0];
      expect(mail).toMatchObject({ to: user.email, subject: 'Pytanie o grafiki' });
      // Replies go to kontakt@ (MailService default, AC-ADM-013), never to the admin's own address.
      expect(mail.replyTo).toBeUndefined();
      expect(mail.html).toContain('Cześć Ania,');
      expect(mail.html).toContain('&lt;b&gt;grafiki&lt;/b&gt;');
      expect(mail.html).not.toContain('<b>grafiki</b>');
      expect(mail.html).toContain('Dzień dobry,<br>widzimy');

      const detail = await ctx.http().get(`/api/admin/users/${user.userId}`).set(auth(admin.token)).expect(200);
      expect(detail.body.payments).toEqual([expect.objectContaining({ amountPln: 1000, hasInvoice: true })]);
      expect(detail.body.payments[0]).not.toHaveProperty('stripeInvoiceId');
      expect(detail.body.emails[0]).toMatchObject({
        kind: 'admin',
        subject: 'Pytanie o grafiki',
        body: message.trim(),
      });
      expect(detail.body.subscription).toBeNull();
    });
    async function userWithGraphics(email?: string) {
      const user = await registerUser(ctx, email);
      const image = await uploadImage(ctx, user.token);
      await ctx
        .http()
        .post(`/api/generation/${image.id}/start`)
        .set(auth(user.token))
        .send({ styles: ['white-bg', 'dark-luxury'] })
        .expect(201);
      const generations = await waitForGenerations(ctx, image.id);
      return { ...user, imageId: image.id, generations };
    }

    it('[AC-ADM-007] shows the photos of a user with every graphic and logs the view', async () => {
      const admin = await asAdmin();
      const shop = await userWithGraphics();
      const [first] = shop.generations;
      await ctx.prisma.generation.update({ where: { id: first.id }, data: { rating: -1, ratingReason: 'artifacts' } });
      await ctx.prisma.offerDescription.create({
        data: { imageId: shop.imageId, title: 'Kubek 350 ml', body: '<p>Opis kubka testowego.</p>' },
      });
      const logSpy = jest.spyOn((ctx.app.get(AdminContentService) as any).logger, 'log');

      await ctx.http().get(`/api/admin/users/${shop.userId}/images`).set(auth(shop.token)).expect(403);
      await ctx.http().get('/api/admin/users/nope/images').set(auth(admin.token)).expect(404);
      const res = await ctx.http().get(`/api/admin/users/${shop.userId}/images`).set(auth(admin.token)).expect(200);

      expect(res.body.pagination).toMatchObject({ page: 1, total: 1 });
      const [image] = res.body.images;
      expect(image).toMatchObject({ id: shop.imageId, descriptionTitle: 'Kubek 350 ml' });
      expect(image.originalUrl).toMatch(/^http:\/\/localhost:3000\/api\/uploads\/|^\/api\/uploads\//);
      expect(image.generations).toHaveLength(2);
      expect(image.generations.find((g: any) => g.id === first.id)).toMatchObject({
        status: 'COMPLETED',
        rating: -1,
        ratingReason: 'artifacts',
      });
      expect(image.generations[0].url).toBeTruthy();
      expect(image).not.toHaveProperty('description');
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Admin ${admin.email} viewed images of user ${shop.userId}`),
      );
      logSpy.mockRestore();
    });

    it('[AC-ADM-008] lists the latest graphics of all users with status and rating filters', async () => {
      const admin = await asAdmin();
      const a = await userWithGraphics('a.shop@example.com');
      const b = await userWithGraphics('b.shop@example.com');
      await ctx.prisma.generation.update({
        where: { id: a.generations[0].id },
        data: { rating: -1, ratingReason: 'product-changed' },
      });
      await ctx.prisma.generation.update({ where: { id: b.generations[1].id }, data: { rating: 1 } });
      await ctx.prisma.generation.create({ data: { imageId: b.imageId, style: 'gradient-bg', status: 'FAILED' } });

      const all = await ctx.http().get('/api/admin/generations').set(auth(admin.token)).expect(200);
      expect(all.body.pagination.total).toBe(5);
      expect(all.body.generations[0].status).toBe('FAILED'); // newest first
      for (const g of all.body.generations) {
        expect(g.user.email).toMatch(/@example\.com$/);
        expect(g.image.originalUrl).toBeTruthy();
      }

      const down = await ctx.http().get('/api/admin/generations?rating=down').set(auth(admin.token)).expect(200);
      expect(down.body.generations).toEqual([
        expect.objectContaining({
          id: a.generations[0].id,
          rating: -1,
          ratingReason: 'product-changed',
          user: { id: a.userId, email: 'a.shop@example.com' },
        }),
      ]);
      const rated = await ctx.http().get('/api/admin/generations?rating=rated').set(auth(admin.token)).expect(200);
      expect(rated.body.pagination.total).toBe(2);
      const failed = await ctx.http().get('/api/admin/generations?status=FAILED').set(auth(admin.token)).expect(200);
      expect(failed.body.generations.map((g: any) => g.url)).toEqual([null]);
      const paged = await ctx.http().get('/api/admin/generations?limit=2&page=3').set(auth(admin.token)).expect(200);
      expect(paged.body.generations).toHaveLength(1);
      expect(paged.body.pagination).toMatchObject({ page: 3, pages: 3 });

      await ctx.http().get('/api/admin/generations?rating=meh').set(auth(admin.token)).expect(400);
      await ctx.http().get('/api/admin/generations?status=DONE').set(auth(admin.token)).expect(400);
      await ctx.http().get('/api/admin/generations').set(auth(a.token)).expect(403);
    });
  });
});
