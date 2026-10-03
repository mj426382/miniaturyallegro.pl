import sharp from 'sharp';
import {
  createTestApp,
  getCredits,
  registerUser,
  resetDatabase,
  TestContext,
  uploadImage,
  waitForGenerations,
} from './test-app';
import { makePng } from './fakes';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require('stripe');
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

describe('Feedback, export, demo, subscriptions & Allegro (integration)', () => {
  let ctx: TestContext;
  let stripe: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    stripe = new Stripe('sk_test_fake_key_for_tests', { apiVersion: '2026-03-25.dahlia' });
    stripe.customers = { create: async (p: any) => ({ id: 'cus_test_1', ...p }) };
    stripe.checkout = {
      sessions: { create: async (p: any) => ({ id: 'cs_sub_1', url: 'https://checkout.stripe.com/sub', ...p }) },
    };
    stripe.billingPortal = { sessions: { create: async () => ({ url: 'https://billing.stripe.com/portal' }) } };
    ctx.payments.setStripeClient(stripe);
    process.env.STRIPE_PRICE_SUB_START = 'price_start_test';
  });
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    ctx.mail.sent = [];
    ctx.gemini.calls = { description: 0, prompts: 0, image: 0, custom: 0, rework: 0, offerCopy: 0 };
  });
  afterAll(async () => {
    await ctx.close();
  });

  async function completedGeneration(token: string) {
    const image = await uploadImage(ctx, token);
    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .send({ styles: ['white-bg'] })
      .expect(201);
    const [gen] = await waitForGenerations(ctx, image.id);
    return { image, gen };
  }

  function signed(event: object) {
    const payload = JSON.stringify(event);
    return { payload, signature: stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) };
  }

  describe('feedback', () => {
    it('[AC-GEN-010] stores thumbs up/down with a reason and aggregates per style', async () => {
      const { token } = await registerUser(ctx);
      const { gen } = await completedGeneration(token);

      await ctx
        .http()
        .post(`/api/generation/feedback/${gen.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 1 })
        .expect(201);
      await ctx
        .http()
        .post(`/api/generation/feedback/${gen.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: -1, reason: 'product-changed', comment: 'logo zniknęło' })
        .expect(201);

      const row = await ctx.prisma.generation.findUniqueOrThrow({ where: { id: gen.id } });
      expect(row.rating).toBe(-1);
      expect(row.ratingReason).toBe('product-changed: logo zniknęło');

      await ctx
        .http()
        .post(`/api/generation/feedback/${gen.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 5 })
        .expect(400);
      await ctx
        .http()
        .post(`/api/generation/feedback/${gen.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: -1, reason: 'nope' })
        .expect(400);

      const other = await registerUser(ctx);
      await ctx
        .http()
        .post(`/api/generation/feedback/${gen.id}`)
        .set('Authorization', `Bearer ${other.token}`)
        .send({ rating: 1 })
        .expect(403);
    });
  });

  describe('export', () => {
    it('[AC-EXP-007, AC-PRC-005] returns a padded 4:3 image with a badge', async () => {
      const { token } = await registerUser(ctx);
      const { gen } = await completedGeneration(token);

      const res = await ctx
        .http()
        .post(`/api/generation/export/${gen.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ratio: '4:3', size: 800, format: 'png', badgeText: 'NOWOŚĆ' })
        .expect(201);
      expect(res.headers['content-type']).toContain('image/png');
      expect(res.headers['content-disposition']).toContain('grafika-white-bg-4x3.png');
      const meta = await sharp(res.body).metadata();
      expect([meta.width, meta.height]).toEqual([800, 600]);

      await ctx
        .http()
        .post(`/api/generation/export/${gen.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ratio: '9:16' })
        .expect(400);
    });

    it('[AC-EXP-008] crops to a user-chosen frame and validates the crop', async () => {
      const { token } = await registerUser(ctx);
      const { gen } = await completedGeneration(token);

      const res = await ctx
        .http()
        .post(`/api/generation/export/${gen.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ratio: '3:4', size: 800, format: 'png', crop: { left: 0.25, top: 0.1, width: 0.6, height: 0.8 } })
        .expect(201);
      const meta = await sharp(res.body).metadata();
      expect([meta.width, meta.height]).toEqual([600, 800]);

      await ctx
        .http()
        .post(`/api/generation/export/${gen.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ratio: '3:4', crop: { left: 0.7, top: 0, width: 0.6, height: 0.8 } })
        .expect(400);
      await ctx
        .http()
        .post(`/api/generation/export/${gen.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ crop: { left: 0, top: 0 } })
        .expect(400);
    });
  });

  describe('demo without an account', () => {
    it('[AC-DEMO-001] generates one sample, e-mails the result and enforces per-email and per-IP limits', async () => {
      const png = await makePng({ r: 1, g: 2, b: 3 }, 128);
      const res = await ctx
        .http()
        .post('/api/demo')
        .field('email', 'Lead@Example.com')
        .field('style', 'lifestyle-home')
        .attach('file', png, { filename: 'p.png', contentType: 'image/png' })
        .expect(201);
      expect(res.body.id).toEqual(expect.any(String));

      // poll until done
      let status = 'PENDING';
      let body: any;
      for (let i = 0; i < 100 && status !== 'COMPLETED' && status !== 'FAILED'; i++) {
        await new Promise((r) => setTimeout(r, 50));
        body = (await ctx.http().get(`/api/demo/${res.body.id}`).expect(200)).body;
        status = body.status;
      }
      expect(status).toBe('COMPLETED');
      expect(body.resultUrl).toContain('/api/uploads/demo/');
      expect(body.registerUrl).toContain('/register');
      expect(ctx.mail.sent).toHaveLength(1);
      expect(ctx.mail.sent[0].to).toBe('lead@example.com');
      expect(ctx.mail.sent[0].text).toContain(`?demo=${res.body.id}`);
      expect(ctx.gemini.calls.image).toBe(1);

      // same e-mail again -> 409
      await ctx
        .http()
        .post('/api/demo')
        .field('email', 'lead@example.com')
        .attach('file', png, { filename: 'p.png', contentType: 'image/png' })
        .expect(409);
      // second distinct e-mail from same IP ok, third -> 429
      await ctx
        .http()
        .post('/api/demo')
        .field('email', 'second@example.com')
        .attach('file', png, { filename: 'p.png', contentType: 'image/png' })
        .expect(201);
      await ctx
        .http()
        .post('/api/demo')
        .field('email', 'third@example.com')
        .attach('file', png, { filename: 'p.png', contentType: 'image/png' })
        .expect(429);
    });

    it('[AC-DEMO-002] rejects bots (honeypot), bad e-mails and non-images', async () => {
      const png = await makePng({ r: 1, g: 2, b: 3 }, 128);
      const bot = await ctx
        .http()
        .post('/api/demo')
        .field('email', 'bot@example.com')
        .field('website', 'http://spam')
        .attach('file', png, { filename: 'p.png', contentType: 'image/png' })
        .expect(201);
      expect(bot.body.id).toBe('ok');
      expect(await ctx.prisma.demoRequest.count()).toBe(0);

      await ctx
        .http()
        .post('/api/demo')
        .field('email', 'not-an-email')
        .attach('file', png, { filename: 'p.png', contentType: 'image/png' })
        .expect(400);
      await ctx
        .http()
        .post('/api/demo')
        .field('email', 'x@example.com')
        .attach('file', Buffer.from('nope'), { filename: 'p.png', contentType: 'image/png' })
        .expect(400);
      await ctx.http().get('/api/demo/does-not-exist').expect(404);
    });
  });

  describe('subscriptions', () => {
    it('[AC-PAY-007] lists plans with availability and starts a subscription checkout', async () => {
      const plans = await ctx.http().get('/api/payments/plans').expect(200);
      expect(plans.body.find((p: any) => p.id === 'sub_start').available).toBe(true);
      expect(plans.body.find((p: any) => p.id === 'sub_pro').available).toBe(false);

      const { token, userId } = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/payments/subscribe')
        .set('Authorization', `Bearer ${token}`)
        .send({ planId: 'sub_pro', acceptedWithdrawalWaiver: true })
        .expect(400);
      await ctx
        .http()
        .post('/api/payments/subscribe')
        .set('Authorization', `Bearer ${token}`)
        .send({ planId: 'sub_start' })
        .expect(400);

      const res = await ctx
        .http()
        .post('/api/payments/subscribe')
        .set('Authorization', `Bearer ${token}`)
        .send({ planId: 'sub_start', acceptedWithdrawalWaiver: true })
        .expect(201);
      expect(res.body.url).toBe('https://checkout.stripe.com/sub');
      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(user.stripeCustomerId).toBe('cus_test_1');
      expect(
        (await ctx.http().get('/api/payments/subscription').set('Authorization', `Bearer ${token}`).expect(200)).body,
      ).toEqual({ subscription: null });
    });

    it('grants credits on every paid invoice exactly once and tracks status changes', async () => {
      const { token, userId } = await registerUser(ctx);
      await ctx.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: 'cus_test_1' } });

      const checkout = signed({
        id: 'evt_s1',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_sub_1',
            mode: 'subscription',
            subscription: 'sub_123',
            customer: 'cus_test_1',
            metadata: { userId, planId: 'sub_start' },
          },
        },
      });
      await ctx
        .http()
        .post('/api/payments/webhook')
        .set('stripe-signature', checkout.signature)
        .set('Content-Type', 'application/json')
        .send(checkout.payload)
        .expect(200);

      const invoice = signed({
        id: 'evt_i1',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_001',
            customer: 'cus_test_1',
            amount_paid: 4900,
            parent: { subscription_details: { subscription: 'sub_123', metadata: { userId, planId: 'sub_start' } } },
          },
        },
      });
      await ctx
        .http()
        .post('/api/payments/webhook')
        .set('stripe-signature', invoice.signature)
        .set('Content-Type', 'application/json')
        .send(invoice.payload)
        .expect(200);
      await ctx
        .http()
        .post('/api/payments/webhook')
        .set('stripe-signature', invoice.signature)
        .set('Content-Type', 'application/json')
        .send(invoice.payload)
        .expect(200);
      expect(await getCredits(ctx, userId)).toMatchObject({ credits: 40 });

      // renewal with the legacy invoice shape (price id resolution)
      const renewal = signed({
        id: 'evt_i2',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_002',
            customer: 'cus_test_1',
            amount_paid: 4900,
            subscription: 'sub_123',
            lines: { data: [{ price: { id: 'price_start_test' } }] },
          },
        },
      });
      await ctx
        .http()
        .post('/api/payments/webhook')
        .set('stripe-signature', renewal.signature)
        .set('Content-Type', 'application/json')
        .send(renewal.payload)
        .expect(200);
      expect(await getCredits(ctx, userId)).toMatchObject({ credits: 80 });

      const sub = await ctx
        .http()
        .get('/api/payments/subscription')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(sub.body.subscription).toMatchObject({
        planId: 'sub_start',
        planName: 'Start',
        active: true,
        creditsPerMonth: 40,
      });

      // active subscription blocks a second checkout but opens the portal
      await ctx
        .http()
        .post('/api/payments/subscribe')
        .set('Authorization', `Bearer ${token}`)
        .send({ planId: 'sub_start', acceptedWithdrawalWaiver: true })
        .expect(400);
      expect(
        (await ctx.http().post('/api/payments/portal').set('Authorization', `Bearer ${token}`).expect(201)).body.url,
      ).toContain('billing.stripe.com');

      const canceled = signed({
        id: 'evt_c1',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_123',
            status: 'canceled',
            cancel_at_period_end: false,
            items: { data: [{ price: { id: 'price_start_test' }, current_period_end: 1800000000 }] },
          },
        },
      });
      await ctx
        .http()
        .post('/api/payments/webhook')
        .set('stripe-signature', canceled.signature)
        .set('Content-Type', 'application/json')
        .send(canceled.payload)
        .expect(200);
      const after = await ctx
        .http()
        .get('/api/payments/subscription')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(after.body.subscription).toMatchObject({ status: 'canceled', active: false });
      expect(new Date(after.body.subscription.currentPeriodEnd).getTime()).toBe(1800000000 * 1000);

      const history = await ctx.http().get('/api/payments/history').set('Authorization', `Bearer ${token}`).expect(200);
      expect(history.body.filter((t: any) => t.kind === 'subscription')).toHaveLength(2);
    });

    it('[AC-PAY-008] does not grant credits for proration / plan-change invoices and resolves the plan from the billed price', async () => {
      const { userId } = await registerUser(ctx);
      await ctx.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: 'cus_test_1' } });
      await ctx.prisma.subscription.create({
        data: { userId, stripeSubscriptionId: 'sub_777', planId: 'sub_start', status: 'active' },
      });
      process.env.STRIPE_PRICE_SUB_PRO = 'price_pro_test';

      // mid-cycle upgrade proration invoice → no credits
      const proration = signed({
        id: 'evt_p1',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_pro_1',
            customer: 'cus_test_1',
            amount_paid: 5000,
            billing_reason: 'subscription_update',
            subscription: 'sub_777',
            lines: { data: [{ amount: 5000, price: { id: 'price_pro_test' } }] },
          },
        },
      });
      await ctx
        .http()
        .post('/api/payments/webhook')
        .set('stripe-signature', proration.signature)
        .set('Content-Type', 'application/json')
        .send(proration.payload)
        .expect(200);
      expect(await getCredits(ctx, userId)).toMatchObject({ credits: 0 });

      // next cycle billed at the Pro price while metadata still says Start → Pro credits (150)
      const cycle = signed({
        id: 'evt_p2',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_pro_2',
            customer: 'cus_test_1',
            amount_paid: 14900,
            billing_reason: 'subscription_cycle',
            parent: { subscription_details: { subscription: 'sub_777', metadata: { userId, planId: 'sub_start' } } },
            lines: {
              data: [
                { amount: -4900, pricing: { price_details: { price: 'price_start_test' } } },
                { amount: 14900, pricing: { price_details: { price: 'price_pro_test' } } },
              ],
            },
          },
        },
      });
      await ctx
        .http()
        .post('/api/payments/webhook')
        .set('stripe-signature', cycle.signature)
        .set('Content-Type', 'application/json')
        .send(cycle.payload)
        .expect(200);
      expect(await getCredits(ctx, userId)).toMatchObject({ credits: 150 });
      expect((await ctx.prisma.subscription.findUniqueOrThrow({ where: { userId } })).planId).toBe('sub_pro');
      delete process.env.STRIPE_PRICE_SUB_PRO;
    });

    it('[AC-PAY-009] ignores webhooks whose livemode does not match the configured key', async () => {
      const { userId } = await registerUser(ctx);
      await ctx.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: 'cus_test_1' } });
      const live = signed({
        id: 'evt_live',
        type: 'invoice.paid',
        livemode: true,
        data: {
          object: {
            id: 'in_live_1',
            customer: 'cus_test_1',
            amount_paid: 4900,
            billing_reason: 'subscription_create',
            subscription: 'sub_live',
            lines: { data: [{ amount: 4900, price: { id: 'price_start_test' } }] },
          },
        },
      });
      const res = await ctx
        .http()
        .post('/api/payments/webhook')
        .set('stripe-signature', live.signature)
        .set('Content-Type', 'application/json')
        .send(live.payload)
        .expect(200);
      expect(res.body).toEqual({ received: true, ignored: 'livemode' });
      expect(await getCredits(ctx, userId)).toMatchObject({ credits: 0 });
    });

    it('[AC-PAY-010] cancels an active Stripe subscription when the account is deleted', async () => {
      const cancelled: string[] = [];
      stripe.subscriptions = {
        cancel: async (id: string) => {
          cancelled.push(id);
          return { id, status: 'canceled' };
        },
      };
      const { token, userId, email } = await registerUser(ctx);
      await ctx.prisma.subscription.create({
        data: { userId, stripeSubscriptionId: 'sub_del_1', planId: 'sub_start', status: 'active' },
      });

      await ctx
        .http()
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ confirmEmail: email })
        .expect(200);
      expect(cancelled).toEqual(['sub_del_1']);
      expect(await ctx.prisma.subscription.count()).toBe(0);
    });
  });

  describe('ownership on file endpoints', () => {
    it('[AC-SEC-002] refuses download and export of another user’s graphic', async () => {
      const owner = await registerUser(ctx);
      const other = await registerUser(ctx);
      const { gen } = await completedGeneration(owner.token);
      await ctx
        .http()
        .get(`/api/generation/download/${gen.id}`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(403);
      await ctx
        .http()
        .post(`/api/generation/export/${gen.id}`)
        .set('Authorization', `Bearer ${other.token}`)
        .send({ ratio: '1:1' })
        .expect(403);
      await ctx
        .http()
        .post(`/api/generation/retry/${gen.id}`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(403);
    });
  });

  describe('demo retention', () => {
    it('[AC-DEMO-003] deletes demo requests and files older than 30 days', async () => {
      const { DemoService } = await import('../src/demo/demo.service');
      const service = ctx.app.get(DemoService);
      const fresh = await ctx.prisma.demoRequest.create({
        data: { email: 'a@x.pl', ipHash: 'h', imageKey: 'demo/fresh.jpg', status: 'COMPLETED' },
      });
      const old = await ctx.prisma.demoRequest.create({
        data: {
          email: 'b@x.pl',
          ipHash: 'h',
          imageKey: 'demo/old.jpg',
          resultKey: 'demo/old-result.png',
          status: 'COMPLETED',
        },
      });
      await ctx.prisma
        .$executeRaw`UPDATE "demo_requests" SET "createdAt" = NOW() - INTERVAL '31 days' WHERE "id" = ${old.id}`;

      expect(await service.cleanupExpired()).toBe(1);
      expect(await ctx.prisma.demoRequest.findUnique({ where: { id: old.id } })).toBeNull();
      expect(await ctx.prisma.demoRequest.findUnique({ where: { id: fresh.id } })).not.toBeNull();
    });
  });

  describe('Allegro integration', () => {
    it('[AC-ALG-001] reports not configured without client credentials', async () => {
      const { token } = await registerUser(ctx);
      const status = await ctx.http().get('/api/allegro/status').set('Authorization', `Bearer ${token}`).expect(200);
      expect(status.body).toMatchObject({ configured: false, connected: false });
      await ctx.http().get('/api/allegro/auth-url').set('Authorization', `Bearer ${token}`).expect(503);
    });

    it('[AC-ALG-002] connects, lists offers, imports a photo and publishes a graphic (mocked Allegro API)', async () => {
      const { AllegroService } = await import('../src/allegro/allegro.service');
      const allegro = ctx.app.get(AllegroService);
      (allegro as any).clientId = 'client';
      (allegro as any).clientSecret = 'secret';

      const calls: Array<{ method: string; url: string; body?: any }> = [];
      const offerPng = await makePng({ r: 9, g: 9, b: 9 }, 128);
      const http: any = {
        post: async (url: string, body: any) => {
          calls.push({ method: 'post', url, body });
          if (url.includes('/auth/oauth/token'))
            return { data: { access_token: 'acc', refresh_token: 'ref', expires_in: 3600 } };
          if (url.includes('/sale/images'))
            return { data: { location: 'https://a.allegroimg.com/original/new-image' } };
          throw new Error('unexpected post ' + url);
        },
        get: async (url: string) => {
          calls.push({ method: 'get', url });
          if (url.endsWith('/me')) return { data: { login: 'seller-1' } };
          if (url.includes('/sale/offers'))
            return {
              data: {
                offers: [
                  {
                    id: '123',
                    name: 'Kubek',
                    primaryImage: { url: 'https://a.allegroimg.com/original/1.png' },
                    publication: { status: 'ACTIVE' },
                    sellingMode: { price: { amount: '29.99', currency: 'PLN' } },
                  },
                ],
                totalCount: 1,
              },
            };
          if (url.includes('/sale/product-offers/123'))
            return { data: { id: '123', name: 'Kubek', images: ['https://a.allegroimg.com/original/1.png'] } };
          if (url === 'https://a.allegroimg.com/original/1.png') return { data: offerPng };
          throw new Error('unexpected get ' + url);
        },
        patch: async (url: string, body: any) => {
          calls.push({ method: 'patch', url, body });
          return { data: {} };
        },
      };
      allegro.setHttpClient(http);

      const { token, userId } = await registerUser(ctx);
      const authUrl = (
        await ctx.http().get('/api/allegro/auth-url').set('Authorization', `Bearer ${token}`).expect(200)
      ).body.url;
      expect(authUrl).toContain('https://allegro.pl/auth/oauth/authorize?');
      const state = new URL(authUrl).searchParams.get('state')!;

      // the state token is a JWT signed with our secret – it must NOT be usable as an API bearer token
      await ctx.http().get('/api/users/me').set('Authorization', `Bearer ${state}`).expect(401);
      await ctx
        .http()
        .post('/api/allegro/callback')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'c', state: 'bogus' })
        .expect(401);
      const cb = await ctx
        .http()
        .post('/api/allegro/callback')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'c', state })
        .expect(201);
      expect(cb.body).toEqual({ connected: true, sellerLogin: 'seller-1' });
      const conn = await ctx.prisma.allegroConnection.findUniqueOrThrow({ where: { userId } });
      expect(conn.accessTokenEncrypted).not.toContain('acc');

      const offers = await ctx
        .http()
        .get('/api/allegro/offers?limit=5')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(offers.body).toEqual({
        offers: [
          {
            id: '123',
            name: 'Kubek',
            primaryImage: 'https://a.allegroimg.com/original/1.png',
            status: 'ACTIVE',
            price: '29.99 PLN',
          },
        ],
        total: 1,
      });

      const imported = await ctx
        .http()
        .post('/api/allegro/offers/123/import')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      const image = await ctx.prisma.image.findUniqueOrThrow({ where: { id: imported.body.id } });
      expect(image.allegroOfferId).toBe('123');

      await ctx
        .http()
        .post(`/api/generation/${image.id}/start`)
        .set('Authorization', `Bearer ${token}`)
        .send({ styles: ['white-bg'] })
        .expect(201);
      const [gen] = await waitForGenerations(ctx, image.id);

      // Local storage URLs are not public -> publishing must refuse cleanly.
      await ctx
        .http()
        .post('/api/allegro/offers/123/publish')
        .set('Authorization', `Bearer ${token}`)
        .send({ generationId: gen.id })
        .expect(400);

      // Simulate public storage by stubbing the signed URL.
      const storage = (allegro as any).storage;
      const original = storage.getSignedUrl.bind(storage);
      storage.getSignedUrl = (key: string) => `https://files.example.com/${key}`;
      try {
        const pub = await ctx
          .http()
          .post('/api/allegro/offers/123/publish')
          .set('Authorization', `Bearer ${token}`)
          .send({ generationId: gen.id, position: 'first' })
          .expect(201);
        expect(pub.body).toEqual({ offerId: '123', imagesCount: 2, position: 'first' });
        const patch = calls.find((c) => c.method === 'patch')!;
        expect(patch.body.images).toEqual([
          'https://a.allegroimg.com/original/new-image',
          'https://a.allegroimg.com/original/1.png',
        ]);
      } finally {
        storage.getSignedUrl = original;
      }

      await ctx.http().delete('/api/allegro/connection').set('Authorization', `Bearer ${token}`).expect(200);
      expect(await ctx.prisma.allegroConnection.count()).toBe(0);
      (allegro as any).clientId = undefined;
      (allegro as any).clientSecret = undefined;
    });
  });
});
