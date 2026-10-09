import { createTestApp, getCredits, registerUser, resetDatabase, TestContext } from './test-app';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require('stripe');

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

function signedWebhook(stripe: any, event: object) {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { payload, signature };
}

describe('Payments (integration)', () => {
  let ctx: TestContext;
  let stripe: any;
  let createdSessions: any[];
  let createdCustomers: any[];

  beforeAll(async () => {
    ctx = await createTestApp();
    // Real Stripe SDK for signature math, fake network for session creation.
    stripe = new Stripe('sk_test_fake_key_for_tests', { apiVersion: '2026-03-25.dahlia' });
    stripe.checkout = {
      sessions: {
        create: async (params: any) => {
          const session = {
            id: `cs_test_${createdSessions.length + 1}`,
            url: 'https://checkout.stripe.com/test',
            ...params,
          };
          createdSessions.push(session);
          return session;
        },
      },
    };
    stripe.customers = {
      create: async (params: any) => {
        const customer = { id: `cus_test_${createdCustomers.length + 1}`, ...params };
        createdCustomers.push(customer);
        return customer;
      },
    };
    stripe.invoices = {
      retrieve: async (id: string) => ({ id, invoice_pdf: `https://pay.stripe.com/invoice/${id}/pdf?s=fresh` }),
    };
    ctx.payments.setStripeClient(stripe);
  });
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    createdSessions = [];
    createdCustomers = [];
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('[AC-PAY-001] lists packages publicly', async () => {
    const res = await ctx.http().get('/api/payments/packages').expect(200);
    expect(res.body.map((p: any) => p.id)).toEqual(['credits_5', 'credits_15', 'credits_40', 'credits_200']);
  });

  it('[AC-PRC-009] the 200-credit pack costs 99 zł and adds 200 credits after payment', async () => {
    const res = await ctx.http().get('/api/payments/packages').expect(200);
    expect(res.body.find((p: any) => p.id === 'credits_200')).toMatchObject({
      credits: 200,
      priceGrosze: 9900,
      priceLabel: '99 zł',
    });

    const { token, userId } = await registerUser(ctx);
    await ctx
      .http()
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: 'credits_200', acceptedWithdrawalWaiver: true })
      .expect(201);
    const session = createdSessions.at(-1);
    expect(session.line_items[0].price_data.unit_amount).toBe(9900);
    const { payload, signature } = signedWebhook(stripe, {
      id: 'evt_200',
      type: 'checkout.session.completed',
      data: { object: { id: session.id, payment_status: 'paid', metadata: session.metadata } },
    });
    await ctx
      .http()
      .post('/api/payments/webhook')
      .set('stripe-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(200);
    expect((await getCredits(ctx, userId)).credits).toBe(200);
  });

  it('[AC-PAY-002] requires the consumer-law withdrawal waiver before checkout', async () => {
    const { token } = await registerUser(ctx);
    await ctx
      .http()
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: 'credits_15' })
      .expect(400);
    await ctx
      .http()
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: 'credits_15', acceptedWithdrawalWaiver: false })
      .expect(400);
    expect(createdSessions).toHaveLength(0);
  });

  it('[AC-PAY-003] creates a checkout session and a pending transaction', async () => {
    const { token, userId, email } = await registerUser(ctx);
    const res = await ctx
      .http()
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: 'credits_15', acceptedWithdrawalWaiver: true })
      .expect(201);
    expect(res.body.url).toBe('https://checkout.stripe.com/test');

    expect(createdSessions[0]).toMatchObject({
      mode: 'payment',
      customer: 'cus_test_1',
      metadata: { userId, packageId: 'credits_15', credits: '15' },
      payment_intent_data: { statement_descriptor_suffix: 'ALLGRAFIKA' },
    });
    expect(createdSessions[0].line_items[0].price_data.unit_amount).toBe(2800);
    expect(createdCustomers[0]).toMatchObject({ email, metadata: { userId } });

    const tx = await ctx.prisma.paymentTransaction.findFirstOrThrow({ where: { userId } });
    expect(tx).toMatchObject({ status: 'pending', creditsAdded: 15, amountPln: 2800, stripeSessionId: 'cs_test_1' });

    await ctx
      .http()
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: 'credits_999', acceptedWithdrawalWaiver: true })
      .expect(400);
  });

  it('[AC-PAY-004] adds credits exactly once per completed session (idempotent webhook)', async () => {
    const { token, userId } = await registerUser(ctx);
    await ctx
      .http()
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: 'credits_5', acceptedWithdrawalWaiver: true })
      .expect(201);

    const event = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_1', payment_status: 'paid', metadata: { credits: '5' } } },
    };
    const { payload, signature } = signedWebhook(stripe, event);

    await ctx
      .http()
      .post('/api/payments/webhook')
      .set('stripe-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(200);
    expect(await getCredits(ctx, userId)).toMatchObject({ credits: 5 });

    // Stripe retries – second delivery must be a no-op.
    await ctx
      .http()
      .post('/api/payments/webhook')
      .set('stripe-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(200);
    expect(await getCredits(ctx, userId)).toMatchObject({ credits: 5 });

    const history = await ctx.http().get('/api/payments/history').set('Authorization', `Bearer ${token}`).expect(200);
    expect(history.body[0]).toMatchObject({ status: 'completed', creditsAdded: 5 });
  });

  it('grants credits on checkout.session.async_payment_succeeded (BLIK / Przelewy24)', async () => {
    const { token, userId } = await registerUser(ctx);
    await ctx
      .http()
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: 'credits_15', acceptedWithdrawalWaiver: true })
      .expect(201);

    const pending = signedWebhook(stripe, {
      id: 'evt_a1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_1', payment_status: 'unpaid' } },
    });
    await ctx
      .http()
      .post('/api/payments/webhook')
      .set('stripe-signature', pending.signature)
      .set('Content-Type', 'application/json')
      .send(pending.payload)
      .expect(200);
    expect(await getCredits(ctx, userId)).toMatchObject({ credits: 0 });

    const paid = signedWebhook(stripe, {
      id: 'evt_a2',
      type: 'checkout.session.async_payment_succeeded',
      data: { object: { id: 'cs_test_1', payment_status: 'paid' } },
    });
    await ctx
      .http()
      .post('/api/payments/webhook')
      .set('stripe-signature', paid.signature)
      .set('Content-Type', 'application/json')
      .send(paid.payload)
      .expect(200);
    expect(await getCredits(ctx, userId)).toMatchObject({ credits: 15 });
  });

  it('[AC-PAY-005] marks the transaction failed on checkout.session.async_payment_failed', async () => {
    const { token, userId } = await registerUser(ctx);
    await ctx
      .http()
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: 'credits_5', acceptedWithdrawalWaiver: true })
      .expect(201);
    const failed = signedWebhook(stripe, {
      id: 'evt_f1',
      type: 'checkout.session.async_payment_failed',
      data: { object: { id: 'cs_test_1' } },
    });
    await ctx
      .http()
      .post('/api/payments/webhook')
      .set('stripe-signature', failed.signature)
      .set('Content-Type', 'application/json')
      .send(failed.payload)
      .expect(200);
    const tx = await ctx.prisma.paymentTransaction.findFirstOrThrow({ where: { userId } });
    expect(tx.status).toBe('failed');
    expect(await getCredits(ctx, userId)).toMatchObject({ credits: 0 });
  });

  it('[AC-PAY-006] ignores unpaid sessions and marks expired ones', async () => {
    const { token, userId } = await registerUser(ctx);
    await ctx
      .http()
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packageId: 'credits_5', acceptedWithdrawalWaiver: true })
      .expect(201);

    const unpaid = signedWebhook(stripe, {
      id: 'evt_2',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_1', payment_status: 'unpaid' } },
    });
    await ctx
      .http()
      .post('/api/payments/webhook')
      .set('stripe-signature', unpaid.signature)
      .set('Content-Type', 'application/json')
      .send(unpaid.payload)
      .expect(200);
    expect(await getCredits(ctx, userId)).toMatchObject({ credits: 0 });

    const expired = signedWebhook(stripe, {
      id: 'evt_3',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_test_1' } },
    });
    await ctx
      .http()
      .post('/api/payments/webhook')
      .set('stripe-signature', expired.signature)
      .set('Content-Type', 'application/json')
      .send(expired.payload)
      .expect(200);
    const tx = await ctx.prisma.paymentTransaction.findFirstOrThrow({ where: { userId } });
    expect(tx.status).toBe('expired');
  });

  it('rejects webhooks with a bad or missing signature', async () => {
    const { payload } = signedWebhook(stripe, {
      id: 'evt_4',
      type: 'checkout.session.completed',
      data: { object: { id: 'x' } },
    });
    await ctx.http().post('/api/payments/webhook').set('Content-Type', 'application/json').send(payload).expect(400);
    await ctx
      .http()
      .post('/api/payments/webhook')
      .set('stripe-signature', 't=1,v1=deadbeef')
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(400);
  });

  describe('invoices with a tax id (spec 09)', () => {
    const webhook = (event: object) => {
      const { payload, signature } = signedWebhook(stripe, event);
      return ctx
        .http()
        .post('/api/payments/webhook')
        .set('stripe-signature', signature)
        .set('Content-Type', 'application/json')
        .send(payload)
        .expect(200);
    };

    it('[AC-PAY-012] checkout asks for the billing address and tax id and creates an invoice', async () => {
      const { token, userId } = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({ packageId: 'credits_5', acceptedWithdrawalWaiver: true })
        .expect(201);
      expect(createdSessions[0]).toMatchObject({
        mode: 'payment',
        customer: 'cus_test_1',
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        customer_update: { name: 'auto', address: 'auto' },
        invoice_creation: { enabled: true, invoice_data: { metadata: { userId, packageId: 'credits_5' } } },
      });
      expect(createdSessions[0]).not.toHaveProperty('customer_email');

      // the Stripe customer is reused (it remembers the company details)
      await ctx
        .http()
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({ packageId: 'credits_5', acceptedWithdrawalWaiver: true })
        .expect(201);
      expect(createdCustomers).toHaveLength(1);
      expect(createdSessions[1].customer).toBe('cus_test_1');
    });

    it('[AC-PAY-012] the subscription checkout collects the same invoice details', async () => {
      process.env.STRIPE_PRICE_SUB_START = 'price_start_test';
      const { token } = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/payments/subscribe')
        .set('Authorization', `Bearer ${token}`)
        .send({ planId: 'sub_start', acceptedWithdrawalWaiver: true })
        .expect(201);
      expect(createdSessions[0]).toMatchObject({
        mode: 'subscription',
        customer: 'cus_test_1',
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        customer_update: { name: 'auto', address: 'auto' },
      });
    });

    it('[AC-PAY-013] stores the invoice id from the paid session and the subscription invoice', async () => {
      const { token, userId } = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/payments/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({ packageId: 'credits_5', acceptedWithdrawalWaiver: true })
        .expect(201);
      await webhook({
        id: 'evt_inv_1',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_1', payment_status: 'paid', invoice: 'in_pack_1' } },
      });
      const tx = await ctx.prisma.paymentTransaction.findFirstOrThrow({ where: { userId } });
      expect(tx).toMatchObject({ status: 'completed', stripeInvoiceId: 'in_pack_1' });

      process.env.STRIPE_PRICE_SUB_START = 'price_start_test';
      await ctx.prisma.subscription.create({
        data: { userId, stripeSubscriptionId: 'sub_1', planId: 'sub_start', status: 'active' },
      });
      await webhook({
        id: 'evt_inv_2',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_sub_1',
            billing_reason: 'subscription_create',
            amount_paid: 4900,
            parent: { subscription_details: { subscription: 'sub_1', metadata: { planId: 'sub_start', userId } } },
            lines: { data: [{ amount: 4900, pricing: { price_details: { price: 'price_start_test' } } }] },
          },
        },
      });
      const history = await ctx.http().get('/api/payments/history').set('Authorization', `Bearer ${token}`).expect(200);
      expect(history.body).toHaveLength(2);
      for (const row of history.body) {
        expect(row.hasInvoice).toBe(true);
        expect(row).not.toHaveProperty('stripeInvoiceId');
      }
    });

    it('[AC-PAY-014] returns a fresh invoice link only to the owner', async () => {
      const owner = await registerUser(ctx);
      const other = await registerUser(ctx);
      const withInvoice = await ctx.prisma.paymentTransaction.create({
        data: {
          userId: owner.userId,
          stripeSessionId: 'cs_x',
          amountPln: 1000,
          creditsAdded: 5,
          status: 'completed',
          stripeInvoiceId: 'in_abc',
        },
      });
      const withoutInvoice = await ctx.prisma.paymentTransaction.create({
        data: { userId: owner.userId, stripeSessionId: 'cs_y', amountPln: 1000, creditsAdded: 5, status: 'completed' },
      });

      const res = await ctx
        .http()
        .get(`/api/payments/invoices/${withInvoice.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(200);
      expect(res.body).toEqual({ url: 'https://pay.stripe.com/invoice/in_abc/pdf?s=fresh' });

      await ctx
        .http()
        .get(`/api/payments/invoices/${withInvoice.id}`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(404);
      await ctx
        .http()
        .get(`/api/payments/invoices/${withoutInvoice.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(404);
    });
  });
});
