import { TestContext } from './test-app';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require('stripe');

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

/**
 * In-memory Stripe for integration tests: the real SDK does the webhook signature maths, everything that
 * would touch the network is faked and recorded. Covers what PaymentsService uses – Checkout sessions
 * (create / retrieve / list by PaymentIntent), customers, prices (plan price guard), charges, invoice
 * payments (refund matching of subscription invoices), invoices and – for discount codes (specs 09 and 16) –
 * coupons and promotion codes.
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
  /** Params of every `checkout.sessions.retrieve` call (e.g. `expand` for the promotion code). */
  retrieveParams: any[] = [];
  coupons: any[] = [];
  deletedCoupons: string[] = [];
  promotionCodes = new Map<string, any>();
  promotionCalls = { create: 0, retrieve: 0, update: 0 };
  /** Errors thrown by the coupon / promotion code API (null = works). */
  couponCreateError: Error | null = null;
  promotionCreateError: Error | null = null;
  promotionRetrieveError: Error | null = null;
  promotionUpdateError: Error | null = null;
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
      retrieve: async (id: string, params?: any) => {
        this.calls.sessionRetrieve++;
        this.retrieveParams.push(params);
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

  readonly couponsApi = {
    create: async (params: any) => {
      if (this.couponCreateError) throw this.couponCreateError;
      const coupon = { id: `co_fake_${this.coupons.length + 1}`, object: 'coupon', valid: true, ...params };
      this.coupons.push(coupon);
      return coupon;
    },
    del: async (id: string) => {
      this.deletedCoupons.push(id);
      return { id, deleted: true };
    },
  };

  readonly promotionCodesApi = {
    create: async (params: any) => {
      this.promotionCalls.create++;
      if (this.promotionCreateError) throw this.promotionCreateError;
      const taken = [...this.promotionCodes.values()].some(
        (p) => p.active && String(p.code).toUpperCase() === String(params.code).toUpperCase(),
      );
      if (taken) {
        throw Object.assign(new Error(`An active promotion code with \`code: ${params.code}\` already exists.`), {
          type: 'StripeInvalidRequestError',
          statusCode: 400,
        });
      }
      return this.addPromotionCode(params.code, { ...params });
    },
    retrieve: async (id: string) => {
      this.promotionCalls.retrieve++;
      if (this.promotionRetrieveError) throw this.promotionRetrieveError;
      const promo = this.promotionCodes.get(id);
      if (!promo) throw Object.assign(new Error(`No such promotion code: '${id}'`), { statusCode: 404 });
      return promo;
    },
    update: async (id: string, params: any) => {
      this.promotionCalls.update++;
      if (this.promotionUpdateError) throw this.promotionUpdateError;
      const promo = this.promotionCodes.get(id);
      if (!promo) throw Object.assign(new Error(`No such promotion code: '${id}'`), { statusCode: 404 });
      Object.assign(promo, params);
      return promo;
    },
  };

  /** A promotion code as Stripe stores it (also one created outside AllGrafika, e.g. by the shop). */
  addPromotionCode(code: string, extra: Record<string, unknown> = {}) {
    const id = `promo_fake_${this.promotionCodes.size + 1}`;
    const promo = { id, object: 'promotion_code', code, active: true, times_redeemed: 0, ...extra };
    this.promotionCodes.set(id, promo);
    return promo;
  }

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
      coupons: this.couponsApi,
      promotionCodes: this.promotionCodesApi,
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
    this.retrieveParams = [];
    this.coupons = [];
    this.deletedCoupons = [];
    this.promotionCodes.clear();
    this.promotionCalls = { create: 0, retrieve: 0, update: 0 };
    this.couponCreateError = null;
    this.promotionCreateError = null;
    this.promotionRetrieveError = null;
    this.promotionUpdateError = null;
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

/**
 * `checkout.session.completed` of a pack bought with a discount code (spec 09, AC-PAY-027/028): Stripe reports the
 * paid `amount_total`, the discount in `total_details` and the code in `discounts` (an id unless expanded).
 * `paid: 0` is an order fully covered by a 100% code – no PaymentIntent, `payment_status: no_payment_required`.
 */
export function discountedCompletedEvent(
  sessionId: string,
  paymentIntent: string | null,
  amounts: { list: number; paid: number },
  promotionCode: string | { id: string; code: string } | null,
  extra: Record<string, unknown> = {},
) {
  return completedEvent(sessionId, paymentIntent as string, {
    payment_status: amounts.paid === 0 ? 'no_payment_required' : 'paid',
    ...(amounts.paid === 0 ? { payment_intent: null } : {}),
    currency: 'pln',
    amount_subtotal: amounts.list,
    amount_total: amounts.paid,
    total_details: { amount_discount: amounts.list - amounts.paid, amount_shipping: 0, amount_tax: 0 },
    ...(promotionCode ? { discounts: [{ coupon: 'co_any', promotion_code: promotionCode }] } : {}),
    ...extra,
  });
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
