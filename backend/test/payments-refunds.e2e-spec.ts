import {
  createTestApp,
  getCredits,
  registerUser,
  resetDatabase,
  TestContext,
  uploadImage,
  waitForGenerations,
} from './test-app';
import { completedEvent, deliver, disputeEvent, eventId, FakeStripe, refundEvent } from './stripe-fake';
import { expectBalanceMatchesLedger } from './ledger';

const ADMIN = 'owner-alerts@allgrafika.test';

/**
 * Spec 09 (AC-PAY-016..024): refunds and chargebacks take credits back, idempotently per Stripe event,
 * in any order, never below zero, and the operator is told. Real database, signed webhooks, fake Stripe.
 */
describe('Stripe refunds and disputes (integration)', () => {
  let ctx: TestContext;
  const stripe = new FakeStripe();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const adminMails = () => ctx.mail.sent.filter((m) => m.to === ADMIN);

  beforeAll(async () => {
    ctx = await createTestApp();
    ctx.payments.setStripeClient(stripe.client());
    process.env.ADMIN_EMAILS = ADMIN;
  });
  afterAll(async () => {
    delete process.env.ADMIN_EMAILS;
    await ctx.close();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await ctx.prisma.$executeRawUnsafe('TRUNCATE TABLE "stripe_events"');
    stripe.reset();
    ctx.mail.sent = [];
    ctx.gemini.failStyles.clear();
  });

  /** Registers a verified account and buys a pack through the API; `pay: false` leaves it pending. */
  async function buy(packageId = 'credits_15', options: { pay?: boolean } = {}) {
    const user = await registerUser(ctx);
    await ctx
      .http()
      .post('/api/payments/checkout')
      .set(auth(user.token))
      .send({ packageId, acceptedWithdrawalWaiver: true })
      .expect(201);
    const session = stripe.sessions.at(-1);
    const pi = `pi_${session.id}`;
    stripe.sessionPaymentIntents.set(session.id, pi);
    if (options.pay !== false) await deliver(ctx, stripe, completedEvent(session.id, pi)).expect(200);
    const customer = (await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.userId } })).stripeCustomerId!;
    return { ...user, session, pi, customer };
  }

  const txOf = (sessionId: string) =>
    ctx.prisma.paymentTransaction.findUniqueOrThrow({ where: { stripeSessionId: sessionId } });

  /** Spends `count` purchased credits on real generations (free pool marked as used first). */
  async function spendPaid(user: { token: string; userId: string }, styles: string[]) {
    await ctx.prisma.user.update({ where: { id: user.userId }, data: { freeCreditsUsed: 10 } });
    const image = await uploadImage(ctx, user.token);
    await ctx.http().post(`/api/generation/${image.id}/start`).set(auth(user.token)).send({ styles }).expect(201);
    await waitForGenerations(ctx, image.id);
  }

  it('[AC-PAY-016] stores the PaymentIntent, completion time and pack of a paid session and of subscription invoices (both shapes)', async () => {
    const { session, pi, userId } = await buy('credits_40');
    expect(await txOf(session.id)).toMatchObject({
      status: 'completed',
      packageId: 'credits_40',
      stripePaymentIntentId: pi,
      completedAt: expect.any(Date),
      creditsAdded: 40,
    });
    expect(session.metadata.transactionId).toBe((await txOf(session.id)).id);

    await ctx.prisma.subscription.create({
      data: { userId, stripeSubscriptionId: 'sub_shapes', planId: 'sub_start', status: 'active' },
    });
    // API 2025-03+: the PaymentIntent sits in invoice.payments
    await deliver(ctx, stripe, {
      id: eventId(),
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_new_shape',
          billing_reason: 'subscription_create',
          amount_paid: 1900,
          parent: { subscription_details: { subscription: 'sub_shapes', metadata: { planId: 'sub_start', userId } } },
          payments: { data: [{ payment: { type: 'payment_intent', payment_intent: 'pi_invoice_new' } }] },
        },
      },
    }).expect(200);
    // older API: invoice.payment_intent
    await deliver(ctx, stripe, {
      id: eventId(),
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_old_shape',
          billing_reason: 'subscription_cycle',
          amount_paid: 1900,
          subscription: 'sub_shapes',
          payment_intent: { id: 'pi_invoice_old', object: 'payment_intent' },
        },
      },
    }).expect(200);

    const invoices = await ctx.prisma.paymentTransaction.findMany({
      where: { userId, kind: 'subscription' },
      orderBy: { stripeSessionId: 'asc' },
    });
    expect(invoices.map((t) => [t.stripeSessionId, t.stripePaymentIntentId, t.creditsAdded])).toEqual([
      ['in_new_shape', 'pi_invoice_new', 40],
      ['in_old_shape', 'pi_invoice_old', 40],
    ]);
    expect(invoices.every((t) => t.completedAt instanceof Date)).toBe(true);
    expect((await getCredits(ctx, userId)).credits).toBe(120);
    await expectBalanceMatchesLedger(ctx, userId);
  });

  it('[AC-PAY-017] a partial and then a full refund take the credits back proportionally, once per event, and alert the admins', async () => {
    const { session, pi, userId, token, customer } = await buy('credits_15'); // 15 credits for 28 zł
    expect((await getCredits(ctx, userId)).credits).toBe(15);

    const partial = refundEvent(pi, 2800, 1400, { customer });
    await deliver(ctx, stripe, partial).expect(200);
    // 15 × 14/28 = 7.5 → 8 credits taken back
    expect(await txOf(session.id)).toMatchObject({
      status: 'partially_refunded',
      amountRefunded: 1400,
      creditsReversed: 8,
      creditsShortfall: 0,
    });
    expect((await getCredits(ctx, userId)).credits).toBe(7);
    expect(adminMails()).toHaveLength(1);
    expect(adminMails()[0].subject).toContain('Zwrot płatności');
    expect(adminMails()[0].text).toContain('odebrane łącznie: 8');

    // Stripe retries the same event – nothing changes, no second alert.
    await deliver(ctx, stripe, partial).expect(200);
    expect((await getCredits(ctx, userId)).credits).toBe(7);
    expect(adminMails()).toHaveLength(1);

    await deliver(ctx, stripe, refundEvent(pi, 2800, 2800, { customer })).expect(200);
    expect(await txOf(session.id)).toMatchObject({ status: 'refunded', amountRefunded: 2800, creditsReversed: 15 });
    expect((await getCredits(ctx, userId)).credits).toBe(0);
    expect(adminMails()).toHaveLength(2);

    const history = await ctx.http().get('/api/payments/history').set(auth(token)).expect(200);
    expect(history.body[0]).toMatchObject({ status: 'refunded', amountRefunded: 2800, creditsReversed: 15 });
    expect(await ctx.prisma.stripeEvent.count()).toBe(2);
    await expectBalanceMatchesLedger(ctx, userId);
  });

  it('[AC-PAY-017] out of order: the full refund first, then the older partial event, never gives credits back', async () => {
    const { session, pi, userId, customer } = await buy('credits_40'); // 40 credits for 70 zł
    await deliver(ctx, stripe, refundEvent(pi, 7000, 7000, { customer })).expect(200);
    expect((await getCredits(ctx, userId)).credits).toBe(0);
    await deliver(ctx, stripe, refundEvent(pi, 7000, 3500, { customer })).expect(200);
    expect(await txOf(session.id)).toMatchObject({ status: 'refunded', amountRefunded: 7000, creditsReversed: 40 });
    expect((await getCredits(ctx, userId)).credits).toBe(0);
    await expectBalanceMatchesLedger(ctx, userId);
  });

  it('[AC-PAY-018] a refund after the credits were spent stops the balance at 0 and records the shortfall', async () => {
    const buyer = await buy('credits_5'); // 5 credits for 10 zł
    await spendPaid(buyer, ['white-bg', 'dark-luxury']);
    expect((await getCredits(ctx, buyer.userId)).credits).toBe(3);

    await deliver(ctx, stripe, refundEvent(buyer.pi, 1000, 1000, { customer: buyer.customer })).expect(200);
    expect(await txOf(buyer.session.id)).toMatchObject({ status: 'refunded', creditsReversed: 5, creditsShortfall: 2 });
    expect(await getCredits(ctx, buyer.userId)).toEqual({ credits: 0, freeCreditsUsed: 10 });
    expect(adminMails()[0].text).toContain('niedobór (już wydane): 2');

    // Nothing left to spend: the next graphic is refused instead of going negative.
    const image = await uploadImage(ctx, buyer.token);
    await ctx
      .http()
      .post(`/api/generation/${image.id}/start`)
      .set(auth(buyer.token))
      .send({ styles: ['white-bg'] })
      .expect(402);
    await expectBalanceMatchesLedger(ctx, buyer.userId, { freeUsed: 10 });
  });

  it('[AC-PAY-019] a dispute takes the credits, a won dispute gives them back – the shortfall first', async () => {
    const buyer = await buy('credits_40');
    await spendPaid(buyer, ['white-bg', 'dark-luxury']);
    expect((await getCredits(ctx, buyer.userId)).credits).toBe(38);

    await deliver(ctx, stripe, disputeEvent('charge.dispute.created', buyer.pi, 7000, 'needs_response')).expect(200);
    expect(await txOf(buyer.session.id)).toMatchObject({
      status: 'disputed',
      disputeStatus: 'open',
      disputeAmount: 7000,
      creditsReversed: 40,
      creditsShortfall: 2,
    });
    expect((await getCredits(ctx, buyer.userId)).credits).toBe(0);
    expect(adminMails().at(-1)!.subject).toContain('Spór (chargeback) otwarty');

    await deliver(ctx, stripe, disputeEvent('charge.dispute.closed', buyer.pi, 7000, 'won')).expect(200);
    expect(await txOf(buyer.session.id)).toMatchObject({
      status: 'completed',
      disputeStatus: 'won',
      disputeAmount: 0,
      creditsReversed: 0,
      creditsShortfall: 0,
    });
    // 40 reversed: 2 were never taken (shortfall) → 38 come back, exactly the balance before the dispute
    expect((await getCredits(ctx, buyer.userId)).credits).toBe(38);
    expect(adminMails()).toHaveLength(2);
    expect(adminMails()[1].subject).toContain('wygrany');
    await expectBalanceMatchesLedger(ctx, buyer.userId, { freeUsed: 10 });
  });

  it('[AC-PAY-019] a lost dispute keeps the credits removed and a late "created" event does not reopen a closed dispute', async () => {
    const lost = await buy('credits_15');
    await deliver(ctx, stripe, disputeEvent('charge.dispute.created', lost.pi, 1400, 'needs_response')).expect(200);
    expect((await getCredits(ctx, lost.userId)).credits).toBe(7);
    await deliver(ctx, stripe, disputeEvent('charge.dispute.closed', lost.pi, 1400, 'lost')).expect(200);
    expect(await txOf(lost.session.id)).toMatchObject({
      status: 'disputed',
      disputeStatus: 'lost',
      creditsReversed: 8,
    });
    await deliver(ctx, stripe, disputeEvent('charge.dispute.created', lost.pi, 1400, 'needs_response')).expect(200);
    expect(await txOf(lost.session.id)).toMatchObject({ status: 'disputed', disputeStatus: 'lost' });
    expect((await getCredits(ctx, lost.userId)).credits).toBe(7);
    await expectBalanceMatchesLedger(ctx, lost.userId);

    // "closed: won" overtaking "created": nothing is taken, and the late "created" is ignored.
    const won = await buy('credits_5');
    await deliver(ctx, stripe, disputeEvent('charge.dispute.closed', won.pi, 1000, 'won')).expect(200);
    await deliver(ctx, stripe, disputeEvent('charge.dispute.created', won.pi, 1000, 'needs_response')).expect(200);
    expect(await txOf(won.session.id)).toMatchObject({ status: 'completed', disputeStatus: 'won', creditsReversed: 0 });
    expect((await getCredits(ctx, won.userId)).credits).toBe(5);
    await expectBalanceMatchesLedger(ctx, won.userId);
  });

  it('[AC-PAY-019] a dispute that names only the charge is resolved through Stripe', async () => {
    const buyer = await buy('credits_5');
    stripe.chargesById.set('ch_only', { id: 'ch_only', payment_intent: buyer.pi, customer: buyer.customer });
    await deliver(ctx, stripe, {
      id: eventId(),
      type: 'charge.dispute.created',
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: 'dp_only', charge: 'ch_only', amount: 1000, status: 'needs_response' } },
    }).expect(200);
    expect(await txOf(buyer.session.id)).toMatchObject({ status: 'disputed', creditsReversed: 5 });
    expect((await getCredits(ctx, buyer.userId)).credits).toBe(0);
  });

  it('[AC-PAY-020] refunding a subscription invoice takes back the credits of that invoice (stored PaymentIntent or Stripe lookup)', async () => {
    const { userId } = await registerUser(ctx);
    await ctx.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: 'cus_sub_refund' } });
    await ctx.prisma.subscription.create({
      data: { userId, stripeSubscriptionId: 'sub_r', planId: 'sub_start', status: 'active' },
    });
    for (const [invoice, pi] of [
      ['in_r1', 'pi_r1'],
      ['in_r2', 'pi_r2'],
    ]) {
      await deliver(ctx, stripe, {
        id: eventId(),
        type: 'invoice.paid',
        data: {
          object: {
            id: invoice,
            customer: 'cus_sub_refund',
            billing_reason: 'subscription_cycle',
            amount_paid: 1900,
            parent: { subscription_details: { subscription: 'sub_r', metadata: { planId: 'sub_start', userId } } },
            payments: { data: [{ payment: { type: 'payment_intent', payment_intent: pi } }] },
          },
        },
      }).expect(200);
    }
    expect((await getCredits(ctx, userId)).credits).toBe(80);

    // half of the second invoice: 40 × 950/1900 = 20
    await deliver(ctx, stripe, refundEvent('pi_r2', 1900, 950, { customer: 'cus_sub_refund' })).expect(200);
    expect(await txOf('in_r2')).toMatchObject({ status: 'partially_refunded', creditsReversed: 20 });
    expect(await txOf('in_r1')).toMatchObject({ status: 'completed', creditsReversed: 0 });
    expect((await getCredits(ctx, userId)).credits).toBe(60);

    // an invoice paid before PaymentIntents were stored: matched through Stripe's invoice payments
    await ctx.prisma.paymentTransaction.create({
      data: {
        userId,
        stripeSessionId: 'in_legacy',
        stripeInvoiceId: 'in_legacy',
        amountPln: 1900,
        creditsAdded: 40,
        status: 'completed',
        kind: 'subscription',
        completedAt: new Date(),
      },
    });
    await ctx.prisma.user.update({ where: { id: userId }, data: { credits: { increment: 40 } } });
    stripe.invoicePayments.set('pi_legacy_invoice', 'in_legacy');
    await deliver(ctx, stripe, refundEvent('pi_legacy_invoice', 1900, 1900, { customer: 'cus_sub_refund' })).expect(
      200,
    );
    expect(await txOf('in_legacy')).toMatchObject({
      status: 'refunded',
      creditsReversed: 40,
      stripePaymentIntentId: 'pi_legacy_invoice',
    });
    expect((await getCredits(ctx, userId)).credits).toBe(60);
    await expectBalanceMatchesLedger(ctx, userId);
  });

  it('[AC-PAY-021] a refund delivered before checkout.session.completed: the completion adds only what is left', async () => {
    const partial = await buy('credits_15', { pay: false });
    // 15 × 1000/2800 = 5.36 → 5; the PaymentIntent is not stored yet – found through the Checkout session
    await deliver(ctx, stripe, refundEvent(partial.pi, 2800, 1000, { customer: partial.customer })).expect(200);
    expect(await txOf(partial.session.id)).toMatchObject({
      status: 'partially_refunded',
      completedAt: null,
      creditsReversed: 5,
      stripePaymentIntentId: partial.pi,
    });
    expect((await getCredits(ctx, partial.userId)).credits).toBe(0);
    await deliver(ctx, stripe, completedEvent(partial.session.id, partial.pi)).expect(200);
    expect(await txOf(partial.session.id)).toMatchObject({
      status: 'partially_refunded',
      completedAt: expect.any(Date),
    });
    expect((await getCredits(ctx, partial.userId)).credits).toBe(10);
    await expectBalanceMatchesLedger(ctx, partial.userId);

    const full = await buy('credits_5', { pay: false });
    await deliver(ctx, stripe, refundEvent(full.pi, 1000, 1000, { customer: full.customer })).expect(200);
    await deliver(ctx, stripe, completedEvent(full.session.id, full.pi)).expect(200);
    expect(await txOf(full.session.id)).toMatchObject({ status: 'refunded', creditsReversed: 5 });
    expect((await getCredits(ctx, full.userId)).credits).toBe(0);
    await expectBalanceMatchesLedger(ctx, full.userId);
  });

  it('[AC-PAY-022] a foreign charge is ignored silently; our unmatched payment is retried, then reported once; a legacy row is matched through Stripe', async () => {
    const buyer = await buy('credits_15');

    // JAN-MAT shop payment on the shared Stripe account
    await deliver(ctx, stripe, refundEvent('pi_janmat', 5000, 5000, { customer: 'cus_janmat_shop' })).expect(200);
    expect((await getCredits(ctx, buyer.userId)).credits).toBe(15);
    expect(await ctx.prisma.stripeEvent.count()).toBe(0);
    expect(adminMails()).toHaveLength(0);

    // Our customer, but no transaction matches (e.g. invoice.paid still on its way): Stripe should retry.
    const fresh = refundEvent('pi_not_yet', 1900, 1900, { customer: buyer.customer });
    await deliver(ctx, stripe, fresh).expect(503);
    expect(adminMails()).toHaveLength(0);
    // After the retry window the operator is told – once, however often Stripe delivers.
    const old = {
      ...refundEvent('pi_never', 1900, 1900, { customer: buyer.customer }),
      created: Math.floor(Date.now() / 1000) - 7 * 3600,
    };
    await deliver(ctx, stripe, old).expect(200);
    await deliver(ctx, stripe, old).expect(200);
    expect(adminMails()).toHaveLength(1);
    expect(adminMails()[0].subject).toContain('Nie dopasowano');
    expect((await getCredits(ctx, buyer.userId)).credits).toBe(15);

    // A pack bought before PaymentIntents were stored
    const legacy = await ctx.prisma.paymentTransaction.create({
      data: {
        userId: buyer.userId,
        stripeSessionId: 'cs_legacy_pack',
        amountPln: 1000,
        creditsAdded: 5,
        status: 'completed',
        completedAt: new Date(),
      },
    });
    await ctx.prisma.user.update({ where: { id: buyer.userId }, data: { credits: { increment: 5 } } });
    stripe.sessionPaymentIntents.set('cs_legacy_pack', 'pi_legacy_pack');
    await deliver(ctx, stripe, refundEvent('pi_legacy_pack', 1000, 1000, { customer: buyer.customer })).expect(200);
    expect(await ctx.prisma.paymentTransaction.findUniqueOrThrow({ where: { id: legacy.id } })).toMatchObject({
      status: 'refunded',
      creditsReversed: 5,
      stripePaymentIntentId: 'pi_legacy_pack',
    });
    expect((await getCredits(ctx, buyer.userId)).credits).toBe(15);
    await expectBalanceMatchesLedger(ctx, buyer.userId);
  });

  it('[AC-PAY-024] parallel deliveries of the same completion and of the same refund change the balance exactly once', async () => {
    const buyer = await buy('credits_15', { pay: false });
    const completion = completedEvent(buyer.session.id, buyer.pi);
    const responses = await Promise.all(Array.from({ length: 12 }, () => deliver(ctx, stripe, completion)));
    expect(responses.map((r) => r.status)).toEqual(Array(12).fill(200));
    expect((await getCredits(ctx, buyer.userId)).credits).toBe(15);

    const refund = refundEvent(buyer.pi, 2800, 1400, { customer: buyer.customer });
    const refunds = await Promise.all(Array.from({ length: 12 }, () => deliver(ctx, stripe, refund)));
    expect(refunds.map((r) => r.status)).toEqual(Array(12).fill(200));
    expect(await txOf(buyer.session.id)).toMatchObject({ creditsReversed: 8 });
    expect((await getCredits(ctx, buyer.userId)).credits).toBe(7);
    expect(await ctx.prisma.stripeEvent.count()).toBe(1);
    expect(adminMails()).toHaveLength(1);

    // Different refund events of one charge racing each other: the largest running total wins.
    const totals = [1600, 2100, 2800, 1900, 2400];
    await Promise.all(
      totals.map((t) => deliver(ctx, stripe, refundEvent(buyer.pi, 2800, t, { customer: buyer.customer })).expect(200)),
    );
    expect(await txOf(buyer.session.id)).toMatchObject({
      status: 'refunded',
      amountRefunded: 2800,
      creditsReversed: 15,
    });
    expect((await getCredits(ctx, buyer.userId)).credits).toBe(0);
    await expectBalanceMatchesLedger(ctx, buyer.userId);
  });

  it('[AC-PAY-023] the plan list hides and the checkout refuses a plan whose Stripe price differs from plans.ts', async () => {
    process.env.STRIPE_PRICE_SUB_START = 'price_start_guard';
    process.env.STRIPE_PRICE_SUB_PRO = 'price_pro_guard';
    try {
      stripe.monthlyPrice('price_start_guard', 1900);
      stripe.monthlyPrice('price_pro_guard', 14900); // still the old 149 zł in Stripe
      const plans = await ctx.http().get('/api/payments/plans').expect(200);
      expect(plans.body.map((p: any) => [p.id, p.priceGrosze, p.available])).toEqual([
        ['sub_start', 1900, true],
        ['sub_pro', 5900, false],
      ]);

      const { token } = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/payments/subscribe')
        .set(auth(token))
        .send({ planId: 'sub_pro', acceptedWithdrawalWaiver: true })
        .expect(400);
      expect(stripe.sessions).toHaveLength(0);
      await ctx
        .http()
        .post('/api/payments/subscribe')
        .set(auth(token))
        .send({ planId: 'sub_start', acceptedWithdrawalWaiver: true })
        .expect(201);
      expect(stripe.sessions[0].line_items).toEqual([{ price: 'price_start_guard', quantity: 1 }]);
      // verdicts are cached: the list and both checkouts asked Stripe once per price
      expect(stripe.calls.priceRetrieve).toBe(2);
    } finally {
      delete process.env.STRIPE_PRICE_SUB_START;
      delete process.env.STRIPE_PRICE_SUB_PRO;
    }
  });
});
