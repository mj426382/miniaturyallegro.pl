import { createTestApp, getCredits, registerUser, resetDatabase, TestContext, uniqueEmail } from './test-app';
import {
  completedEvent,
  deliver,
  discountedCompletedEvent,
  disputeEvent,
  FakeStripe,
  refundEvent,
} from './stripe-fake';
import { expectBalanceMatchesLedger } from './ledger';
import { AdminGuard } from '../src/admin/admin.guard';

const PRICES: Record<string, number> = { credits_5: 1000, credits_15: 2800, credits_40: 7000, credits_200: 9900 };

/**
 * Discount codes (spec 09 AC-PAY-026..030, spec 16 AC-ADM-016..019): Stripe promotion codes on pack checkout,
 * what was really paid on the transaction, refunds and revenue against the paid amount, and the admin panel that
 * creates, lists and deactivates codes. Real database, signed webhooks, fake Stripe.
 */
describe('discount codes (integration)', () => {
  let ctx: TestContext;
  const stripe = new FakeStripe();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ctx = await createTestApp();
    ctx.payments.setStripeClient(stripe.client());
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await ctx.prisma.$executeRawUnsafe('TRUNCATE TABLE "stripe_events"');
    stripe.reset();
    (ctx.app.get(AdminGuard) as any).admins = new Set();
  });

  /** Starts a checkout of a pack through the API; returns the fake Stripe session and its PaymentIntent. */
  async function checkout(packageId = 'credits_15', user?: { token: string; userId: string; email: string }) {
    const buyer = user ?? (await registerUser(ctx));
    await ctx
      .http()
      .post('/api/payments/checkout')
      .set(auth(buyer.token))
      .send({ packageId, acceptedWithdrawalWaiver: true })
      .expect(201);
    const session = stripe.sessions.at(-1);
    const pi = `pi_${session.id}`;
    stripe.sessionPaymentIntents.set(session.id, pi);
    return { ...buyer, session, pi, packageId };
  }

  const txOf = (sessionId: string) =>
    ctx.prisma.paymentTransaction.findUniqueOrThrow({ where: { stripeSessionId: sessionId } });

  /** Buys a pack paying `paid` grosze with the code (registered in the fake Stripe as an id-only reference). */
  async function buyWithCode(packageId: string, paid: number, code = 'PARTNER-10') {
    const order = await checkout(packageId);
    const promo = stripe.addPromotionCode(code);
    const event = discountedCompletedEvent(
      order.session.id,
      paid === 0 ? null : order.pi,
      { list: PRICES[packageId], paid },
      promo.id,
    );
    await deliver(ctx, stripe, event).expect(200);
    return { ...order, event };
  }

  async function makeAdmin() {
    const admin = await registerUser(ctx, uniqueEmail('owner'));
    (ctx.app.get(AdminGuard) as any).admins = new Set([admin.email]);
    return admin;
  }

  // ─── Checkout and fulfilment (spec 09) ────────────────────────────

  describe('checkout and fulfilment', () => {
    it('[AC-PAY-026] regular packs accept promotion codes, the welcome pack does not, subscriptions still do', async () => {
      const user = await registerUser(ctx);
      const welcome = await checkout('welcome_5', user);
      expect(welcome.session).not.toHaveProperty('allow_promotion_codes');
      expect(welcome.session.line_items[0].price_data.unit_amount).toBe(500);

      for (const packageId of ['credits_5', 'credits_15', 'credits_40', 'credits_200']) {
        const { session } = await checkout(packageId, user);
        expect(session).toMatchObject({ mode: 'payment', allow_promotion_codes: true });
        expect(session.line_items[0].price_data.unit_amount).toBe(PRICES[packageId]);
      }

      process.env.STRIPE_PRICE_SUB_START = 'price_start_discounts';
      stripe.monthlyPrice('price_start_discounts', 1900);
      try {
        await ctx
          .http()
          .post('/api/payments/subscribe')
          .set(auth(user.token))
          .send({ planId: 'sub_start', acceptedWithdrawalWaiver: true })
          .expect(201);
        expect(stripe.sessions.at(-1)).toMatchObject({ mode: 'subscription', allow_promotion_codes: true });
      } finally {
        delete process.env.STRIPE_PRICE_SUB_START;
      }
    });

    it('[AC-PAY-027] a percent code: the paid amount, discount and code are stored, full credits are added once', async () => {
      // 15 credits for 28 zł with 10% off → 25,20 zł; the code is an id the service looks up in Stripe
      const order = await checkout('credits_15');
      const promo = stripe.addPromotionCode('partner-10');
      const event = discountedCompletedEvent(order.session.id, order.pi, { list: 2800, paid: 2520 }, promo.id);
      await deliver(ctx, stripe, event).expect(200);

      expect(await txOf(order.session.id)).toMatchObject({
        status: 'completed',
        amountPln: 2520,
        amountDiscount: 280,
        promotionCode: 'PARTNER-10',
        creditsAdded: 15,
        creditsReversed: 0,
        stripePaymentIntentId: order.pi,
        completedAt: expect.any(Date),
      });
      expect((await getCredits(ctx, order.userId)).credits).toBe(15);
      expect(stripe.promotionCalls.retrieve).toBe(1);

      // Stripe retries the same event, also in parallel – nothing changes
      await deliver(ctx, stripe, event).expect(200);
      await Promise.all(Array.from({ length: 5 }, () => deliver(ctx, stripe, event).expect(200)));
      expect((await getCredits(ctx, order.userId)).credits).toBe(15);
      expect(await txOf(order.session.id)).toMatchObject({ amountPln: 2520, amountDiscount: 280 });

      const history = await ctx.http().get('/api/payments/history').set(auth(order.token)).expect(200);
      expect(history.body).toEqual([
        expect.objectContaining({ amountPln: 2520, creditsAdded: 15, status: 'completed' }),
      ]);
      await expectBalanceMatchesLedger(ctx, order.userId);
    });

    it('[AC-PAY-027] a fixed-amount code with the promotion code already expanded needs no extra Stripe call', async () => {
      // 40 credits for 70 zł minus 15 zł
      const order = await checkout('credits_40');
      const event = discountedCompletedEvent(
        order.session.id,
        order.pi,
        { list: 7000, paid: 5500 },
        { id: 'promo_expanded', code: 'KATALOG-15ZL' },
      );
      await deliver(ctx, stripe, event).expect(200);

      expect(await txOf(order.session.id)).toMatchObject({
        status: 'completed',
        amountPln: 5500,
        amountDiscount: 1500,
        promotionCode: 'KATALOG-15ZL',
        creditsAdded: 40,
      });
      expect((await getCredits(ctx, order.userId)).credits).toBe(40);
      expect(stripe.promotionCalls.retrieve).toBe(0);
      expect(stripe.calls.sessionRetrieve).toBe(0);
    });

    it('[AC-PAY-027] without `discounts` in the event the code is read from the session retrieved with the codes expanded', async () => {
      const order = await checkout('credits_15');
      // what Stripe returns for retrieve(..., { expand: ['discounts.promotion_code'] })
      order.session.discounts = [{ coupon: 'co_x', promotion_code: { id: 'promo_x', code: 'Czytelnik-20' } }];
      const event = completedEvent(order.session.id, order.pi, {
        currency: 'pln',
        amount_total: 2240,
        total_details: { amount_discount: 560 },
      });
      await deliver(ctx, stripe, event).expect(200);

      expect(await txOf(order.session.id)).toMatchObject({
        amountPln: 2240,
        amountDiscount: 560,
        promotionCode: 'CZYTELNIK-20',
      });
      expect(stripe.retrieveParams).toEqual([{ expand: ['discounts.promotion_code'] }]);
      expect((await getCredits(ctx, order.userId)).credits).toBe(15);
    });

    it('[AC-PAY-027] a payment without a code keeps the list price, no discount and no Stripe lookups', async () => {
      const order = await checkout('credits_15');
      await deliver(
        ctx,
        stripe,
        completedEvent(order.session.id, order.pi, {
          currency: 'pln',
          amount_total: 2800,
          total_details: { amount_discount: 0 },
        }),
      ).expect(200);
      expect(await txOf(order.session.id)).toMatchObject({ amountPln: 2800, amountDiscount: 0, promotionCode: null });
      expect(stripe.calls.sessionRetrieve + stripe.promotionCalls.retrieve).toBe(0);

      // an older payload without amount_total keeps the reserved list price
      const legacy = await checkout('credits_5');
      await deliver(ctx, stripe, completedEvent(legacy.session.id, legacy.pi)).expect(200);
      expect(await txOf(legacy.session.id)).toMatchObject({ amountPln: 1000, amountDiscount: 0, promotionCode: null });
    });

    it('[AC-PAY-028] a 100% code (no_payment_required) is fulfilled exactly once like a paid order', async () => {
      const order = await checkout('credits_15');
      const promo = stripe.addPromotionCode('PARTNER-100');
      const event = discountedCompletedEvent(order.session.id, null, { list: 2800, paid: 0 }, promo.id);
      expect(event.data.object).toMatchObject({ payment_status: 'no_payment_required', amount_total: 0 });

      await deliver(ctx, stripe, event).expect(200);
      await deliver(ctx, stripe, event).expect(200);
      await Promise.all([deliver(ctx, stripe, event), deliver(ctx, stripe, event)]);

      expect(await txOf(order.session.id)).toMatchObject({
        status: 'completed',
        amountPln: 0,
        amountDiscount: 2800,
        promotionCode: 'PARTNER-100',
        creditsAdded: 15,
        stripePaymentIntentId: null,
        completedAt: expect.any(Date),
      });
      expect((await getCredits(ctx, order.userId)).credits).toBe(15);
      await expectBalanceMatchesLedger(ctx, order.userId);
    });

    it('[AC-PAY-028] a completed session that is still unpaid adds nothing', async () => {
      const order = await checkout('credits_15');
      const event = discountedCompletedEvent(order.session.id, order.pi, { list: 2800, paid: 2520 }, null, {
        payment_status: 'unpaid',
      });
      await deliver(ctx, stripe, event).expect(200);
      expect(await txOf(order.session.id)).toMatchObject({
        status: 'pending',
        completedAt: null,
        amountPln: 2800,
        amountDiscount: 0,
      });
      expect((await getCredits(ctx, order.userId)).credits).toBe(0);
    });

    it('[AC-PAY-029] when Stripe cannot tell the code the credits are still added and a later delivery fills it in', async () => {
      const order = await checkout('credits_15');
      const promo = stripe.addPromotionCode('PARTNER-10');
      stripe.promotionRetrieveError = Object.assign(new Error('Stripe is down'), { statusCode: 500 });
      const event = discountedCompletedEvent(order.session.id, order.pi, { list: 2800, paid: 2520 }, promo.id);

      await deliver(ctx, stripe, event).expect(200);
      expect(await txOf(order.session.id)).toMatchObject({
        status: 'completed',
        amountPln: 2520,
        amountDiscount: 280,
        promotionCode: null,
      });
      expect((await getCredits(ctx, order.userId)).credits).toBe(15);

      // the session lookup fails too – still no harm
      const other = await checkout('credits_5');
      stripe.sessions.splice(stripe.sessions.indexOf(other.session), 1); // Stripe answers 404
      await deliver(
        ctx,
        stripe,
        completedEvent(other.session.id, other.pi, {
          currency: 'pln',
          amount_total: 900,
          total_details: { amount_discount: 100 },
        }),
      ).expect(200);
      expect(await txOf(other.session.id)).toMatchObject({ amountPln: 900, amountDiscount: 100, promotionCode: null });
      expect((await getCredits(ctx, other.userId)).credits).toBe(5);

      // Stripe recovers and redelivers the first event: the code is stored, credits are not added again
      stripe.promotionRetrieveError = null;
      await deliver(ctx, stripe, event).expect(200);
      expect(await txOf(order.session.id)).toMatchObject({ promotionCode: 'PARTNER-10', amountPln: 2520 });
      expect((await getCredits(ctx, order.userId)).credits).toBe(15);
      await expectBalanceMatchesLedger(ctx, order.userId);
    });
  });

  // ─── Refunds and disputes after a discount (spec 09) ──────────────

  describe('refunds and disputes after a discount', () => {
    it('[AC-PAY-030] a full refund of the discounted amount takes back every credit of the pack', async () => {
      const order = await buyWithCode('credits_15', 2520);
      await deliver(ctx, stripe, refundEvent(order.pi, 2520, 2520)).expect(200);
      expect(await txOf(order.session.id)).toMatchObject({
        status: 'refunded',
        amountRefunded: 2520,
        creditsReversed: 15,
        creditsShortfall: 0,
      });
      expect((await getCredits(ctx, order.userId)).credits).toBe(0);
      await expectBalanceMatchesLedger(ctx, order.userId);
    });

    it('[AC-PAY-030] a partial refund is proportional to the amount actually paid', async () => {
      // 40 credits paid 55 zł; 11 zł back = 20% → 8 credits (against the list price it would be 6)
      const order = await buyWithCode('credits_40', 5500);
      await deliver(ctx, stripe, refundEvent(order.pi, 5500, 1100)).expect(200);
      expect(await txOf(order.session.id)).toMatchObject({
        status: 'partially_refunded',
        amountRefunded: 1100,
        creditsReversed: 8,
      });
      expect((await getCredits(ctx, order.userId)).credits).toBe(32);

      await deliver(ctx, stripe, refundEvent(order.pi, 5500, 5500)).expect(200);
      expect(await txOf(order.session.id)).toMatchObject({ status: 'refunded', creditsReversed: 40 });
      expect((await getCredits(ctx, order.userId)).credits).toBe(0);
      await expectBalanceMatchesLedger(ctx, order.userId);
    });

    it('[AC-PAY-030] a dispute on a discounted payment holds back all credits; a won dispute gives them back', async () => {
      const order = await buyWithCode('credits_15', 2520);
      await deliver(ctx, stripe, disputeEvent('charge.dispute.created', order.pi, 2520, 'needs_response')).expect(200);
      expect(await txOf(order.session.id)).toMatchObject({ status: 'disputed', creditsReversed: 15 });
      expect((await getCredits(ctx, order.userId)).credits).toBe(0);

      await deliver(ctx, stripe, disputeEvent('charge.dispute.closed', order.pi, 2520, 'won')).expect(200);
      expect(await txOf(order.session.id)).toMatchObject({ status: 'completed', creditsReversed: 0 });
      expect((await getCredits(ctx, order.userId)).credits).toBe(15);
      await expectBalanceMatchesLedger(ctx, order.userId);
    });

    it('[AC-PAY-030] a refund that overtakes the completion is recomputed against the discounted amount', async () => {
      // the whole 25,20 zł comes back before checkout.session.completed – on the list price it looked partial
      const order = await checkout('credits_15');
      await deliver(ctx, stripe, refundEvent(order.pi, 2520, 2520, { customer: order.session.customer })).expect(200);
      expect(await txOf(order.session.id)).toMatchObject({ status: 'partially_refunded', amountRefunded: 2520 });

      const promo = stripe.addPromotionCode('PARTNER-10');
      await deliver(
        ctx,
        stripe,
        discountedCompletedEvent(order.session.id, order.pi, { list: 2800, paid: 2520 }, promo.id),
      ).expect(200);
      expect(await txOf(order.session.id)).toMatchObject({
        status: 'refunded',
        amountPln: 2520,
        amountRefunded: 2520,
        creditsReversed: 15,
        completedAt: expect.any(Date),
      });
      expect((await getCredits(ctx, order.userId)).credits).toBe(0);
      await expectBalanceMatchesLedger(ctx, order.userId);

      // half of a discounted payment refunded early → half of the credits arrive
      const half = await checkout('credits_40');
      await deliver(ctx, stripe, refundEvent(half.pi, 5500, 2750, { customer: half.session.customer })).expect(200);
      await deliver(
        ctx,
        stripe,
        discountedCompletedEvent(half.session.id, half.pi, { list: 7000, paid: 5500 }, promo.id),
      ).expect(200);
      expect(await txOf(half.session.id)).toMatchObject({ status: 'partially_refunded', creditsReversed: 20 });
      expect((await getCredits(ctx, half.userId)).credits).toBe(20);
      await expectBalanceMatchesLedger(ctx, half.userId);
    });
  });

  // ─── Admin: revenue and payment details (spec 16) ─────────────────

  describe('admin revenue and payment details', () => {
    it('[AC-ADM-016] revenue and per-account totals use the paid amount; creditsSold counts the full packs', async () => {
      const admin = await makeAdmin();
      const percent = await buyWithCode('credits_15', 2520); // 10% off
      const fixed = await buyWithCode('credits_40', 5500, 'KATALOG-15ZL'); // 15 zł off
      const free = await buyWithCode('credits_5', 0, 'PARTNER-100'); // 100%
      const refunded = await buyWithCode('credits_15', 2240, 'CZYTELNIK-20'); // 20% off, then 11,20 zł back
      await deliver(ctx, stripe, refundEvent(refunded.pi, 2240, 1120)).expect(200);
      const plain = await checkout('credits_5', percent); // second, full-price purchase of the same account
      await deliver(
        ctx,
        stripe,
        completedEvent(plain.session.id, plain.pi, { currency: 'pln', amount_total: 1000 }),
      ).expect(200);

      const overview = await ctx.http().get('/api/admin/overview').set(auth(admin.token)).expect(200);
      expect(overview.body.revenue).toMatchObject({
        completedTransactions: 5,
        totalGrosze: 2520 + 5500 + 0 + (2240 - 1120) + 1000,
        refundedGrosze: 1120,
        last30dGrosze: 2520 + 5500 + 0 + (2240 - 1120) + 1000,
        creditsSold: 15 + 40 + 5 + (15 - 8) + 5,
      });

      const users = await ctx.http().get('/api/admin/users').set(auth(admin.token)).expect(200);
      const paid = new Map(users.body.users.map((u: any) => [u.id, u.paidTotalGrosze]));
      expect(paid.get(percent.userId)).toBe(2520 + 1000);
      expect(paid.get(fixed.userId)).toBe(5500);
      expect(paid.get(free.userId)).toBe(0);
      expect(paid.get(refunded.userId)).toBe(1120);
    });

    it('[AC-ADM-019] the account details show the code and the discount of a payment', async () => {
      const admin = await makeAdmin();
      const order = await buyWithCode('credits_15', 2520);
      const plain = await checkout('credits_5', order);
      await deliver(ctx, stripe, completedEvent(plain.session.id, plain.pi)).expect(200);

      const detail = await ctx.http().get(`/api/admin/users/${order.userId}`).set(auth(admin.token)).expect(200);
      const byAmount = new Map(detail.body.payments.map((p: any) => [p.amountPln, p]));
      expect(byAmount.get(2520)).toMatchObject({
        promotionCode: 'PARTNER-10',
        amountDiscount: 280,
        creditsAdded: 15,
        status: 'completed',
      });
      expect(byAmount.get(1000)).toMatchObject({ promotionCode: null, amountDiscount: 0 });
      expect(JSON.stringify(detail.body.payments)).not.toMatch(/promo_fake|pi_|cs_fake/);
    });
  });

  // ─── Admin: discount codes (spec 16) ──────────────────────────────

  describe('admin discount codes', () => {
    const create = (token: string, body: Record<string, unknown>) =>
      ctx.http().post('/api/admin/discount-codes').set(auth(token)).send(body);
    const inAWeek = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    it('[AC-ADM-017] creates a percent code in Stripe (coupon once + promotion code) with limit, expiry and note', async () => {
      const admin = await makeAdmin();
      const expiresAt = inAWeek();
      const res = await create(admin.token, {
        code: '  katalog-firm-10 ',
        type: 'percent',
        percentOff: 10,
        maxRedemptions: 50,
        expiresAt,
        note: '  Katalog firm – czytelnicy ',
      }).expect(201);

      expect(stripe.coupons).toEqual([
        expect.objectContaining({ duration: 'once', percent_off: 10, name: 'KATALOG-FIRM-10' }),
      ]);
      expect(stripe.coupons[0]).not.toHaveProperty('amount_off');
      const [promo] = [...stripe.promotionCodes.values()];
      expect(promo).toMatchObject({
        promotion: { type: 'coupon', coupon: stripe.coupons[0].id },
        code: 'KATALOG-FIRM-10',
        max_redemptions: 50,
        expires_at: Math.floor(new Date(expiresAt).getTime() / 1000),
      });

      expect(res.body).toMatchObject({
        code: 'KATALOG-FIRM-10',
        type: 'percent',
        percentOff: 10,
        amountOffGrosze: null,
        maxRedemptions: 50,
        expiresAt,
        note: 'Katalog firm – czytelnicy',
        status: 'active',
        timesRedeemed: 0,
        orders: 0,
        createdBy: admin.email,
      });
      expect(res.body).not.toHaveProperty('stripeCouponId');
      expect(await ctx.prisma.discountCode.findUniqueOrThrow({ where: { code: 'KATALOG-FIRM-10' } })).toMatchObject({
        stripeCouponId: stripe.coupons[0].id,
        stripePromotionCodeId: promo.id,
        active: true,
      });
    });

    it('[AC-ADM-017] creates a fixed-amount code in grosze and PLN; optional fields stay unset', async () => {
      const admin = await makeAdmin();
      const res = await create(admin.token, { code: 'MINUS-12ZL', type: 'amount', amountOffPln: 12.5 }).expect(201);
      expect(stripe.coupons[0]).toMatchObject({ duration: 'once', amount_off: 1250, currency: 'pln' });
      expect(stripe.coupons[0]).not.toHaveProperty('percent_off');
      const [promo] = [...stripe.promotionCodes.values()];
      expect(promo).not.toHaveProperty('max_redemptions');
      expect(promo).not.toHaveProperty('expires_at');
      expect(res.body).toMatchObject({
        code: 'MINUS-12ZL',
        type: 'amount',
        percentOff: null,
        amountOffGrosze: 1250,
        maxRedemptions: null,
        expiresAt: null,
        note: null,
        status: 'active',
      });

      // 0.1 + 0.2 style floats are rounded to whole grosze, a 100% code is allowed
      await create(admin.token, { code: 'GROSZE', type: 'amount', amountOffPln: 19.99 }).expect(201);
      expect(stripe.coupons[1].amount_off).toBe(1999);
      await create(admin.token, { code: 'FULL-100', type: 'percent', percentOff: 100 }).expect(201);
      expect(stripe.coupons[2].percent_off).toBe(100);
    });

    const invalid: Array<[string, Record<string, unknown>, RegExp]> = [
      ['a missing code', { type: 'percent', percentOff: 10 }, /Kod może mieć 3–30 znaków|Podaj kod/],
      ['a too short code', { code: 'AB', type: 'percent', percentOff: 10 }, /Kod może mieć 3–30 znaków/],
      ['a too long code', { code: 'A'.repeat(31), type: 'percent', percentOff: 10 }, /Kod może mieć 3–30 znaków/],
      ['Polish letters', { code: 'ZNIŻKA', type: 'percent', percentOff: 10 }, /bez polskich znaków/],
      ['a space', { code: 'PARTNER 10', type: 'percent', percentOff: 10 }, /Kod może mieć 3–30 znaków/],
      ['an underscore', { code: 'PARTNER_10', type: 'percent', percentOff: 10 }, /Kod może mieć 3–30 znaków/],
      ['a number as the code', { code: 12345, type: 'percent', percentOff: 10 }, /Podaj kod/],
      ['a missing type', { code: 'PARTNER', percentOff: 10 }, /Wybierz rodzaj rabatu/],
      ['an unknown type', { code: 'PARTNER', type: 'free', percentOff: 10 }, /Wybierz rodzaj rabatu/],
      ['a missing percent', { code: 'PARTNER', type: 'percent' }, /od 1 do 100/],
      ['0%', { code: 'PARTNER', type: 'percent', percentOff: 0 }, /od 1 do 100/],
      ['101%', { code: 'PARTNER', type: 'percent', percentOff: 101 }, /od 1 do 100/],
      ['a fractional percent', { code: 'PARTNER', type: 'percent', percentOff: 10.5 }, /od 1 do 100/],
      ['a percent as text', { code: 'PARTNER', type: 'percent', percentOff: '10' }, /od 1 do 100/],
      ['a missing amount', { code: 'PARTNER', type: 'amount' }, /Kwota rabatu/],
      ['0 zł', { code: 'PARTNER', type: 'amount', amountOffPln: 0 }, /większa od 0/],
      ['a negative amount', { code: 'PARTNER', type: 'amount', amountOffPln: -5 }, /większa od 0/],
      ['three decimals', { code: 'PARTNER', type: 'amount', amountOffPln: 1.234 }, /najwyżej 2 miejscami/],
      ['an amount as text', { code: 'PARTNER', type: 'amount', amountOffPln: '10' }, /Kwota rabatu musi być liczbą/],
      ['an absurd amount', { code: 'PARTNER', type: 'amount', amountOffPln: 10001 }, /najwyżej 10 000 zł/],
      ['a limit of 0', { code: 'PARTNER', type: 'percent', percentOff: 10, maxRedemptions: 0 }, /co najmniej 1/],
      [
        'a fractional limit',
        { code: 'PARTNER', type: 'percent', percentOff: 10, maxRedemptions: 1.5 },
        /Limit użyć musi być liczbą całkowitą/,
      ],
      [
        'a past expiry date',
        { code: 'PARTNER', type: 'percent', percentOff: 10, expiresAt: '2020-01-01T00:00:00.000Z' },
        /Data ważności musi być w przyszłości/,
      ],
      [
        'an invalid expiry date',
        { code: 'PARTNER', type: 'percent', percentOff: 10, expiresAt: 'jutro' },
        /Nieprawidłowa data ważności/,
      ],
      [
        'a too long note',
        { code: 'PARTNER', type: 'percent', percentOff: 10, note: 'x'.repeat(201) },
        /Notatka może mieć maksymalnie 200 znaków/,
      ],
    ];

    it.each(invalid)(
      '[AC-ADM-017] rejects %s with a Polish message and never calls Stripe',
      async (_, body, message) => {
        const admin = await makeAdmin();
        const res = await create(admin.token, body).expect(400);
        const text = Array.isArray(res.body.message) ? res.body.message.join(' ') : String(res.body.message);
        expect(text).toMatch(message);
        expect(stripe.coupons).toHaveLength(0);
        expect(stripe.promotionCalls.create).toBe(0);
        expect(await ctx.prisma.discountCode.count()).toBe(0);
      },
    );

    it('[AC-ADM-017] a code that already exists – here or in Stripe – is a 409 and leaves nothing behind', async () => {
      const admin = await makeAdmin();
      await create(admin.token, { code: 'PARTNER-10', type: 'percent', percentOff: 10 }).expect(201);
      const again = await create(admin.token, { code: 'partner-10', type: 'amount', amountOffPln: 5 }).expect(409);
      expect(again.body.message).toBe('Taki kod już istnieje – wybierz inny');
      expect(stripe.coupons).toHaveLength(1);

      // the shared Stripe account already has this code (e.g. the JAN-MAT shop)
      stripe.addPromotionCode('SKLEP-20');
      await create(admin.token, { code: 'sklep-20', type: 'percent', percentOff: 20 }).expect(409);
      expect(stripe.deletedCoupons).toEqual([stripe.coupons[1].id]);
      expect(await ctx.prisma.discountCode.count()).toBe(1);
    });

    it('[AC-ADM-017] a Stripe failure is a 503 and nothing is saved; a half-made coupon is deleted', async () => {
      const admin = await makeAdmin();
      stripe.couponCreateError = Object.assign(new Error('api down'), { statusCode: 500 });
      const first = await create(admin.token, { code: 'PARTNER-10', type: 'percent', percentOff: 10 }).expect(503);
      expect(first.body.message).toMatch(/Nie udało się utworzyć kodu w Stripe/);

      stripe.couponCreateError = null;
      stripe.promotionCreateError = Object.assign(new Error('api down'), { statusCode: 500 });
      await create(admin.token, { code: 'PARTNER-10', type: 'percent', percentOff: 10 }).expect(503);
      expect(stripe.deletedCoupons).toEqual([stripe.coupons[0].id]);
      expect(await ctx.prisma.discountCode.count()).toBe(0);

      // works once Stripe is back
      stripe.promotionCreateError = null;
      await create(admin.token, { code: 'PARTNER-10', type: 'percent', percentOff: 10 }).expect(201);
    });

    it('[AC-ADM-018] lists codes newest first with status, Stripe redemptions and AllGrafika orders', async () => {
      const admin = await makeAdmin();
      const make = async (code: string, extra: Record<string, unknown> = {}) =>
        (await create(admin.token, { code, type: 'percent', percentOff: 10, ...extra }).expect(201)).body;
      const used = await make('UZYWANY', { maxRedemptions: 5 });
      const exhausted = await make('WYCZERPANY', { maxRedemptions: 2 });
      const expired = await make('WYGASLY', { expiresAt: inAWeek() });
      const disabled = await make('WYLACZONY');
      await ctx.prisma.discountCode.update({
        where: { id: expired.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await ctx.http().post(`/api/admin/discount-codes/${disabled.id}/deactivate`).set(auth(admin.token)).expect(200);

      const promoOf = async (id: string) =>
        stripe.promotionCodes.get(
          (await ctx.prisma.discountCode.findUniqueOrThrow({ where: { id } })).stripePromotionCodeId,
        );
      (await promoOf(used.id)).times_redeemed = 3;
      (await promoOf(exhausted.id)).times_redeemed = 2;
      // two fulfilled orders with UZYWANY (one fully refunded still counts as an order), one abandoned
      await buyWithCode('credits_15', 2520, 'uzywany');
      const refunded = await buyWithCode('credits_5', 900, 'UZYWANY');
      await deliver(ctx, stripe, refundEvent(refunded.pi, 900, 900)).expect(200);
      await checkout('credits_5');
      await ctx.prisma.paymentTransaction.updateMany({
        where: { completedAt: null },
        data: { promotionCode: 'UZYWANY' },
      });

      const res = await ctx.http().get('/api/admin/discount-codes').set(auth(admin.token)).expect(200);
      expect(res.body.codes.map((c: any) => [c.code, c.status, c.timesRedeemed, c.maxRedemptions, c.orders])).toEqual([
        ['WYLACZONY', 'inactive', 0, null, 0],
        ['WYGASLY', 'expired', 0, null, 0],
        ['WYCZERPANY', 'exhausted', 2, 2, 0],
        ['UZYWANY', 'active', 3, 5, 2],
      ]);

      // Stripe does not answer – the list still works, without redemptions
      stripe.promotionRetrieveError = Object.assign(new Error('api down'), { statusCode: 500 });
      const offline = await ctx.http().get('/api/admin/discount-codes').set(auth(admin.token)).expect(200);
      expect(offline.body.codes.map((c: any) => [c.code, c.status, c.timesRedeemed])).toEqual([
        ['WYLACZONY', 'inactive', null],
        ['WYGASLY', 'expired', null],
        ['WYCZERPANY', 'active', null],
        ['UZYWANY', 'active', null],
      ]);

      // a code switched off in the Stripe dashboard shows as inactive
      stripe.promotionRetrieveError = null;
      (await promoOf(used.id)).active = false;
      const after = await ctx.http().get('/api/admin/discount-codes').set(auth(admin.token)).expect(200);
      expect(after.body.codes.find((c: any) => c.code === 'UZYWANY').status).toBe('inactive');
    });

    it('[AC-ADM-018] deactivates a code in Stripe once; unknown code 404; a Stripe failure keeps it active', async () => {
      const admin = await makeAdmin();
      const code = (await create(admin.token, { code: 'PARTNER-10', type: 'percent', percentOff: 10 }).expect(201))
        .body;
      const promoId = (await ctx.prisma.discountCode.findUniqueOrThrow({ where: { id: code.id } }))
        .stripePromotionCodeId;

      stripe.promotionUpdateError = Object.assign(new Error('api down'), { statusCode: 500 });
      const failed = await ctx
        .http()
        .post(`/api/admin/discount-codes/${code.id}/deactivate`)
        .set(auth(admin.token))
        .expect(503);
      expect(failed.body.message).toMatch(/Nie udało się wyłączyć kodu w Stripe/);
      expect(await ctx.prisma.discountCode.findUniqueOrThrow({ where: { id: code.id } })).toMatchObject({
        active: true,
        deactivatedAt: null,
      });

      stripe.promotionUpdateError = null;
      const res = await ctx
        .http()
        .post(`/api/admin/discount-codes/${code.id}/deactivate`)
        .set(auth(admin.token))
        .expect(200);
      expect(res.body).toMatchObject({ code: 'PARTNER-10', status: 'inactive', deactivatedAt: expect.any(String) });
      expect(stripe.promotionCodes.get(promoId).active).toBe(false);
      const updates = stripe.promotionCalls.update;

      // again: nothing changes, Stripe is not called
      await ctx.http().post(`/api/admin/discount-codes/${code.id}/deactivate`).set(auth(admin.token)).expect(200);
      expect(stripe.promotionCalls.update).toBe(updates);

      await ctx.http().post('/api/admin/discount-codes/nope/deactivate').set(auth(admin.token)).expect(404);

      // the text is free again for a new code
      await create(admin.token, { code: 'PARTNER-10-B', type: 'percent', percentOff: 15 }).expect(201);
    });

    it('[AC-ADM-018] accounts outside ADMIN_EMAILS get 403 on every discount-code endpoint', async () => {
      const admin = await makeAdmin();
      const code = (await create(admin.token, { code: 'PARTNER-10', type: 'percent', percentOff: 10 }).expect(201))
        .body;
      const user = await registerUser(ctx);

      await ctx.http().get('/api/admin/discount-codes').set(auth(user.token)).expect(403);
      await create(user.token, { code: 'HACK-100', type: 'percent', percentOff: 100 }).expect(403);
      await ctx.http().post(`/api/admin/discount-codes/${code.id}/deactivate`).set(auth(user.token)).expect(403);
      await ctx.http().get('/api/admin/discount-codes').expect(401);

      expect(stripe.coupons).toHaveLength(1);
      expect(await ctx.prisma.discountCode.findUniqueOrThrow({ where: { id: code.id } })).toMatchObject({
        active: true,
      });
    });
  });
});
