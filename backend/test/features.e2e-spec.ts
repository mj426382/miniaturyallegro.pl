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

describe('Feedback, export, demo, subscriptions & platform presets (integration)', () => {
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
    // Spec 09, AC-PAY-023: the plan price guard reads the Stripe price (monthly PLN, amount of plans.ts).
    const amounts: Record<string, number> = { price_start_test: 1900, price_pro_test: 5900 };
    stripe.prices = {
      retrieve: async (id: string) => ({
        id,
        active: true,
        currency: 'pln',
        type: 'recurring',
        recurring: { interval: 'month', interval_count: 1 },
        unit_amount: amounts[id],
      }),
    };
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

    it('[AC-DEMO-004] still generates and e-mails the sample when the text model is unavailable', async () => {
      ctx.gemini.failDescription = true;
      try {
        const png = await makePng({ r: 4, g: 5, b: 6 }, 128);
        const res = await ctx
          .http()
          .post('/api/demo')
          .field('email', 'fallback@example.com')
          .field('style', 'white-bg')
          .attach('file', png, { filename: 'p.png', contentType: 'image/png' })
          .expect(201);
        let body: any = { status: 'PENDING' };
        for (let i = 0; i < 100 && body.status !== 'COMPLETED' && body.status !== 'FAILED'; i++) {
          await new Promise((r) => setTimeout(r, 50));
          body = (await ctx.http().get(`/api/demo/${res.body.id}`).expect(200)).body;
        }
        expect(body.status).toBe('COMPLETED');
        expect(ctx.gemini.calls.description).toBe(1);
        expect(ctx.gemini.calls.image).toBe(1);
        expect(ctx.mail.sent.map((m) => m.to)).toContain('fallback@example.com');
      } finally {
        ctx.gemini.failDescription = false;
      }
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

  describe('platform presets (spec 08)', () => {
    it('[AC-PLT-001] lists the five platform presets with sources and official/recommended rules', async () => {
      const { token } = await registerUser(ctx);
      const res = await ctx
        .http()
        .get('/api/generation/platform-presets')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const presets = res.body as any[];
      expect(presets.map((p) => p.id)).toEqual(['generic', 'olx', 'vinted', 'ebay', 'amazon']);
      for (const p of presets) {
        expect(p.ratios.length).toBeGreaterThan(0);
        expect(p.defaultRatio).toBe(p.ratios[0]);
        expect(p.minSize).toBeLessThanOrEqual(p.targetSize);
        expect(p.formats.length).toBeGreaterThan(0);
        expect(p.titleMaxLength).toBeGreaterThan(0);
        expect(p.source).toBeTruthy();
        expect(p.rules.every((r: any) => typeof r.text === 'string' && typeof r.official === 'boolean')).toBe(true);
        expect(p.promptHint).toBeUndefined();
      }
      const amazon = presets.find((p) => p.id === 'amazon');
      expect(amazon).toMatchObject({ productFill: 0.85, badge: 'forbidden', minSize: 1000, minSizeOfficial: true });
      expect(amazon.rules.some((r: any) => r.official && /RGB 255/.test(r.text))).toBe(true);
      expect(presets.find((p) => p.id === 'ebay')).toMatchObject({
        minSize: 500,
        titleMaxLength: 80,
        badge: 'forbidden',
      });
      expect(JSON.stringify(presets)).not.toMatch(/allegro/i);
    });

    it('[AC-PLT-002, AC-PLT-005] exports with the preset size and names the file after the platform', async () => {
      const { token } = await registerUser(ctx);
      const { gen } = await completedGeneration(token);

      const olx = await ctx
        .http()
        .post(`/api/generation/export/${gen.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ platform: 'olx' })
        .expect(201);
      expect(olx.headers['content-type']).toContain('image/jpeg');
      expect(olx.headers['content-disposition']).toContain('grafika-white-bg-olx-4x3.jpg');
      const meta = await sharp(olx.body).metadata();
      expect([meta.width, meta.height]).toEqual([1500, 1125]);

      await ctx
        .http()
        .post(`/api/generation/export/${gen.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ platform: 'allegro' })
        .expect(400);
    });

    it('[AC-PLT-003] rejects ratios, formats and badges the preset does not allow', async () => {
      const { token } = await registerUser(ctx);
      const { gen } = await completedGeneration(token);
      const send = (body: object) =>
        ctx.http().post(`/api/generation/export/${gen.id}`).set('Authorization', `Bearer ${token}`).send(body);

      await send({ platform: 'amazon', ratio: '16:9' }).expect(400);
      await send({ platform: 'olx', format: 'webp' }).expect(400);
      const badge = await send({ platform: 'ebay', badgeText: '-20%' }).expect(400);
      expect(String(badge.body.message)).toContain('eBay');
      await send({ platform: 'olx', badgeText: '-20%' }).expect(201);
    });

    it('[AC-PLT-009] exports the original photo (EXIF orientation applied) without AI, badge or credits', async () => {
      const owner = await registerUser(ctx);
      const stranger = await registerUser(ctx);
      // A phone photo stored landscape with "rotate 90° clockwise" in EXIF: left half red, right half blue.
      const half = (r: number, b: number) =>
        sharp({ create: { width: 200, height: 200, channels: 3, background: { r, g: 0, b } } })
          .png()
          .toBuffer();
      const photo = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#000' } })
        .composite([
          { input: await half(255, 0), left: 0, top: 0 },
          { input: await half(0, 255), left: 200, top: 0 },
        ])
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer();
      const upload = await ctx
        .http()
        .post('/api/images/upload')
        .set('Authorization', `Bearer ${owner.token}`)
        .attach('file', photo, { filename: 'telefon.jpg', contentType: 'image/jpeg' })
        .expect(201);
      const before = await getCredits(ctx, owner.userId);
      const send = (token: string, body: object) =>
        ctx
          .http()
          .post(`/api/generation/export-original/${upload.body.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send(body);

      const res = await send(owner.token, {
        platform: 'vinted',
        crop: { left: 0, top: 0, width: 1, height: 0.5 },
      }).expect(201);
      expect(res.headers['content-disposition']).toContain('zdjecie-vinted-3x4.jpg');
      const meta = await sharp(res.body).metadata();
      expect([meta.width, meta.height]).toEqual([1200, 1600]);
      // Upright the photo is 200×400 with the red half on top – the crop of the top half is all red.
      const { data } = await sharp(res.body).raw().toBuffer({ resolveWithObject: true });
      const at = (400 * 1200 + 1000) * 3; // upper right area – blue if the EXIF rotation were ignored
      const corner = [data[at], data[at + 2]];
      expect(corner[0]).toBeGreaterThan(200);
      expect(corner[1]).toBeLessThan(60);

      await send(owner.token, { platform: 'vinted', badgeText: '-20%' }).expect(400);
      await send(owner.token, { platform: 'vinted', adjust: { brightness: 1.2 } }).expect(400);
      await send(owner.token, { platform: 'vinted', ratio: '16:9' }).expect(400);
      await send(stranger.token, { platform: 'vinted' }).expect(403);
      expect(await getCredits(ctx, owner.userId)).toEqual(before);
    });
  });
});
