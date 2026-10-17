import { TestContext } from './test-app';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require('stripe');

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

/**
 * In-memory Stripe for integration tests: the real SDK does the webhook signature maths, everything that
 * would touch the network is faked and recorded. Covers what PaymentsService uses – Checkout sessions
 * (create / retrieve / list by PaymentIntent), customers, prices (plan price guard), charges, invoice
 * payments (refund matching of subscription invoices) and invoices.
 */
export class FakeStripe {
  readonly sdk = new Stripe('sk_test_fake_key_for_tests', { apiVersion: '2026-03-25.dahlia' });
  readonly webhooks = this.sdk.webhooks;

  sessions: any[] = [];
  customers: any[] = [];
  deletedCustomers: string[] = [];
  /** PaymentIntent of a Checkout session, as Stripe would report it for `sessions.list({ payment_intent })`. */
  sessionPaymentIntents = new Map<string, string>();
  /** PaymentIntent → invoice id, for `invoicePayments.list`. */
  invoicePayments = new Map<string, string>();
  chargesById = new Map<string, any>();
  prices = new Map<string, any>();
  priceError: Error | null = null;
  calls = { sessionCreate: 0, sessionRetrieve: 0, sessionList: 0, invoicePaymentsList: 0, priceRetrieve: 0 };
  /** Widens race windows in concurrency tests. */
  createDelayMs = 0;

  readonly checkout = {
    sessions: {
      create: async (params: any) => {
        this.calls.sessionCreate++;
        if (this.createDelayMs) await sleep(this.createDelayMs);
        const id = `cs_fake_${this.sessions.length + 1}_${Math.random().toString(36).slice(2, 8)}`;
        const session = { id, url: `https://checkout.stripe.com/c/${id}`, status: 'open', ...params };
        this.sessions.push(session);
        return session;
      },
      retrieve: async (id: string) => {
        this.calls.sessionRetrieve++;
        const session = this.sessions.find((s) => s.id === id);
        if (!session) throw Object.assign(new Error(`No such checkout.session: ${id}`), { statusCode: 404 });
        return session;
      },
      list: async (params: { payment_intent?: string }) => {
        this.calls.sessionList++;
        const ids = [...this.sessionPaymentIntents.entries()]
          .filter(([, pi]) => pi === params.payment_intent)
          .map(([sessionId]) => sessionId);
        return { data: ids.map((id) => ({ id, object: 'checkout.session' })) };
      },
    },
  };

  readonly customersApi = {
    create: async (params: any) => {
      const customer = { id: `cus_fake_${this.customers.length + 1}`, ...params };
      this.customers.push(customer);
      return customer;
    },
    del: async (id: string) => {
      this.deletedCustomers.push(id);
      return { id, deleted: true };
    },
  };

  readonly invoicePaymentsApi = {
    list: async (params: { payment?: { payment_intent?: string } }) => {
      this.calls.invoicePaymentsList++;
      const invoice = params.payment?.payment_intent && this.invoicePayments.get(params.payment.payment_intent);
      return { data: invoice ? [{ invoice, payment: { type: 'payment_intent' } }] : [] };
    },
  };

  readonly pricesApi = {
    retrieve: async (id: string) => {
      this.calls.priceRetrieve++;
      if (this.priceError) throw this.priceError;
      const price = this.prices.get(id);
      if (!price) throw Object.assign(new Error(`No such price: '${id}'`), { statusCode: 404 });
      return price;
    },
  };

  readonly chargesApi = {
    retrieve: async (id: string) => {
      const charge = this.chargesById.get(id);
      if (!charge) throw Object.assign(new Error(`No such charge: '${id}'`), { statusCode: 404 });
      return charge;
    },
  };

  readonly invoicesApi = {
    retrieve: async (id: string) => ({ id, invoice_pdf: `https://pay.stripe.com/invoice/${id}/pdf` }),
  };

  /** The object handed to PaymentsService.setStripeClient. */
  client() {
    return {
      webhooks: this.webhooks,
      checkout: this.checkout,
      customers: this.customersApi,
      invoicePayments: this.invoicePaymentsApi,
      prices: this.pricesApi,
      charges: this.chargesApi,
      invoices: this.invoicesApi,
      subscriptions: { retrieve: async () => Promise.reject(new Error('not faked')) },
      billingPortal: { sessions: { create: async () => ({ url: 'https://billing.stripe.com/p' }) } },
    };
  }

  /** A monthly PLN price as created in the dashboard. */
  monthlyPrice(id: string, unitAmount: number, overrides: Record<string, unknown> = {}) {
    this.prices.set(id, {
      id,
      object: 'price',
      active: true,
      currency: 'pln',
      type: 'recurring',
      recurring: { interval: 'month', interval_count: 1 },
      unit_amount: unitAmount,
      ...overrides,
    });
  }

  reset() {
    this.sessions = [];
    this.customers = [];
    this.deletedCustomers = [];
    this.sessionPaymentIntents.clear();
    this.invoicePayments.clear();
    this.chargesById.clear();
    this.prices.clear();
    this.priceError = null;
    this.createDelayMs = 0;
    this.calls = { sessionCreate: 0, sessionRetrieve: 0, sessionList: 0, invoicePaymentsList: 0, priceRetrieve: 0 };
  }

  signed(event: object) {
    const payload = JSON.stringify(event);
    return { payload, signature: this.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) };
  }
}

let eventCounter = 0;
/** Unique Stripe event id. */
export function eventId(prefix = 'evt'): string {
  eventCounter++;
  return `${prefix}_${Date.now().toString(36)}_${eventCounter}`;
}

/** Delivers a signed webhook; returns the HTTP response (status is not asserted here). */
export function deliver(ctx: TestContext, stripe: FakeStripe, event: object) {
  const { payload, signature } = stripe.signed(event);
  return ctx
    .http()
    .post('/api/payments/webhook')
    .set('stripe-signature', signature)
    .set('Content-Type', 'application/json')
    .send(payload);
}

export function completedEvent(sessionId: string, paymentIntent: string, extra: Record<string, unknown> = {}) {
  return {
    id: eventId(),
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: sessionId, payment_status: 'paid', payment_intent: paymentIntent, ...extra } },
  };
}

export function refundEvent(
  paymentIntent: string,
  amount: number,
  amountRefunded: number,
  extra: Record<string, unknown> = {},
) {
  return {
    id: eventId(),
    type: 'charge.refunded',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `ch_${paymentIntent}`,
        object: 'charge',
        payment_intent: paymentIntent,
        amount,
        amount_refunded: amountRefunded,
        refunded: amountRefunded >= amount,
        ...extra,
      },
    },
  };
}

export function disputeEvent(
  type: 'charge.dispute.created' | 'charge.dispute.closed',
  paymentIntent: string,
  amount: number,
  status: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id: eventId(),
    type,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `dp_${paymentIntent}`,
        object: 'dispute',
        charge: `ch_${paymentIntent}`,
        payment_intent: paymentIntent,
        amount,
        status,
        ...extra,
      },
    },
  };
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
