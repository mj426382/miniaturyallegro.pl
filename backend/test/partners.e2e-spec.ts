import { createTestApp, getCredits, registerUser, resetDatabase, TestContext, uniqueEmail } from './test-app';
import {
  completedEvent,
  deliver,
  discountedCompletedEvent,
  disputeEvent,
  eventId,
  FakeStripe,
  refundEvent,
} from './stripe-fake';
import { expectBalanceMatchesLedger } from './ledger';
import { AdminGuard } from '../src/admin/admin.guard';
import { commissionOf, customerRef, todayInPoland } from '../src/partners/commission';
import { netPaidGrosze } from '../src/admin/revenue';

const PRICES: Record<string, number> = { credits_5: 1000, credits_15: 2800, credits_40: 7000, credits_200: 9900 };
const DAY = 24 * 60 * 60;
/** Unix seconds of an ISO instant – the `created` time of a Stripe event. */
const at = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const now = () => Math.floor(Date.now() / 1000);

type Account = { token: string; userId: string; email: string };

/**
 * Partner programme (spec 24, AC-PRT-001..014): partners and codes in the panel, attribution of customers on a paid
 * pack checkout with a partner's code, the commission ledger (packages, subscription invoices, refunds, disputes,
 * months in Europe/Warsaw), payouts and the balance. Real database, signed webhooks, fake Stripe; only test addresses.
 */
describe('partner programme (integration)', () => {
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

  // ─── helpers ──────────────────────────────────────────────────────

  async function makeAdmin() {
    const admin = await registerUser(ctx, uniqueEmail('owner'));
    (ctx.app.get(AdminGuard) as any).admins = new Set([admin.email]);
    return admin;
  }

  async function createPartner(admin: Account, body: Record<string, unknown> = {}) {
    const res = await ctx
      .http()
      .post('/api/admin/partners')
      .set(auth(admin.token))
      .send({ name: 'Katalog Firm', contactEmail: uniqueEmail('partner'), ...body })
      .expect(201);
    return res.body;
  }

  const detail = async (admin: Account, partnerId: string) =>
    (await ctx.http().get(`/api/admin/partners/${partnerId}`).set(auth(admin.token)).expect(200)).body;
  const list = async (admin: Account) =>
    (await ctx.http().get('/api/admin/partners').set(auth(admin.token)).expect(200)).body;

  /**
   * Buys a pack through the API and delivers its `checkout.session.completed` (Stripe event time `created`). With a
   * code, `paid` is what Stripe charged after the discount (the expanded promotion code needs no Stripe lookup).
   */
  async function buy(
    user: Account,
    options: { packageId?: string; code?: string | null; paid?: number; created?: number; expanded?: boolean } = {},
  ) {
    const packageId = options.packageId ?? 'credits_15';
    const list = PRICES[packageId];
    await ctx
      .http()
      .post('/api/payments/checkout')
      .set(auth(user.token))
      .send({ packageId, acceptedWithdrawalWaiver: true })
      .expect(201);
    const session = stripe.sessions.at(-1);
    const paid = options.paid ?? (options.code ? Math.round(list * 0.9) : list);
    const pi = `pi_${session.id}`;
    stripe.sessionPaymentIntents.set(session.id, pi);
    let event: any;
    if (options.code) {
      const promo =
        options.expanded === false
          ? stripe.addPromotionCode(options.code).id
          : { id: `promo_${options.code}`, code: options.code };
      event = discountedCompletedEvent(session.id, paid === 0 ? null : pi, { list, paid }, promo);
    } else {
      event = completedEvent(session.id, pi, {
        currency: 'pln',
        amount_total: paid,
        total_details: { amount_discount: 0 },
      });
    }
    event.created = options.created ?? now();
    await deliver(ctx, stripe, event).expect(200);
    const tx = await ctx.prisma.paymentTransaction.findUniqueOrThrow({ where: { stripeSessionId: session.id } });
    return { session, pi, event, tx, paid, customer: session.customer as string };
  }

  /** `invoice.paid` of the account's subscription (create or cycle), paid `amount` grosze at `created`. */
  async function payInvoice(user: Account, amount: number, created: number, reason = 'subscription_cycle') {
    const subId = `sub_${user.userId}`;
    await ctx.prisma.subscription.upsert({
      where: { userId: user.userId },
      create: { userId: user.userId, stripeSubscriptionId: subId, planId: 'sub_start', status: 'active' },
      update: {},
    });
    const invoiceId = `in_${eventId('inv')}`;
    const event = {
      id: eventId(),
      type: 'invoice.paid',
      created,
      data: {
        object: {
          id: invoiceId,
          billing_reason: reason,
          amount_paid: amount,
          parent: {
            subscription_details: { subscription: subId, metadata: { planId: 'sub_start', userId: user.userId } },
          },
          payments: { data: [{ payment: { type: 'payment_intent', payment_intent: `pi_${invoiceId}` } }] },
        },
      },
    };
    await deliver(ctx, stripe, event).expect(200);
    const tx = await ctx.prisma.paymentTransaction.findUnique({ where: { stripeSessionId: invoiceId } });
    return { invoiceId, pi: `pi_${invoiceId}`, tx, event };
  }

  /** A code created in the panel (no partner) – e.g. a code from before the programme. */
  async function plainCode(admin: Account, code: string, percentOff = 10) {
    await ctx
      .http()
      .post('/api/admin/discount-codes')
      .set(auth(admin.token))
      .send({ code, type: 'percent', percentOff })
      .expect(201);
  }

  const entriesOf = (transactionId: string) =>
    ctx.prisma.partnerCommission.findMany({ where: { transactionId }, orderBy: { createdAt: 'asc' } });
  const sumOf = async (transactionId: string) => {
    const rows = await entriesOf(transactionId);
    return {
      net: rows.reduce((s, r) => s + r.netPaidGrosze, 0),
      commission: rows.reduce((s, r) => s + r.commissionGrosze, 0),
    };
  };
  const userRow = (userId: string) => ctx.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const withCreated = <T extends { created?: number }>(event: T, created: number) => ({ ...event, created });

  // ─── Admin: partners and codes ────────────────────────────────────

  describe('admin: partners and codes', () => {
    it('[AC-PRT-001] a partner with only a name and e-mail gets the approved defaults and no code', async () => {
      const admin = await makeAdmin();
      const contactEmail = uniqueEmail('Partner');
      const res = await ctx
        .http()
        .post('/api/admin/partners')
        .set(auth(admin.token))
        .send({ name: '  Blog Sprzedawcy ', contactEmail: `  ${contactEmail.toUpperCase()} ` })
        .expect(201);
      expect(res.body).toMatchObject({
        name: 'Blog Sprzedawcy',
        contactEmail: contactEmail.toLowerCase(),
        companyName: null,
        nip: null,
        customerDiscountPercent: 10,
        commissionPercent: 20,
        commissionMonths: 12,
        active: true,
        note: null,
        codes: [],
        customers: 0,
        currentMonth: { orders: 0, netPaidGrosze: 0, commissionGrosze: 0 },
        allTime: { orders: 0, netPaidGrosze: 0, commissionGrosze: 0 },
        paidOutGrosze: 0,
        balanceGrosze: 0,
        createdBy: admin.email,
      });
      expect(stripe.coupons).toHaveLength(0);
    });

    it('[AC-PRT-001] creating a partner with company, NIP, note and a code creates the Stripe code linked to the partner', async () => {
      const admin = await makeAdmin();
      const expiresAt = new Date(Date.now() + 30 * DAY * 1000).toISOString();
      const partner = await createPartner(admin, {
        name: 'Katalog Firm Przykład',
        companyName: ' Przykład sp. z o.o. ',
        nip: 'PL 526-000-12-46',
        note: 'Umowa z 19.10.2026',
        customerDiscountPercent: 15,
        commissionPercent: 25,
        commissionMonths: 6,
        code: 'katalog-15',
        codeMaxRedemptions: 300,
        codeExpiresAt: expiresAt,
      });
      expect(partner).toMatchObject({
        companyName: 'Przykład sp. z o.o.',
        nip: '5260001246',
        note: 'Umowa z 19.10.2026',
        customerDiscountPercent: 15,
        commissionPercent: 25,
        commissionMonths: 6,
        codes: [{ code: 'KATALOG-15', type: 'percent', percentOff: 15, status: 'active', expiresAt }],
      });
      expect(stripe.coupons).toEqual([
        expect.objectContaining({ duration: 'once', percent_off: 15, name: 'KATALOG-15' }),
      ]);
      const [promo] = [...stripe.promotionCodes.values()];
      expect(promo).toMatchObject({
        code: 'KATALOG-15',
        max_redemptions: 300,
        expires_at: Math.floor(Date.parse(expiresAt) / 1000),
      });
      const code = await ctx.prisma.discountCode.findUniqueOrThrow({ where: { code: 'KATALOG-15' } });
      expect(code).toMatchObject({ partnerId: partner.id, note: 'Katalog Firm Przykład', percentOff: 15 });
      expect(JSON.stringify(partner)).not.toMatch(/promo_fake|co_fake|stripe/i);
    });

    const invalid: Array<[string, Record<string, unknown>, RegExp]> = [
      ['a missing name', { name: undefined }, /Podaj nazwę partnera|od 2 do 100 znaków/],
      ['a one-letter name', { name: 'A' }, /Nazwa partnera musi mieć od 2 do 100 znaków/],
      ['a too long name', { name: 'A'.repeat(101) }, /Nazwa partnera musi mieć od 2 do 100 znaków/],
      ['a missing e-mail', { contactEmail: undefined }, /Podaj poprawny adres e-mail partnera/],
      ['a bad e-mail', { contactEmail: 'partner@' }, /Podaj poprawny adres e-mail partnera/],
      ['a NIP with a wrong check digit', { nip: '5260001245' }, /NIP musi mieć 10 cyfr z poprawną cyfrą kontrolną/],
      ['a short NIP', { nip: '526000124' }, /NIP musi mieć 10 cyfr/],
      ['a too long company name', { companyName: 'F'.repeat(201) }, /Nazwa firmy może mieć maksymalnie 200 znaków/],
      ['a discount of 0%', { customerDiscountPercent: 0 }, /Rabat dla klientów musi być liczbą całkowitą od 1 do 100/],
      ['a discount of 101%', { customerDiscountPercent: 101 }, /od 1 do 100/],
      ['a fractional discount', { customerDiscountPercent: 10.5 }, /od 1 do 100/],
      ['a commission of 0%', { commissionPercent: 0 }, /Prowizja musi być liczbą całkowitą od 1 do 50/],
      ['a commission of 51%', { commissionPercent: 51 }, /Prowizja musi być liczbą całkowitą od 1 do 50/],
      ['a commission as text', { commissionPercent: '20' }, /Prowizja musi być liczbą całkowitą od 1 do 50/],
      ['a period of 0 months', { commissionMonths: 0 }, /Okres prowizji musi być liczbą całkowitą od 1 do 60 miesięcy/],
      ['a period of 61 months', { commissionMonths: 61 }, /od 1 do 60 miesięcy/],
      ['active as text', { active: 'tak' }, /Pole „aktywny” musi mieć wartość tak albo nie/],
      ['a too long note', { note: 'n'.repeat(501) }, /Notatka może mieć maksymalnie 500 znaków/],
      ['a bad code', { code: 'ZNIŻKA' }, /Kod może mieć 3–30 znaków/],
      ['a too short code', { code: 'AB' }, /Kod może mieć 3–30 znaków/],
      ['a code limit of 0', { code: 'PARTNER-OK', codeMaxRedemptions: 0 }, /Limit użyć musi wynosić co najmniej 1/],
      ['a bad code expiry', { code: 'PARTNER-OK', codeExpiresAt: '31.12.2026' }, /Nieprawidłowa data ważności/],
      [
        'a past code expiry',
        { code: 'PARTNER-OK', codeExpiresAt: '2020-01-01T00:00:00.000Z' },
        /Data ważności musi być w przyszłości/,
      ],
      ['an unknown field', { iban: 'PL00 0000' }, /iban/],
    ];
    it.each(invalid)(
      '[AC-PRT-002] %s → 400 with a Polish message, no Stripe call, nothing saved',
      async (_, body, message) => {
        const admin = await makeAdmin();
        const payload: Record<string, unknown> = {
          name: 'Katalog Firm',
          contactEmail: uniqueEmail('partner'),
          ...body,
        };
        for (const key of Object.keys(payload)) if (payload[key] === undefined) delete payload[key];
        const res = await ctx.http().post('/api/admin/partners').set(auth(admin.token)).send(payload).expect(400);
        const text = Array.isArray(res.body.message) ? res.body.message.join(' ') : res.body.message;
        expect(text).toMatch(message);
        expect(stripe.coupons).toHaveLength(0);
        expect(stripe.promotionCalls.create).toBe(0);
        expect(await ctx.prisma.partner.count()).toBe(0);
      },
    );

    it('[AC-PRT-002] a code that already exists (ours or in Stripe) or a Stripe failure leaves no partner behind', async () => {
      const admin = await makeAdmin();
      await plainCode(admin, 'TAKEN-10');
      const before = stripe.coupons.length;

      // already in our table → 409 before Stripe
      const dup = await ctx
        .http()
        .post('/api/admin/partners')
        .set(auth(admin.token))
        .send({ name: 'Partner A', contactEmail: uniqueEmail('partner'), code: 'taken-10' })
        .expect(409);
      expect(dup.body.message).toBe('Taki kod już istnieje – wybierz inny');
      expect(stripe.coupons).toHaveLength(before);

      // an active code of the shop in Stripe → 409, the coupon is removed
      stripe.addPromotionCode('SKLEP-10');
      await ctx
        .http()
        .post('/api/admin/partners')
        .set(auth(admin.token))
        .send({ name: 'Partner B', contactEmail: uniqueEmail('partner'), code: 'SKLEP-10' })
        .expect(409);

      // Stripe down → 503
      stripe.couponCreateError = Object.assign(new Error('Stripe is down'), { statusCode: 500 });
      const down = await ctx
        .http()
        .post('/api/admin/partners')
        .set(auth(admin.token))
        .send({ name: 'Partner C', contactEmail: uniqueEmail('partner'), code: 'NOWY-10' })
        .expect(503);
      expect(down.body.message).toMatch(/Nie udało się utworzyć kodu w Stripe/);

      expect(await ctx.prisma.partner.count()).toBe(0);
      expect(await ctx.prisma.discountCode.count()).toBe(1);
      expect(stripe.deletedCoupons.length).toBeGreaterThanOrEqual(1);
    });

    it('[AC-PRT-003] edits a partner, clears optional fields, deactivates it and refuses bad values and unknown ids', async () => {
      const admin = await makeAdmin();
      const partner = await createPartner(admin, { companyName: 'Firma', nip: '5260001246', note: 'Notatka' });
      const res = await ctx
        .http()
        .patch(`/api/admin/partners/${partner.id}`)
        .set(auth(admin.token))
        .send({
          name: 'Nowa nazwa',
          companyName: '',
          nip: '',
          note: '  ',
          commissionPercent: 30,
          commissionMonths: 24,
          active: false,
        })
        .expect(200);
      expect(res.body).toMatchObject({
        name: 'Nowa nazwa',
        contactEmail: partner.contactEmail,
        companyName: null,
        nip: null,
        note: null,
        customerDiscountPercent: 10,
        commissionPercent: 30,
        commissionMonths: 24,
        active: false,
      });
      // a partial update keeps everything else
      const back = await ctx
        .http()
        .patch(`/api/admin/partners/${partner.id}`)
        .set(auth(admin.token))
        .send({ active: true })
        .expect(200);
      expect(back.body).toMatchObject({ name: 'Nowa nazwa', commissionPercent: 30, active: true });

      for (const body of [
        { commissionPercent: 60 },
        { nip: '5260001245' },
        { name: 'X' },
        { contactEmail: 'nie-mail' },
      ]) {
        await ctx.http().patch(`/api/admin/partners/${partner.id}`).set(auth(admin.token)).send(body).expect(400);
      }
      const missing = await ctx
        .http()
        .patch('/api/admin/partners/does-not-exist')
        .set(auth(admin.token))
        .send({ active: false })
        .expect(404);
      expect(missing.body.message).toBe('Nie znaleziono partnera');
    });

    it('[AC-PRT-004] links an existing code, creates another code for the partner and unlinks a code', async () => {
      const admin = await makeAdmin();
      await plainCode(admin, 'SMARTNET20', 20);
      const partner = await createPartner(admin, { customerDiscountPercent: 12 });
      const other = await createPartner(admin, { name: 'Inny partner' });

      const linked = await ctx
        .http()
        .post(`/api/admin/partners/${partner.id}/codes/link`)
        .set(auth(admin.token))
        .send({ code: ' smartnet20 ' })
        .expect(200);
      expect(linked.body.codes).toEqual([
        expect.objectContaining({ code: 'SMARTNET20', percentOff: 20, status: 'active' }),
      ]);
      // linking again to the same partner is harmless; to another partner it is a conflict
      await ctx
        .http()
        .post(`/api/admin/partners/${partner.id}/codes/link`)
        .set(auth(admin.token))
        .send({ code: 'SMARTNET20' })
        .expect(200);
      const conflict = await ctx
        .http()
        .post(`/api/admin/partners/${other.id}/codes/link`)
        .set(auth(admin.token))
        .send({ code: 'SMARTNET20' })
        .expect(409);
      expect(conflict.body.message).toBe('Ten kod jest już podłączony do innego partnera');
      const unknown = await ctx
        .http()
        .post(`/api/admin/partners/${partner.id}/codes/link`)
        .set(auth(admin.token))
        .send({ code: 'NIE-MA-TAKIEGO' })
        .expect(404);
      expect(unknown.body.message).toMatch(/Nie znaleziono kodu rabatowego/);
      await ctx
        .http()
        .post(`/api/admin/partners/${partner.id}/codes/link`)
        .set(auth(admin.token))
        .send({ code: 'zły kod' })
        .expect(400);

      // another code uses the partner's discount
      const second = await ctx
        .http()
        .post(`/api/admin/partners/${partner.id}/codes`)
        .set(auth(admin.token))
        .send({ code: 'katalog-2027', maxRedemptions: 50 })
        .expect(201);
      expect(second.body.codes.map((c: any) => c.code).sort()).toEqual(['KATALOG-2027', 'SMARTNET20']);
      expect(stripe.coupons.at(-1)).toMatchObject({ percent_off: 12, name: 'KATALOG-2027' });
      await ctx
        .http()
        .post(`/api/admin/partners/${partner.id}/codes`)
        .set(auth(admin.token))
        .send({ code: 'SMARTNET20' })
        .expect(409);

      // the discount code list shows the partner
      const codes = await ctx.http().get('/api/admin/discount-codes').set(auth(admin.token)).expect(200);
      const byCode = new Map(codes.body.codes.map((c: any) => [c.code, c.partner]));
      expect(byCode.get('SMARTNET20')).toEqual({ id: partner.id, name: 'Katalog Firm' });
      expect(byCode.get('KATALOG-2027')).toEqual({ id: partner.id, name: 'Katalog Firm' });

      // unlink: only a code of this partner
      const smartnet = await ctx.prisma.discountCode.findUniqueOrThrow({ where: { code: 'SMARTNET20' } });
      await ctx
        .http()
        .post(`/api/admin/partners/${other.id}/codes/${smartnet.id}/unlink`)
        .set(auth(admin.token))
        .expect(404);
      const unlinked = await ctx
        .http()
        .post(`/api/admin/partners/${partner.id}/codes/${smartnet.id}/unlink`)
        .set(auth(admin.token))
        .expect(200);
      expect(unlinked.body.codes.map((c: any) => c.code)).toEqual(['KATALOG-2027']);
      expect((await ctx.prisma.discountCode.findUniqueOrThrow({ where: { code: 'SMARTNET20' } })).partnerId).toBeNull();
      const after = await ctx.http().get('/api/admin/discount-codes').set(auth(admin.token)).expect(200);
      expect(after.body.codes.find((c: any) => c.code === 'SMARTNET20').partner).toBeNull();
    });

    it('[AC-PRT-013] every partner endpoint is 403 for a regular account and 404 for an unknown partner', async () => {
      const admin = await makeAdmin();
      const partner = await createPartner(admin);
      const user = await registerUser(ctx);
      const calls: Array<[string, string, object?]> = [
        ['get', '/api/admin/partners'],
        ['post', '/api/admin/partners', { name: 'X partner', contactEmail: uniqueEmail() }],
        ['get', `/api/admin/partners/${partner.id}`],
        ['patch', `/api/admin/partners/${partner.id}`, { active: false }],
        ['post', `/api/admin/partners/${partner.id}/codes`, { code: 'HACK-10' }],
        ['post', `/api/admin/partners/${partner.id}/codes/link`, { code: 'HACK-10' }],
        ['post', `/api/admin/partners/${partner.id}/codes/x/unlink`],
        [
          'post',
          `/api/admin/partners/${partner.id}/payouts`,
          { amountPln: 100, paidOn: '2026-10-01', reference: 'FV' },
        ],
      ];
      for (const [method, url, body] of calls) {
        const res = await (ctx.http() as any)
          [method](url)
          .set(auth(user.token))
          .send(body ?? {});
        expect([url, res.status]).toEqual([url, 403]);
        expect(res.body.message).toBe('Dostęp tylko dla administratora');
      }
      // without a session at all
      await ctx.http().get('/api/admin/partners').expect(401);
      expect(await ctx.prisma.partner.count()).toBe(1);
      expect(stripe.coupons).toHaveLength(0);

      for (const [method, url, body] of [
        ['get', '/api/admin/partners/nope'],
        ['post', '/api/admin/partners/nope/codes', { code: 'NOPE-10' }],
        ['post', '/api/admin/partners/nope/codes/link', { code: 'NOPE-10' }],
        ['post', '/api/admin/partners/nope/payouts', { amountPln: 100, paidOn: '2026-10-01', reference: 'FV' }],
      ] as Array<[string, string, object?]>) {
        const res = await (ctx.http() as any)
          [method](url)
          .set(auth(admin.token))
          .send(body ?? {});
        expect([url, res.status, res.body.message]).toEqual([url, 404, 'Nie znaleziono partnera']);
      }
    });
  });

  // ─── Attribution ──────────────────────────────────────────────────

  describe('attribution', () => {
    it('[AC-PRT-005] a paid pack with a partner code attributes the customer once, with the payment time', async () => {
      const admin = await makeAdmin();
      const partner = await createPartner(admin, { code: 'KATALOG-10' });
      const customer = await registerUser(ctx);
      const paidAt = now() - 120;
      const order = await buy(customer, { code: 'KATALOG-10', paid: 2520, created: paidAt });

      const user = await userRow(customer.userId);
      expect(user.partnerId).toBe(partner.id);
      expect(user.partnerAttributedAt?.toISOString()).toBe(new Date(paidAt * 1000).toISOString());
      const until = new Date(paidAt * 1000);
      until.setUTCMonth(until.getUTCMonth() + 12);
      expect(user.partnerCommissionUntil?.getTime()).toBeGreaterThan(until.getTime() - 4 * DAY * 1000);
      expect(order.tx).toMatchObject({
        partnerId: partner.id,
        partnerCommissionPercent: 20,
        promotionCode: 'KATALOG-10',
      });
      expect(await entriesOf(order.tx.id)).toEqual([
        expect.objectContaining({
          partnerId: partner.id,
          kind: 'payment',
          productKind: 'package',
          packageId: 'credits_15',
          netPaidGrosze: 2520,
          commissionGrosze: 504,
          commissionPercent: 20,
          customerRef: customerRef(customer.userId),
          occurredAt: new Date(paidAt * 1000),
        }),
      ]);

      // Stripe retries – also in parallel: still one entry, credits added once
      await deliver(ctx, stripe, order.event).expect(200);
      await Promise.all(Array.from({ length: 5 }, () => deliver(ctx, stripe, order.event).expect(200)));
      expect(await entriesOf(order.tx.id)).toHaveLength(1);
      expect((await getCredits(ctx, customer.userId)).credits).toBe(15);
      await expectBalanceMatchesLedger(ctx, customer.userId);
    });

    it('[AC-PRT-005] first attribution wins: a later code of another partner does not move the customer', async () => {
      const admin = await makeAdmin();
      const first = await createPartner(admin, { name: 'Pierwszy', code: 'PIERWSZY-10' });
      const second = await createPartner(admin, { name: 'Drugi', code: 'DRUGI-10', commissionPercent: 30 });
      const customer = await registerUser(ctx);
      await buy(customer, { code: 'PIERWSZY-10', paid: 2520, created: now() - 60 });
      const later = await buy(customer, { packageId: 'credits_40', code: 'DRUGI-10', paid: 6300 });

      expect((await userRow(customer.userId)).partnerId).toBe(first.id);
      expect(later.tx).toMatchObject({ partnerId: first.id, partnerCommissionPercent: 20, promotionCode: 'DRUGI-10' });
      expect(await sumOf(later.tx.id)).toEqual({ net: 6300, commission: 1260 });
      const [a, b] = [await detail(admin, first.id), await detail(admin, second.id)];
      expect(a.allTime).toEqual({ orders: 2, netPaidGrosze: 2520 + 6300, commissionGrosze: 504 + 1260 });
      expect(a.customers).toBe(1);
      expect(b.allTime).toEqual({ orders: 0, netPaidGrosze: 0, commissionGrosze: 0 });
      expect(b.customers).toBe(0);
    });

    it('[AC-PRT-005] two first purchases with codes of different partners delivered in parallel attribute exactly one partner', async () => {
      const admin = await makeAdmin();
      const a = await createPartner(admin, { name: 'A partner', code: 'RACE-A' });
      const b = await createPartner(admin, { name: 'B partner', code: 'RACE-B' });
      const customer = await registerUser(ctx);
      const orders = [];
      for (const code of ['RACE-A', 'RACE-B']) {
        await ctx
          .http()
          .post('/api/payments/checkout')
          .set(auth(customer.token))
          .send({ packageId: 'credits_15', acceptedWithdrawalWaiver: true })
          .expect(201);
        const session = stripe.sessions.at(-1);
        orders.push(
          withCreated(
            discountedCompletedEvent(
              session.id,
              `pi_${session.id}`,
              { list: 2800, paid: 2520 },
              { id: `promo_${code}`, code },
            ),
            now() - 30,
          ),
        );
      }
      await Promise.all(orders.map((e) => deliver(ctx, stripe, e).expect(200)));
      const user = await userRow(customer.userId);
      expect([a.id, b.id]).toContain(user.partnerId);
      const txs = await ctx.prisma.paymentTransaction.findMany({ where: { userId: customer.userId } });
      // both payments (same time) count for the winner, none for the loser
      expect(txs.map((t) => t.partnerId)).toEqual([user.partnerId, user.partnerId]);
      expect(await ctx.prisma.partnerCommission.count({ where: { partnerId: user.partnerId! } })).toBe(2);
      expect((await getCredits(ctx, customer.userId)).credits).toBe(30);
    });

    it('[AC-PRT-005] a code without a partner, no code or an inactive partner attribute nobody', async () => {
      const admin = await makeAdmin();
      await plainCode(admin, 'BEZ-PARTNERA');
      const inactive = await createPartner(admin, { code: 'USPIONY-10' });
      await ctx
        .http()
        .patch(`/api/admin/partners/${inactive.id}`)
        .set(auth(admin.token))
        .send({ active: false })
        .expect(200);

      const a = await registerUser(ctx);
      const unlinked = await buy(a, { code: 'BEZ-PARTNERA', paid: 2520 });
      const b = await registerUser(ctx);
      const plain = await buy(b);
      const c = await registerUser(ctx);
      const sleeping = await buy(c, { code: 'USPIONY-10', paid: 2520 });
      // a code Stripe knows but we never created
      const d = await registerUser(ctx);
      const foreign = await buy(d, { code: 'SKLEP-JANMAT', paid: 2520 });

      for (const [account, order] of [
        [a, unlinked],
        [b, plain],
        [c, sleeping],
        [d, foreign],
      ] as const) {
        expect((await userRow(account.userId)).partnerId).toBeNull();
        const tx = await ctx.prisma.paymentTransaction.findUniqueOrThrow({ where: { id: order.tx.id } });
        expect(tx.partnerId).toBeNull();
        expect((await getCredits(ctx, account.userId)).credits).toBe(15);
      }
      expect(await ctx.prisma.partnerCommission.count()).toBe(0);
      expect((await detail(admin, inactive.id)).customers).toBe(0);
    });

    it('[AC-PRT-006] the partner paying with its own code (alias, other letter case) is not attributed', async () => {
      const admin = await makeAdmin();
      const own = uniqueEmail('wlasciciel');
      const partner = await createPartner(admin, { contactEmail: own.toUpperCase(), code: 'MOJ-KOD' });
      const [local, domain] = own.split('@');
      const self = await registerUser(ctx, `${local}+zakupy@${domain}`);
      const order = await buy(self, { code: 'MOJ-KOD', paid: 2520 });

      expect((await userRow(self.userId)).partnerId).toBeNull();
      expect(order.tx.partnerId).toBeNull();
      expect(await ctx.prisma.partnerCommission.count()).toBe(0);
      expect((await getCredits(ctx, self.userId)).credits).toBe(15);
      expect((await detail(admin, partner.id)).allTime.orders).toBe(0);

      // anyone else with the same code is attributed
      const reader = await registerUser(ctx);
      await buy(reader, { code: 'MOJ-KOD', paid: 2520 });
      expect((await userRow(reader.userId)).partnerId).toBe(partner.id);
    });

    it('[AC-PRT-007] a code Stripe could not tell at first is attributed on the next delivery without second credits', async () => {
      const admin = await makeAdmin();
      const partner = await createPartner(admin, { code: 'POZNIEJ-10' });
      const customer = await registerUser(ctx);
      stripe.promotionRetrieveError = Object.assign(new Error('Stripe is down'), { statusCode: 500 });
      const paidAt = now() - 600;
      const order = await buy(customer, { code: 'POZNIEJ-10', paid: 2520, created: paidAt, expanded: false });
      expect(order.tx).toMatchObject({ promotionCode: null, partnerId: null });
      expect((await userRow(customer.userId)).partnerId).toBeNull();
      expect(await ctx.prisma.partnerCommission.count()).toBe(0);

      stripe.promotionRetrieveError = null;
      await Promise.all([deliver(ctx, stripe, order.event).expect(200), deliver(ctx, stripe, order.event).expect(200)]);
      const user = await userRow(customer.userId);
      expect(user.partnerId).toBe(partner.id);
      expect(user.partnerAttributedAt?.getTime()).toBe(paidAt * 1000);
      expect(await entriesOf(order.tx.id)).toEqual([
        expect.objectContaining({ kind: 'payment', netPaidGrosze: 2520, commissionGrosze: 504 }),
      ]);
      expect((await getCredits(ctx, customer.userId)).credits).toBe(15);
      await expectBalanceMatchesLedger(ctx, customer.userId);
    });
  });

  // ─── Commission ───────────────────────────────────────────────────

  describe('commission', () => {
    it('[AC-PRT-008] later packages without a code and subscription invoices earn commission inside the period only', async () => {
      const admin = await makeAdmin();
      const partner = await createPartner(admin, { code: 'OKRES-10', commissionMonths: 2 });
      const customer = await registerUser(ctx);
      const t0 = at('2026-01-31T12:00:00.000Z');
      const end = at('2026-03-31T12:00:00.000Z'); // 31 Jan + 2 months (calendar, March has 31 days)

      // a purchase before the attribution never counts
      const before = await buy(customer, { created: t0 - DAY });
      const first = await buy(customer, { code: 'OKRES-10', paid: 2520, created: t0 });
      expect((await userRow(customer.userId)).partnerCommissionUntil?.toISOString()).toBe('2026-03-31T12:00:00.000Z');
      const later = await buy(customer, { packageId: 'credits_5', created: t0 + 10 * DAY });
      const subCreate = await payInvoice(customer, 1900, t0 + 11 * DAY, 'subscription_create');
      const proration = await payInvoice(customer, 700, t0 + 12 * DAY, 'subscription_update');
      const cycle = await payInvoice(customer, 1900, end - 1, 'subscription_cycle'); // last second of the period
      const atEnd = await payInvoice(customer, 1900, end, 'subscription_cycle'); // exactly at the end – outside
      const after = await buy(customer, { created: end + DAY });

      expect(before.tx.partnerId).toBeNull();
      expect(proration.tx).toBeNull(); // no credits, no transaction
      const counted = [first.tx.id, later.tx.id, subCreate.tx!.id, cycle.tx!.id];
      for (const id of counted) {
        expect((await ctx.prisma.paymentTransaction.findUniqueOrThrow({ where: { id } })).partnerId).toBe(partner.id);
      }
      for (const id of [before.tx.id, atEnd.tx!.id, after.tx.id]) {
        expect((await ctx.prisma.paymentTransaction.findUniqueOrThrow({ where: { id } })).partnerId).toBeNull();
        expect(await entriesOf(id)).toEqual([]);
      }
      expect(await sumOf(later.tx.id)).toEqual({ net: 1000, commission: 200 });
      expect(await entriesOf(subCreate.tx!.id)).toEqual([
        expect.objectContaining({
          kind: 'payment',
          productKind: 'subscription',
          packageId: null,
          commissionGrosze: 380,
        }),
      ]);
      const d = await detail(admin, partner.id);
      expect(d.allTime).toEqual({
        orders: 4,
        netPaidGrosze: 2520 + 1000 + 1900 + 1900,
        commissionGrosze: 504 + 200 + 380 + 380,
      });
      expect(d.customers).toBe(1);
    });

    it('[AC-PRT-008] payments while the partner is inactive earn nothing; a 100% code is an order with 0 zł commission', async () => {
      const admin = await makeAdmin();
      const partner = await createPartner(admin, { code: 'PAUZA-10' });
      await plainCode(admin, 'GRATIS-100', 100);
      await ctx
        .http()
        .post(`/api/admin/partners/${partner.id}/codes/link`)
        .set(auth(admin.token))
        .send({ code: 'GRATIS-100' })
        .expect(200);
      const customer = await registerUser(ctx);
      const free = await buy(customer, { code: 'GRATIS-100', paid: 0 });
      expect((await userRow(customer.userId)).partnerId).toBe(partner.id);
      expect(await entriesOf(free.tx.id)).toEqual([
        expect.objectContaining({ kind: 'payment', netPaidGrosze: 0, commissionGrosze: 0 }),
      ]);

      await ctx
        .http()
        .patch(`/api/admin/partners/${partner.id}`)
        .set(auth(admin.token))
        .send({ active: false })
        .expect(200);
      const paused = await buy(customer);
      expect(paused.tx.partnerId).toBeNull();
      await ctx
        .http()
        .patch(`/api/admin/partners/${partner.id}`)
        .set(auth(admin.token))
        .send({ active: true })
        .expect(200);
      const resumed = await buy(customer);
      expect(resumed.tx.partnerId).toBe(partner.id);

      const d = await detail(admin, partner.id);
      expect(d.allTime).toEqual({ orders: 2, netPaidGrosze: 2800, commissionGrosze: 560 });
      expect((await getCredits(ctx, customer.userId)).credits).toBe(45);
    });

    it('[AC-PRT-009] commission is the rate × what was paid after the discount, rounded half up to whole grosze', async () => {
      const admin = await makeAdmin();
      const twenty = await createPartner(admin, { name: 'Dwadzieścia', code: 'DWADZIESCIA' });
      const fifty = await createPartner(admin, { name: 'Pięćdziesiąt', code: 'POLOWA', commissionPercent: 50 });
      const ten = await createPartner(admin, { name: 'Dziesięć', code: 'DZIESIEC', commissionPercent: 10 });

      const cases: Array<[any, string, string, number, number]> = [
        // partner, code, pack, paid, expected commission
        [twenty, 'DWADZIESCIA', 'credits_15', 2520, 504], // 10% off 28 zł
        [twenty, 'DWADZIESCIA', 'credits_40', 5500, 1100], // 15 zł off
        [twenty, 'DWADZIESCIA', 'credits_200', 8910, 1782],
        [twenty, 'DWADZIESCIA', 'credits_5', 1, 0], // 0,2 gr
        [fifty, 'POLOWA', 'credits_5', 3, 2], // 1,5 gr → 2 gr
        [fifty, 'POLOWA', 'credits_5', 1, 1], // 0,5 gr → 1 gr
        [ten, 'DZIESIEC', 'credits_5', 5, 1], // 0,5 gr → 1 gr
        [ten, 'DZIESIEC', 'credits_5', 14, 1], // 1,4 gr → 1 gr
      ];
      for (const [partner, code, packageId, paid, expected] of cases) {
        const customer = await registerUser(ctx);
        const order = await buy(customer, { code, packageId, paid });
        expect([code, paid, await sumOf(order.tx.id)]).toEqual([code, paid, { net: paid, commission: expected }]);
        expect(order.tx.partnerId).toBe(partner.id);
      }
      // a full-price pack and an invoice of the twenty-percent partner's customer
      const regular = (await ctx.prisma.user.findFirstOrThrow({ where: { partnerId: twenty.id } })).id;
      const account = await ctx.prisma.user.findUniqueOrThrow({ where: { id: regular } });
      const token = (
        await ctx.http().post('/api/auth/login').send({ email: account.email, password: 'Str0ng!Passw0rd' }).expect(200)
      ).body.token;
      const plain = await buy({ token, userId: regular, email: account.email }, { packageId: 'credits_5' });
      expect(await sumOf(plain.tx.id)).toEqual({ net: 1000, commission: 200 });
      const invoice = await payInvoice({ token, userId: regular, email: account.email }, 1900, now());
      expect(await sumOf(invoice.tx!.id)).toEqual({ net: 1900, commission: 380 });

      // the statement adds up to the per-transaction commissions
      for (const partner of [twenty, fifty, ten]) {
        const d = await detail(admin, partner.id);
        const txs = await ctx.prisma.paymentTransaction.findMany({ where: { partnerId: partner.id } });
        const expected = txs.reduce((s, t) => s + commissionOf(netPaidGrosze(t), t.partnerCommissionPercent ?? 0), 0);
        expect(d.allTime.commissionGrosze).toBe(expected);
        expect(d.months.reduce((s: number, m: any) => s + m.commissionGrosze, 0)).toBe(expected);
        expect(d.balanceGrosze).toBe(expected);
      }
    });

    it('[AC-PRT-003] a new commission rate applies to later payments, a new period to later attributions only', async () => {
      const admin = await makeAdmin();
      const partner = await createPartner(admin, { code: 'STAWKA-10', commissionMonths: 12 });
      const early = await registerUser(ctx);
      const paidAt = now() - 3600;
      const firstOrder = await buy(early, { code: 'STAWKA-10', paid: 2520, created: paidAt });
      const until = (await userRow(early.userId)).partnerCommissionUntil;

      await ctx
        .http()
        .patch(`/api/admin/partners/${partner.id}`)
        .set(auth(admin.token))
        .send({ commissionPercent: 30, commissionMonths: 1 })
        .expect(200);
      const secondOrder = await buy(early);
      const lateReader = await registerUser(ctx);
      await buy(lateReader, { code: 'STAWKA-10', paid: 2520 });

      expect(await sumOf(firstOrder.tx.id)).toEqual({ net: 2520, commission: 504 }); // unchanged
      expect(
        (await ctx.prisma.paymentTransaction.findUniqueOrThrow({ where: { id: secondOrder.tx.id } }))
          .partnerCommissionPercent,
      ).toBe(30);
      expect(await sumOf(secondOrder.tx.id)).toEqual({ net: 2800, commission: 840 });
      expect((await userRow(early.userId)).partnerCommissionUntil).toEqual(until); // fixed at attribution
      const late = await userRow(lateReader.userId);
      const months = (late.partnerCommissionUntil!.getTime() - late.partnerAttributedAt!.getTime()) / (DAY * 1000);
      expect(months).toBeGreaterThanOrEqual(28);
      expect(months).toBeLessThanOrEqual(31);

      // a refund of the first order is corrected at the rate it was paid with
      await deliver(ctx, stripe, refundEvent(firstOrder.pi, 2520, 2520)).expect(200);
      expect(await sumOf(firstOrder.tx.id)).toEqual({ net: 0, commission: 0 });
    });

    it('[AC-PRT-010] refunds and disputes correct the commission in the month they happen, once per event', async () => {
      const admin = await makeAdmin();
      const partner = await createPartner(admin, { code: 'ZWROT-10' });
      const customer = await registerUser(ctx);
      const october = at('2026-10-10T10:00:00.000Z');
      const order = await buy(customer, { packageId: 'credits_40', code: 'ZWROT-10', paid: 6300, created: october });
      expect(await sumOf(order.tx.id)).toEqual({ net: 6300, commission: 1260 });

      const nov = (day: number) => at(`2026-11-${String(day).padStart(2, '0')}T10:00:00.000Z`);
      const partial = withCreated(refundEvent(order.pi, 6300, 1000), nov(2));
      await deliver(ctx, stripe, partial).expect(200);
      await deliver(ctx, stripe, partial).expect(200); // duplicate
      expect(await sumOf(order.tx.id)).toEqual({ net: 5300, commission: 1060 });

      // an older (smaller) refund total arriving late changes nothing
      await deliver(ctx, stripe, withCreated(refundEvent(order.pi, 6300, 500), nov(3))).expect(200);
      expect(await sumOf(order.tx.id)).toEqual({ net: 5300, commission: 1060 });

      // a dispute holds the rest back, losing it keeps it, a won dispute would give it back
      await deliver(
        ctx,
        stripe,
        withCreated(disputeEvent('charge.dispute.created', order.pi, 6300, 'needs_response'), nov(4)),
      ).expect(200);
      expect(await sumOf(order.tx.id)).toEqual({ net: 0, commission: 0 });
      await deliver(
        ctx,
        stripe,
        withCreated(disputeEvent('charge.dispute.closed', order.pi, 6300, 'won'), nov(20)),
      ).expect(200);
      expect(await sumOf(order.tx.id)).toEqual({ net: 5300, commission: 1060 });

      // a full refund of a second order, a lost dispute on a third
      const second = await buy(customer, { code: 'ZWROT-10', paid: 2520, created: october + DAY });
      await deliver(ctx, stripe, withCreated(refundEvent(second.pi, 2520, 2520), nov(5))).expect(200);
      const third = await buy(customer, { created: october + 2 * DAY });
      await deliver(
        ctx,
        stripe,
        withCreated(disputeEvent('charge.dispute.created', third.pi, 2800, 'needs_response'), nov(6)),
      ).expect(200);
      await deliver(
        ctx,
        stripe,
        withCreated(disputeEvent('charge.dispute.closed', third.pi, 2800, 'lost'), nov(25)),
      ).expect(200);
      expect(await sumOf(second.tx.id)).toEqual({ net: 0, commission: 0 });
      expect(await sumOf(third.tx.id)).toEqual({ net: 0, commission: 0 });

      const d = await detail(admin, partner.id);
      const [novStatement, octStatement] = d.months;
      expect(octStatement).toMatchObject({
        month: '2026-10',
        orders: 3,
        netPaidGrosze: 6300 + 2520 + 2800,
        commissionGrosze: 1260 + 504 + 560,
      });
      expect(novStatement).toMatchObject({
        month: '2026-11',
        orders: 0,
        netPaidGrosze: -1000 - 5300 + 5300 - 2520 - 2800,
        commissionGrosze: -200 - 1060 + 1060 - 504 - 560,
      });
      expect(novStatement.entries.every((e: any) => e.kind === 'adjustment')).toBe(true);
      expect(octStatement.entries.every((e: any) => e.kind === 'payment')).toBe(true);
      expect(d.allTime.commissionGrosze).toBe(1060);
      // every transaction: entries = round(rate × net)
      for (const t of await ctx.prisma.paymentTransaction.findMany({ where: { partnerId: partner.id } })) {
        expect((await sumOf(t.id)).commission).toBe(commissionOf(netPaidGrosze(t), 20));
      }
      await expectBalanceMatchesLedger(ctx, customer.userId);
    });

    it('[AC-PRT-010] a refund before the completion books one order entry with the net amount; corrections never predate the order', async () => {
      const admin = await makeAdmin();
      await createPartner(admin, { code: 'WCZESNIE' });
      const customer = await registerUser(ctx);
      await ctx
        .http()
        .post('/api/payments/checkout')
        .set(auth(customer.token))
        .send({ packageId: 'credits_15', acceptedWithdrawalWaiver: true })
        .expect(201);
      const session = stripe.sessions.at(-1);
      const pi = `pi_${session.id}`;
      stripe.sessionPaymentIntents.set(session.id, pi);
      const paidAt = at('2026-09-30T20:00:00.000Z');
      await deliver(
        ctx,
        stripe,
        withCreated(refundEvent(pi, 2520, 1260, { customer: session.customer }), paidAt - 60),
      ).expect(200);
      await deliver(
        ctx,
        stripe,
        withCreated(
          discountedCompletedEvent(session.id, pi, { list: 2800, paid: 2520 }, { id: 'p', code: 'WCZESNIE' }),
          paidAt,
        ),
      ).expect(200);
      const tx = await ctx.prisma.paymentTransaction.findUniqueOrThrow({ where: { stripeSessionId: session.id } });
      expect(await entriesOf(tx.id)).toEqual([
        expect.objectContaining({
          kind: 'payment',
          netPaidGrosze: 1260,
          commissionGrosze: 252,
          occurredAt: new Date(paidAt * 1000),
        }),
      ]);
      // a later refund whose Stripe time is before the order is booked at the order time
      await deliver(ctx, stripe, withCreated(refundEvent(pi, 2520, 2520), paidAt - 3600)).expect(200);
      const entries = await entriesOf(tx.id);
      expect(entries[1]).toMatchObject({
        kind: 'adjustment',
        netPaidGrosze: -1260,
        commissionGrosze: -252,
        occurredAt: new Date(paidAt * 1000),
      });
      expect((await getCredits(ctx, customer.userId)).credits).toBe(0);
    });

    it('[AC-PRT-011] months follow Polish time across DST and the year end; statements are newest first', async () => {
      const admin = await makeAdmin();
      const partner = await createPartner(admin, { code: 'MIESIAC' });
      const customer = await registerUser(ctx);
      const moments: Array<[string, string]> = [
        ['2026-03-31T21:30:00.000Z', '2026-03'], // 23:30 CEST
        ['2026-03-31T22:30:00.000Z', '2026-04'], // 00:30 CEST on 1 April
        ['2026-10-31T22:30:00.000Z', '2026-10'], // 23:30 CET (after the change on 25 October)
        ['2026-10-31T23:30:00.000Z', '2026-11'], // 00:30 CET on 1 November
        ['2026-12-31T22:59:59.000Z', '2026-12'], // 23:59:59 CET
        ['2026-12-31T23:30:00.000Z', '2027-01'], // 00:30 CET on 1 January 2027
      ];
      const orders = [];
      for (const [iso, month] of moments) {
        const order =
          orders.length === 0
            ? await buy(customer, { code: 'MIESIAC', paid: 2520, created: at(iso) })
            : await buy(customer, { packageId: 'credits_5', created: at(iso) });
        orders.push({ order, month });
      }
      // a refund at 23:30 UTC on 30 April (01:30 CEST on 1 May) corrects May
      await deliver(
        ctx,
        stripe,
        withCreated(refundEvent(orders[1].order.pi, 1000, 500), at('2026-04-30T23:30:00.000Z')),
      ).expect(200);

      const d = await detail(admin, partner.id);
      expect(d.months.map((m: any) => m.month)).toEqual([
        '2027-01',
        '2026-12',
        '2026-11',
        '2026-10',
        '2026-05',
        '2026-04',
        '2026-03',
      ]);
      const byMonth = new Map(d.months.map((m: any) => [m.month, m]));
      for (const { order, month } of orders) {
        const statement: any = byMonth.get(month);
        expect(
          statement.entries.some(
            (e: any) => e.kind === 'payment' && new Date(e.occurredAt).getTime() === order.event.created * 1000,
          ),
        ).toBe(true);
      }
      expect(byMonth.get('2026-03')).toMatchObject({ orders: 1, netPaidGrosze: 2520, commissionGrosze: 504 });
      expect(byMonth.get('2026-05')).toMatchObject({ orders: 0, netPaidGrosze: -500, commissionGrosze: -100 });
      for (const m of ['2026-04', '2026-10', '2026-11', '2026-12', '2027-01']) {
        expect(byMonth.get(m)).toMatchObject({ orders: 1, netPaidGrosze: 1000, commissionGrosze: 200 });
      }
      // newest entries first inside a month, each with the masked customer and the product
      expect(byMonth.get('2026-05')).toMatchObject({
        entries: [
          {
            kind: 'adjustment',
            customer: customerRef(customer.userId),
            product: 'Pakiet 5 kredytów',
            commissionPercent: 20,
          },
        ],
      });
    });

    it('[AC-PRT-012] payouts reduce the balance, warn below 50 zł or above the balance and validate their fields', async () => {
      const admin = await makeAdmin();
      const partner = await createPartner(admin, { code: 'WYPLATA' });
      const customer = await registerUser(ctx);
      const big = await buy(customer, { packageId: 'credits_200', code: 'WYPLATA', paid: 8910 }); // 17,82 zł
      await buy(customer, { packageId: 'credits_200', paid: 9900 }); // 19,80 zł
      await buy(customer, { packageId: 'credits_200', paid: 9900 }); // 19,80 zł → 57,42 zł in total
      const pay = (body: Record<string, unknown>) =>
        ctx.http().post(`/api/admin/partners/${partner.id}/payouts`).set(auth(admin.token)).send(body);

      const first = await pay({ amountPln: 50, paidOn: '2026-10-05', reference: ' FV 1/10/2026 ' }).expect(201);
      expect(first.body).toEqual({
        payout: expect.objectContaining({
          amountGrosze: 5000,
          paidOn: '2026-10-05',
          reference: 'FV 1/10/2026',
          createdBy: admin.email,
        }),
        balanceGrosze: 742,
        warnings: [],
      });
      const small = await pay({ amountPln: 7.42, paidOn: '2026-10-06', reference: 'FV 2/10/2026' }).expect(201);
      expect(small.body.balanceGrosze).toBe(0);
      expect(small.body.warnings).toEqual(['Kwota jest poniżej progu wypłaty 50,00 zł.']);
      const over = await pay({ amountPln: 60, paidOn: '2026-10-07', reference: 'zaliczka' }).expect(201);
      expect(over.body.balanceGrosze).toBe(-6000);
      expect(over.body.warnings).toEqual(['Wypłata jest wyższa niż saldo do wypłaty (0,00 zł).']);

      // a refund after the payout pushes the balance further down – it carries over
      await deliver(ctx, stripe, refundEvent(big.pi, 8910, 8910)).expect(200);
      const d = await detail(admin, partner.id);
      expect(d).toMatchObject({ paidOutGrosze: 11742, balanceGrosze: 5742 - 1782 - 11742, minPayoutGrosze: 5000 });
      expect(d.payouts.map((p: any) => p.paidOn)).toEqual(['2026-10-07', '2026-10-06', '2026-10-05']);
      const listed = (await list(admin)).partners.find((p: any) => p.id === partner.id);
      expect(listed).toMatchObject({ paidOutGrosze: 11742, balanceGrosze: d.balanceGrosze });

      const tomorrow = new Date(Date.now() + 2 * DAY * 1000).toISOString().slice(0, 10);
      const invalid: Array<[Record<string, unknown>, RegExp]> = [
        [{ amountPln: 0, paidOn: '2026-10-05', reference: 'FV' }, /większa od 0 zł/],
        [{ amountPln: -10, paidOn: '2026-10-05', reference: 'FV' }, /większa od 0 zł/],
        [{ amountPln: 10.001, paidOn: '2026-10-05', reference: 'FV' }, /najwyżej 2 miejscami po przecinku/],
        [{ amountPln: '10', paidOn: '2026-10-05', reference: 'FV' }, /musi być liczbą w zł/],
        [{ amountPln: 100000.01, paidOn: '2026-10-05', reference: 'FV' }, /najwyżej 100 000 zł/],
        [{ amountPln: 10, paidOn: tomorrow, reference: 'FV' }, /nie może być z przyszłości/],
        [{ amountPln: 10, paidOn: '2026-02-30', reference: 'FV' }, /Nieprawidłowa data wypłaty/],
        [{ amountPln: 10, paidOn: '05.10.2026', reference: 'FV' }, /RRRR-MM-DD/],
        [{ amountPln: 10, reference: 'FV' }, /RRRR-MM-DD/],
        [{ amountPln: 10, paidOn: '2026-10-05', reference: '   ' }, /Podaj numer faktury partnera albo notatkę/],
        [{ amountPln: 10, paidOn: '2026-10-05' }, /Podaj numer faktury/],
        [{ amountPln: 10, paidOn: '2026-10-05', reference: 'x'.repeat(201) }, /maksymalnie 200 znaków/],
      ];
      for (const [body, message] of invalid) {
        const res = await pay(body).expect(400);
        const text = Array.isArray(res.body.message) ? res.body.message.join(' ') : res.body.message;
        expect([JSON.stringify(body), text]).toEqual([JSON.stringify(body), expect.stringMatching(message)]);
      }
      expect(await ctx.prisma.partnerPayout.count()).toBe(3);
    });

    it('[AC-PRT-013] the list and the statement have current-month and all-time totals, masked customers and no personal data', async () => {
      const admin = await makeAdmin();
      const partner = await createPartner(admin, { code: 'LISTA-10', companyName: 'Firma', nip: '5260001246' });
      const idle = await createPartner(admin, { name: 'Bez zamówień' });
      const reader = await registerUser(ctx, uniqueEmail('czytelnik'));
      const old = await buy(reader, { code: 'LISTA-10', paid: 2520, created: now() - 400 * DAY });
      // the period is 12 months, so a new payment of this reader no longer counts – attribute a second reader now
      const reader2 = await registerUser(ctx, uniqueEmail('czytelniczka'));
      await buy(reader2, { code: 'LISTA-10', paid: 2520 });
      await buy(reader2, { packageId: 'credits_5' });
      await ctx
        .http()
        .post(`/api/admin/partners/${partner.id}/payouts`)
        .set(auth(admin.token))
        .send({
          amountPln: 5,
          paidOn: todayInPoland(),
          reference: 'FV 3',
        })
        .expect(201);

      const body = await list(admin);
      expect(body.month).toMatch(/^\d{4}-\d{2}$/);
      expect(body.minPayoutGrosze).toBe(5000);
      expect(body.partners.map((p: any) => p.name)).toEqual(['Bez zamówień', 'Katalog Firm']); // newest first
      const row = body.partners.find((p: any) => p.id === partner.id);
      expect(row).toMatchObject({
        companyName: 'Firma',
        nip: '5260001246',
        codes: [expect.objectContaining({ code: 'LISTA-10', status: 'active' })],
        customers: 2,
        currentMonth: { orders: 2, netPaidGrosze: 2520 + 1000, commissionGrosze: 504 + 200 },
        allTime: { orders: 3, netPaidGrosze: 2520 * 2 + 1000, commissionGrosze: 504 * 2 + 200 },
        paidOutGrosze: 500,
        balanceGrosze: 504 * 2 + 200 - 500,
      });
      expect(body.partners.find((p: any) => p.id === idle.id)).toMatchObject({
        customers: 0,
        balanceGrosze: 0,
        codes: [],
      });

      const d = await detail(admin, partner.id);
      expect(d.months).toHaveLength(2);
      const entries = d.months.flatMap((m: any) => m.entries);
      expect(entries).toHaveLength(3);
      for (const e of entries) {
        expect(Object.keys(e).sort()).toEqual(
          [
            'commissionGrosze',
            'commissionPercent',
            'customer',
            'id',
            'kind',
            'netPaidGrosze',
            'occurredAt',
            'product',
          ].sort(),
        );
        expect(e.customer).toMatch(/^K-[0-9a-f]{8}$/);
      }
      expect(new Set(entries.map((e: any) => e.customer))).toEqual(
        new Set([customerRef(reader.userId), customerRef(reader2.userId)]),
      );
      const text = JSON.stringify({ body, d });
      for (const secret of [
        reader.email,
        reader2.email,
        reader.userId,
        reader2.userId,
        old.pi,
        old.session.id,
        'promo_',
        'co_fake',
        'cus_',
      ]) {
        expect(text).not.toContain(secret);
      }

      // deleting a customer account keeps the statement and the balance
      await ctx.prisma.user.delete({ where: { id: reader.userId } });
      const afterDelete = await detail(admin, partner.id);
      expect(afterDelete.allTime).toEqual(d.allTime);
      expect(afterDelete.balanceGrosze).toBe(d.balanceGrosze);
      expect(afterDelete.customers).toBe(1);
    });
  });

  // ─── Property test ────────────────────────────────────────────────

  /** Small deterministic PRNG (mulberry32) – a failing seed can be replayed exactly. */
  function prng(seed: number) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
      pick: <T>(items: T[]): T => items[Math.floor(next() * items.length)],
      chance: (p: number) => next() < p,
    };
  }

  for (const seed of [20261019, 99, 31337]) {
    it(`[AC-PRT-014] commission entries, attribution, balances and credits stay consistent after every step (seed ${seed})`, async () => {
      const rnd = prng(seed);
      const admin = await makeAdmin();
      const partnerOwnEmail = uniqueEmail('partner-b');
      const partnerA = await createPartner(admin, { name: 'Partner A', code: 'PROP-A' });
      const partnerB = await createPartner(admin, {
        name: 'Partner B',
        contactEmail: partnerOwnEmail,
        code: 'PROP-B',
        commissionPercent: 35,
      });
      await plainCode(admin, 'PROP-NONE');
      await plainCode(admin, 'PROP-FREE', 100);
      await ctx
        .http()
        .post(`/api/admin/partners/${partnerA.id}/codes/link`)
        .set(auth(admin.token))
        .send({ code: 'PROP-FREE' })
        .expect(200);
      const codePartner: Record<string, string | null> = {
        'PROP-A': partnerA.id,
        'PROP-B': partnerB.id,
        'PROP-NONE': null,
        'PROP-FREE': partnerA.id,
      };

      const accounts: Array<Account & { expected: string | null; own: string | null }> = [];
      for (let i = 0; i < 3; i++) accounts.push({ ...(await registerUser(ctx)), expected: null, own: null });
      accounts.push({ ...(await registerUser(ctx, partnerOwnEmail)), expected: null, own: partnerB.id }); // self-referral

      interface Payment {
        pi: string;
        amount: number;
        refunded: number;
        dispute: 'none' | 'open' | 'won' | 'lost';
      }
      const payments: Payment[] = [];
      const sent: any[] = [];
      let clock = at('2026-11-01T08:00:00.000Z');
      const log: string[] = [];
      const send = async (event: any) => {
        sent.push(event);
        await deliver(ctx, stripe, event).expect(200);
      };

      for (let step = 0; step < 35; step++) {
        clock += rnd.int(1, 3) * DAY + rnd.int(0, 3600);
        const account = rnd.pick(accounts);
        const roll = rnd.next();
        let op: string;
        if (roll < 0.35 || payments.length === 0) {
          const packageId = rnd.pick(['credits_5', 'credits_15', 'credits_40']);
          const code = rnd.pick(['PROP-A', 'PROP-B', 'PROP-NONE', 'PROP-FREE', null, null]);
          const list = PRICES[packageId];
          const paid = code === 'PROP-FREE' ? 0 : code ? Math.round(list * 0.9) : list;
          await ctx
            .http()
            .post('/api/payments/checkout')
            .set(auth(account.token))
            .send({ packageId, acceptedWithdrawalWaiver: true })
            .expect(201);
          const session = stripe.sessions.at(-1);
          const pi = `pi_${session.id}`;
          stripe.sessionPaymentIntents.set(session.id, pi);
          const event = code
            ? discountedCompletedEvent(
                session.id,
                paid === 0 ? null : pi,
                { list, paid },
                { id: `promo_${code}`, code },
              )
            : completedEvent(session.id, pi, {
                currency: 'pln',
                amount_total: paid,
                total_details: { amount_discount: 0 },
              });
          await send(withCreated(event, clock));
          if (rnd.chance(0.3)) await send(withCreated(event, clock)); // Stripe retry
          if (paid > 0) payments.push({ pi, amount: paid, refunded: 0, dispute: 'none' });
          const partner = code ? codePartner[code] : null;
          if (!account.expected && partner && partner !== account.own) account.expected = partner;
          op = `buy:${code ?? '-'}:${paid}`;
        } else if (roll < 0.5) {
          const invoice = await payInvoice(
            account,
            1900,
            clock,
            rnd.pick(['subscription_create', 'subscription_cycle']),
          );
          payments.push({ pi: invoice.pi, amount: 1900, refunded: 0, dispute: 'none' });
          sent.push(invoice.event);
          op = 'invoice';
        } else if (roll < 0.68) {
          const p = rnd.pick(payments);
          if (p.refunded < p.amount) {
            p.refunded = rnd.chance(0.4) ? p.amount : rnd.int(p.refunded + 1, p.amount);
            await send(withCreated(refundEvent(p.pi, p.amount, p.refunded), clock));
          }
          op = `refund:${p.refunded}/${p.amount}`;
        } else if (roll < 0.8) {
          const p = rnd.pick(payments);
          if (p.dispute === 'none') {
            p.dispute = 'open';
            await send(withCreated(disputeEvent('charge.dispute.created', p.pi, p.amount, 'needs_response'), clock));
          } else if (p.dispute === 'open') {
            p.dispute = rnd.chance(0.5) ? 'won' : 'lost';
            await send(withCreated(disputeEvent('charge.dispute.closed', p.pi, p.amount, p.dispute), clock));
          }
          op = `dispute:${p.dispute}`;
        } else if (roll < 0.9) {
          const partner = rnd.pick([partnerA, partnerB]);
          await ctx
            .http()
            .post(`/api/admin/partners/${partner.id}/payouts`)
            .set(auth(admin.token))
            .send({ amountPln: rnd.int(1, 80), paidOn: todayInPoland(), reference: `FV ${step}` })
            .expect(201);
          op = 'payout';
        } else {
          if (sent.length) await deliver(ctx, stripe, rnd.pick(sent)).expect(200); // duplicate / old event
          op = 'replay';
        }
        log.push(`${step}:${op}`);

        try {
          for (const a of accounts) {
            const user = await userRow(a.userId);
            expect(user.partnerId).toBe(a.expected);
            await expectBalanceMatchesLedger(ctx, a.userId);
          }
          const txs = await ctx.prisma.paymentTransaction.findMany({
            where: { completedAt: { not: null } },
            include: { user: true },
          });
          for (const t of txs) {
            const sum = await sumOf(t.id);
            if (!t.partnerId) {
              expect(sum).toEqual({ net: 0, commission: 0 });
              continue;
            }
            expect(t.partnerId).toBe(t.user.partnerId);
            expect(sum).toEqual({
              net: netPaidGrosze(t),
              commission: commissionOf(netPaidGrosze(t), t.partnerCommissionPercent!),
            });
            const [order] = await entriesOf(t.id);
            expect(order.kind).toBe('payment');
            expect(order.occurredAt.getTime()).toBeGreaterThanOrEqual(t.user.partnerAttributedAt!.getTime());
            expect(order.occurredAt.getTime()).toBeLessThan(t.user.partnerCommissionUntil!.getTime());
          }
          const listed = (await list(admin)).partners;
          for (const p of listed) {
            const commission =
              (
                await ctx.prisma.partnerCommission.aggregate({
                  where: { partnerId: p.id },
                  _sum: { commissionGrosze: true },
                })
              )._sum.commissionGrosze ?? 0;
            const paidOut =
              (await ctx.prisma.partnerPayout.aggregate({ where: { partnerId: p.id }, _sum: { amountGrosze: true } }))
                ._sum.amountGrosze ?? 0;
            expect(p.allTime.commissionGrosze).toBe(commission);
            expect(p.paidOutGrosze).toBe(paidOut);
            expect(p.balanceGrosze).toBe(commission - paidOut);
            const statement = await detail(admin, p.id);
            expect(statement.months.reduce((s: number, m: any) => s + m.commissionGrosze, 0)).toBe(commission);
          }
        } catch (err) {
          throw new Error(`seed ${seed}, after steps ${log.join(' ')}: ${(err as Error).message}`);
        }
      }
      // the partner's own mailbox is never attributed to that partner (another partner's code is fine)
      expect(accounts[3].expected).not.toBe(partnerB.id);
      expect(log.some((entry) => /buy:PROP-B/.test(entry))).toBe(true);
      expect(accounts.some((a) => a.expected)).toBe(true);
    }, 240_000);
  }
});
