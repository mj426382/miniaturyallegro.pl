import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { parseAdminEmails } from '../admin/admin-emails';
import { CREDIT_PACKAGES, SUBSCRIPTION_PLANS, WELCOME_PACKAGE, findPackage, findPlan, SubscriptionPlan } from './plans';
import { emailNotVerifiedException, isVerificationRequired } from '../auth/email-verification';

// Stripe v22 CJS – use require to avoid TS namespace issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StripeLib = require('stripe');

export const TRANSACTION_STATUS = {
  pending: 'pending',
  completed: 'completed',
  failed: 'failed',
  expired: 'expired',
  /** Spec 09: the whole payment was refunded in Stripe. */
  refunded: 'refunded',
  partiallyRefunded: 'partially_refunded',
  /** An open or lost chargeback. */
  disputed: 'disputed',
} as const;

/** Statuses of a payment that was (or may still be) fulfilled – they all count as "paid" for the welcome pack. */
const PAID_STATUSES: string[] = [
  TRANSACTION_STATUS.completed,
  TRANSACTION_STATUS.refunded,
  TRANSACTION_STATUS.partiallyRefunded,
  TRANSACTION_STATUS.disputed,
];

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'];

/** Spec 09, AC-PAY-023: verdicts of the plan price guard are cached; failures are retried sooner. */
const PRICE_CHECK_TTL_MS = 5 * 60 * 1000;
const PRICE_CHECK_ERROR_TTL_MS = 60 * 1000;

/** Spec 09, AC-PAY-022: a payment of our own Stripe customer that matches no row is retried this long. */
const UNMATCHED_RETRY_WINDOW_MS = 6 * 60 * 60 * 1000;

/** A reserved (not yet sent to Stripe) checkout row older than this is treated as abandoned. */
const RESERVATION_STALE_MS = 2 * 60 * 1000;
const RESERVATION_PREFIX = 'reserved:';

/**
 * Spec 09: every payment gets a Stripe invoice. Checkout lets the buyer tick "purchasing as a business"
 * with a NIP and asks for the billing address only when needed – a required address made private
 * buyers drop off on a 5–10 zł first pack. Whatever is entered is saved on the Stripe customer.
 */
const INVOICE_DETAILS_COLLECTION = {
  billing_address_collection: 'auto',
  tax_id_collection: { enabled: true },
  customer_update: { name: 'auto', address: 'auto' },
} as const;

/** The columns of payment_transactions the refund / dispute accounting works with (locked row). */
interface LockedTransaction {
  id: string;
  userId: string;
  status: string;
  amountPln: number;
  creditsAdded: number;
  packageId: string | null;
  completedAt: Date | null;
  amountRefunded: number;
  disputeAmount: number;
  disputeStatus: string | null;
  creditsReversed: number;
  creditsShortfall: number;
}

type DisputeState = 'open' | 'won' | 'lost';

interface ReversalChange {
  /** Cumulative amount refunded on the charge (charge.amount_refunded). */
  amountRefunded?: number;
  dispute?: { status: DisputeState; amount: number };
}

interface ReversalOutcome {
  transactionId: string;
  userId: string;
  kind: 'refund' | 'dispute';
  status: string;
  amountPln: number;
  amountRefunded: number;
  disputeStatus: string | null;
  creditsAdded: number;
  creditsReversed: number;
  creditsShortfall: number;
  /** Credits removed from (negative: given back to) the balance by this event. */
  balanceChange: number;
  balanceAfter: number | null;
}

/** Stripe sends ids either as strings or as expanded objects. */
function idOf(value: unknown): string | undefined {
  if (typeof value === 'string' && value) return value;
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return undefined;
}

/** PaymentIntent of a paid invoice – API 2025-03+ (`payments[]`) and the older `payment_intent` field. */
function invoicePaymentIntentId(invoice: any): string | undefined {
  const legacy = idOf(invoice?.payment_intent);
  if (legacy) return legacy;
  for (const payment of invoice?.payments?.data ?? []) {
    const id = idOf(payment?.payment?.payment_intent);
    if (id) return id;
  }
  return undefined;
}

/**
 * Credits taken back for a payment: proportional to the money that left us (refunds + an open or lost
 * dispute), rounded, never more than the credits the payment added (spec 09, AC-PAY-017).
 */
export function creditsToReverse(row: {
  amountPln: number;
  creditsAdded: number;
  amountRefunded: number;
  disputeAmount: number;
}): number {
  if (row.amountPln <= 0) return 0;
  const held = Math.min(row.amountPln, Math.max(0, row.amountRefunded) + Math.max(0, row.disputeAmount));
  return Math.min(row.creditsAdded, Math.round((row.creditsAdded * held) / row.amountPln));
}

function reversalStatus(row: LockedTransaction): string {
  if (row.disputeStatus === 'open' || row.disputeStatus === 'lost') return TRANSACTION_STATUS.disputed;
  if (row.amountPln > 0 && row.amountRefunded >= row.amountPln) return TRANSACTION_STATUS.refunded;
  if (row.amountRefunded > 0) return TRANSACTION_STATUS.partiallyRefunded;
  if (row.completedAt) return TRANSACTION_STATUS.completed;
  return PAID_STATUSES.includes(row.status) ? TRANSACTION_STATUS.pending : row.status;
}

function zl(grosze: number): string {
  return `${(grosze / 100).toFixed(2).replace('.', ',')} zł`;
}

@Injectable()
export class PaymentsService {
  private stripe: any = null;
  private readonly logger = new Logger(PaymentsService.name);
  private readonly verificationRequired: boolean;
  /** Plan price guard verdicts per Stripe Price id (AC-PAY-023). */
  private readonly priceChecks = new Map<string, { ok: boolean; expiresAt: number }>();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private mail: MailService,
  ) {
    this.verificationRequired = isVerificationRequired(this.configService.get<string>('EMAIL_VERIFICATION_REQUIRED'));
    const key = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (key && !/PLACEHOLDER/i.test(key)) {
      this.stripe = new StripeLib(key, { apiVersion: '2026-03-25.dahlia' });
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not configured -- payments disabled');
    }
  }

  /** Allows tests to inject a Stripe mock without touching the network. */
  setStripeClient(client: any) {
    this.stripe = client;
    this.priceChecks.clear();
  }

  private requireStripe() {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Płatności nie są obecnie dostępne. Skontaktuj się z administratorem.');
    }
    return this.stripe;
  }

  private frontendUrl(): string {
    return (this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(/\/$/, '');
  }

  /**
   * The Stripe account is shared with the JAN-MAT shop, so card statements name the shop:
   * "<ACCOUNT PREFIX>* ALLGRAFIKA". Prefix + suffix must fit 22 characters.
   */
  private statementDescriptorSuffix(): string {
    return this.configService.get<string>('STRIPE_STATEMENT_DESCRIPTOR_SUFFIX') || 'ALLGRAFIKA';
  }

  // ─── Catalogue ────────────────────────────────────────────────────

  getPackages() {
    return CREDIT_PACKAGES;
  }

  /** Spec 19, AC-MON-002: the welcome pack is offered until the first paid transaction. */
  async getWelcomeOffer(userId: string) {
    const available = await this.isWelcomeEligible(userId);
    return { available, package: available ? WELCOME_PACKAGE : null };
  }

  /** No fulfilled payment yet – a later refund or chargeback does not make the account eligible again. */
  private async isWelcomeEligible(userId: string): Promise<boolean> {
    const paid = await this.prisma.paymentTransaction.count({
      where: { userId, OR: [{ completedAt: { not: null } }, { status: { in: PAID_STATUSES } }] },
    });
    return paid === 0;
  }

  async getPlans() {
    return Promise.all(
      SUBSCRIPTION_PLANS.map(async (plan) => ({
        id: plan.id,
        name: plan.name,
        credits: plan.credits,
        priceGrosze: plan.priceGrosze,
        priceLabel: plan.priceLabel,
        description: plan.description,
        available: await this.isPlanAvailable(plan),
      })),
    );
  }

  private stripePriceId(plan: SubscriptionPlan): string | undefined {
    const value = this.configService.get<string>(plan.priceEnv);
    return value && !/PLACEHOLDER/i.test(value) ? value : undefined;
  }

  private planByPriceId(priceId: string | undefined): SubscriptionPlan | undefined {
    if (!priceId) return undefined;
    return SUBSCRIPTION_PLANS.find((p) => this.stripePriceId(p) === priceId);
  }

  /**
   * Spec 09, AC-PAY-023 – price guard: a plan is offered only when its configured Stripe Price exists, is
   * active, recurring every 1 month, in PLN and its unit_amount equals `priceGrosze`, so the site can never
   * show one price while Stripe charges another. Fails closed (logged warning) on any problem or Stripe error.
   */
  private async isPlanAvailable(plan: SubscriptionPlan): Promise<boolean> {
    const priceId = this.stripePriceId(plan);
    if (!this.stripe || !priceId) return false;

    const now = Date.now();
    const cached = this.priceChecks.get(priceId);
    if (cached && cached.expiresAt > now) return cached.ok;

    let ok = false;
    let ttl = PRICE_CHECK_TTL_MS;
    try {
      const price = await this.stripe.prices.retrieve(priceId);
      const problems: string[] = [];
      if (!price || price.deleted) problems.push('price not found');
      else {
        if (price.active === false) problems.push('price is archived');
        if (String(price.currency).toLowerCase() !== 'pln') problems.push(`currency ${price.currency}`);
        if (price.type !== 'recurring' || price.recurring?.interval !== 'month') {
          problems.push(`not a monthly recurring price (${price.type}/${price.recurring?.interval})`);
        } else if ((price.recurring?.interval_count ?? 1) !== 1) {
          problems.push(`billed every ${price.recurring.interval_count} months`);
        }
        if (price.unit_amount !== plan.priceGrosze) {
          problems.push(`unit_amount ${price.unit_amount} != ${plan.priceGrosze}`);
        }
      }
      ok = problems.length === 0;
      if (!ok) this.logger.warn(`Plan ${plan.id} hidden – Stripe price ${priceId}: ${problems.join(', ')}`);
    } catch (err: any) {
      ttl = PRICE_CHECK_ERROR_TTL_MS;
      this.logger.warn(`Plan ${plan.id} hidden – could not verify Stripe price ${priceId}: ${err?.message}`);
    }
    this.priceChecks.set(priceId, { ok, expiresAt: now + ttl });
    return ok;
  }

  // ─── One-time packs ───────────────────────────────────────────────

  /**
   * The transaction row is reserved BEFORE the Stripe session exists (its id travels in the session
   * metadata), so a session can never be paid without a row – and for the welcome pack the partial
   * unique index makes the reservation the atomic "once per account" gate (spec 19, AC-MON-008).
   */
  async createCheckoutSession(userId: string, packageId: string) {
    const stripe = this.requireStripe();
    const pkg = findPackage(packageId);
    if (!pkg) throw new BadRequestException('Nieprawidłowy pakiet');

    await this.assertCanPurchase(userId);
    if (pkg.welcome) {
      if (!(await this.isWelcomeEligible(userId))) {
        throw new BadRequestException('Pakiet powitalny jest dostępny tylko przy pierwszym zakupie');
      }
      const reused = await this.reusableWelcomeCheckout(userId);
      if (reused) return reused;
    }

    let reservation: { id: string };
    try {
      reservation = await this.prisma.paymentTransaction.create({
        data: {
          userId,
          stripeSessionId: `${RESERVATION_PREFIX}${randomUUID()}`,
          amountPln: pkg.priceGrosze,
          creditsAdded: pkg.credits,
          status: TRANSACTION_STATUS.pending,
          kind: 'package',
          packageId: pkg.id,
        },
        select: { id: true },
      });
    } catch (err: any) {
      if (pkg.welcome && err?.code === 'P2002') {
        throw new ConflictException('Płatność za pakiet powitalny jest już przygotowywana. Odśwież stronę.');
      }
      throw err;
    }

    try {
      const customerId = await this.ensureCustomer(userId);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        // Payment methods (card, BLIK, Przelewy24...) are managed in the Stripe dashboard.
        customer: customerId,
        client_reference_id: reservation.id,
        payment_intent_data: { statement_descriptor_suffix: this.statementDescriptorSuffix() },
        ...INVOICE_DETAILS_COLLECTION,
        invoice_creation: {
          enabled: true,
          invoice_data: {
            description: `${pkg.label} – AllGrafika (${pkg.credits} kredytów)`,
            metadata: { userId, packageId },
          },
        },
        line_items: [
          {
            price_data: {
              currency: 'pln',
              unit_amount: pkg.priceGrosze,
              product_data: {
                name: pkg.label + ' - AllGrafika',
                description: 'Doładowanie ' + pkg.credits + ' kredytów do generowania grafik produktowych',
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId,
          packageId,
          transactionId: reservation.id,
          credits: String(pkg.credits),
          // Consumer-law consent (art. 38 pkt 13) collected in our UI before this call.
          withdrawalWaiverAcceptedAt: new Date().toISOString(),
        },
        success_url: this.frontendUrl() + '/credits?success=1',
        cancel_url: this.frontendUrl() + '/credits?canceled=1',
      });
      await this.prisma.paymentTransaction.update({
        where: { id: reservation.id },
        data: { stripeSessionId: session.id },
      });
      return { url: session.url };
    } catch (err) {
      await this.prisma.paymentTransaction.delete({ where: { id: reservation.id } }).catch(() => undefined);
      throw err;
    }
  }

  /**
   * An unfinished welcome checkout of this account: an open Stripe session is handed out again (no second
   * session), a paid one refuses, an expired or abandoned one is closed so a new attempt can start.
   */
  private async reusableWelcomeCheckout(userId: string): Promise<{ url: string } | null> {
    const previous = await this.prisma.paymentTransaction.findFirst({
      where: { userId, packageId: WELCOME_PACKAGE.id, status: TRANSACTION_STATUS.pending },
    });
    if (!previous) return null;

    if (previous.stripeSessionId.startsWith(RESERVATION_PREFIX)) {
      if (Date.now() - previous.createdAt.getTime() < RESERVATION_STALE_MS) {
        throw new ConflictException('Płatność za pakiet powitalny jest już przygotowywana. Odśwież stronę.');
      }
      this.logger.warn(`Abandoned welcome reservation ${previous.id} closed`);
      await this.markTransactionById(previous.id, TRANSACTION_STATUS.expired);
      return null;
    }

    const session = await this.stripe.checkout.sessions.retrieve(previous.stripeSessionId).catch((err: any) => {
      // A session Stripe does not know any more cannot be paid – start again; other errors bubble up.
      if (err?.statusCode === 404) return null;
      throw err;
    });
    if (session?.status === 'open' && session.url) return { url: session.url };
    if (session?.status === 'complete') {
      throw new BadRequestException('Pakiet powitalny jest już opłacony – kredyty pojawią się za chwilę.');
    }
    await this.markTransactionById(previous.id, TRANSACTION_STATUS.expired);
    return null;
  }

  private async markTransactionById(id: string, status: 'expired' | 'failed') {
    await this.prisma.paymentTransaction.updateMany({
      where: { id, status: TRANSACTION_STATUS.pending, completedAt: null },
      data: { status },
    });
  }

  // ─── Subscriptions ────────────────────────────────────────────────

  /** Spec 13: only confirmed accounts may pay (otherwise they would buy credits they cannot spend). */
  private async assertCanPurchase(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } });
    if (!user) throw new BadRequestException('Nie znaleziono użytkownika');
    if (this.verificationRequired && !user.emailVerifiedAt) throw emailNotVerifiedException();
  }

  /**
   * The Stripe customer carries the invoice details (name, address, tax id) between purchases. Two
   * parallel first purchases keep one customer: only the first write wins, the loser's is deleted.
   */
  private async ensureCustomer(userId: string): Promise<string> {
    const stripe = this.requireStripe();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Nie znaleziono użytkownika');
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || undefined,
      metadata: { userId },
    });
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, stripeCustomerId: null },
      data: { stripeCustomerId: customer.id },
    });
    if (count === 1) return customer.id;

    const winner = await this.prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
    await Promise.resolve(stripe.customers.del?.(customer.id)).catch(() => undefined);
    return winner?.stripeCustomerId ?? customer.id;
  }

  async createSubscriptionSession(userId: string, planId: string) {
    const stripe = this.requireStripe();
    const plan = findPlan(planId);
    const priceId = plan && this.stripePriceId(plan);
    // AC-PAY-023: never start a subscription whose Stripe price differs from the advertised one.
    if (!plan || !priceId || !(await this.isPlanAvailable(plan))) {
      throw new BadRequestException('Ten plan nie jest obecnie dostępny');
    }

    const existing = await this.prisma.subscription.findUnique({ where: { userId } });
    if (existing && ACTIVE_SUBSCRIPTION_STATUSES.includes(existing.status)) {
      // Webhooks may arrive out of order – confirm with Stripe before refusing.
      const live = await this.refreshSubscriptionFromStripe(existing.stripeSubscriptionId);
      if (!live || ACTIVE_SUBSCRIPTION_STATUSES.includes(live.status)) {
        throw new BadRequestException('Masz już aktywną subskrypcję. Zmień plan w panelu zarządzania subskrypcją.');
      }
    }

    await this.assertCanPurchase(userId);
    const customerId = await this.ensureCustomer(userId);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      ...INVOICE_DETAILS_COLLECTION,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId, planId, withdrawalWaiverAcceptedAt: new Date().toISOString() },
      subscription_data: { metadata: { userId, planId } },
      allow_promotion_codes: true,
      success_url: this.frontendUrl() + '/credits?subscribed=1',
      cancel_url: this.frontendUrl() + '/credits?canceled=1',
    });
    return { url: session.url };
  }

  /** Stripe Billing Portal – the user cancels, upgrades or updates the card there. */
  async createPortalSession(userId: string) {
    const stripe = this.requireStripe();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.stripeCustomerId) throw new NotFoundException('Brak aktywnej subskrypcji');
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: this.frontendUrl() + '/credits',
    });
    return { url: session.url };
  }

  /** Re-reads a subscription from Stripe and stores its real state (guards against out-of-order webhooks). */
  private async refreshSubscriptionFromStripe(stripeSubscriptionId: string): Promise<{ status: string } | null> {
    try {
      const sub = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
      await this.syncSubscription(sub);
      return { status: sub.status };
    } catch (err: any) {
      this.logger.warn(`Could not retrieve subscription ${stripeSubscriptionId}: ${err?.message}`);
      return null;
    }
  }

  /** Called before an account is erased – a deleted user must not keep being charged. */
  async cancelSubscriptionForUser(userId: string): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub || !ACTIVE_SUBSCRIPTION_STATUSES.includes(sub.status) || !this.stripe) return;
    try {
      await this.stripe.subscriptions.cancel(sub.stripeSubscriptionId);
      this.logger.log(`Cancelled Stripe subscription ${sub.stripeSubscriptionId} for deleted user ${userId}`);
    } catch (err: any) {
      // Do not block the erasure request; log loudly so it can be handled manually.
      this.logger.error(
        `Could not cancel subscription ${sub.stripeSubscriptionId} for user ${userId}: ${err?.message}`,
      );
    }
  }

  async getSubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) return null;
    const plan = findPlan(sub.planId);
    return {
      planId: sub.planId,
      planName: plan?.name ?? sub.planId,
      creditsPerMonth: plan?.credits ?? null,
      status: sub.status,
      active: ACTIVE_SUBSCRIPTION_STATUSES.includes(sub.status),
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    };
  }

  // ─── Webhooks ─────────────────────────────────────────────────────

  async handleWebhook(payload: Buffer, signature: string) {
    const stripe = this.requireStripe();

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret || /PLACEHOLDER/i.test(webhookSecret)) {
      throw new ServiceUnavailableException('Webhook secret nie jest skonfigurowany');
    }

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      this.logger.error('Webhook signature verification failed', err);
      throw new BadRequestException('Nieprawidłowy podpis webhooka');
    }

    // A test-mode endpoint pointed at production (or vice versa) must never move real credits.
    const liveKey = (this.configService.get<string>('STRIPE_SECRET_KEY') || '').startsWith('sk_live_');
    if (typeof event.livemode === 'boolean' && event.livemode !== liveKey) {
      this.logger.warn(
        `Ignoring ${event.type} ${event.id}: livemode=${event.livemode} does not match the configured key`,
      );
      return { received: true, ignored: 'livemode' };
    }

    const object = event.data?.object;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        if (object?.mode === 'subscription') await this.handleSubscriptionCheckout(object);
        else await this.handleCheckoutCompleted(object);
        break;
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed':
        await this.markTransaction(object?.id, event.type.endsWith('expired') ? 'expired' : 'failed');
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.syncSubscription(object);
        break;
      case 'charge.refunded':
        await this.handleChargeRefunded(event, object);
        break;
      case 'charge.dispute.created':
      case 'charge.dispute.closed':
        await this.handleDispute(event, object);
        break;
      default:
        break;
    }

    return { received: true };
  }

  /**
   * Idempotent: Stripe may deliver the same event several times (also in parallel). The row is locked and
   * only the delivery that finds it unfulfilled (`completedAt` null) adds credits – minus whatever a refund
   * that arrived earlier already took back (AC-PAY-021). The PaymentIntent is stored for refunds (AC-PAY-016).
   */
  private async handleCheckoutCompleted(session: any) {
    if (!session?.id) return;
    if (session.payment_status && session.payment_status !== 'paid') {
      this.logger.log(`Session ${session.id} completed but payment_status=${session.payment_status} – waiting`);
      return;
    }

    let transaction = await this.prisma.paymentTransaction.findUnique({ where: { stripeSessionId: session.id } });
    const reservedId = session.metadata?.transactionId || session.client_reference_id;
    if (!transaction && reservedId) {
      // The session was created but its id never reached the row (crash between the two writes).
      const reserved = await this.prisma.paymentTransaction.findUnique({ where: { id: String(reservedId) } });
      if (reserved?.stripeSessionId.startsWith(RESERVATION_PREFIX)) {
        transaction = await this.prisma.paymentTransaction.update({
          where: { id: reserved.id },
          data: { stripeSessionId: session.id },
        });
      }
    }
    if (!transaction) {
      this.logger.warn(`Webhook for unknown session ${session.id}`);
      return;
    }

    const paymentIntentId = idOf(session.payment_intent);
    const outcome = await this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<LockedTransaction[]>`
        SELECT "id", "userId", "status", "amountPln", "creditsAdded", "packageId", "completedAt", "amountRefunded",
               "disputeAmount", "disputeStatus", "creditsReversed", "creditsShortfall"
        FROM "payment_transactions" WHERE "id" = ${transaction.id} FOR UPDATE`;
      if (!row || row.completedAt) return { kind: 'duplicate' as const };
      if (row.status === TRANSACTION_STATUS.failed || row.status === TRANSACTION_STATUS.expired) {
        return { kind: 'closed' as const, status: row.status };
      }
      if (row.packageId === WELCOME_PACKAGE.id) {
        // Belt and braces next to the unique index: the welcome pack is never fulfilled twice.
        const earlier = await tx.paymentTransaction.count({
          where: { userId: row.userId, packageId: WELCOME_PACKAGE.id, completedAt: { not: null }, id: { not: row.id } },
        });
        if (earlier > 0) return { kind: 'welcome-twice' as const };
      }

      const net = Math.max(0, row.creditsAdded - row.creditsReversed);
      const piFree =
        paymentIntentId &&
        !(await tx.paymentTransaction.findUnique({ where: { stripePaymentIntentId: paymentIntentId } }));
      await tx.paymentTransaction.update({
        where: { id: row.id },
        data: {
          completedAt: new Date(),
          status: row.status === TRANSACTION_STATUS.pending ? TRANSACTION_STATUS.completed : row.status,
          ...(piFree ? { stripePaymentIntentId: paymentIntentId } : {}),
        },
      });
      if (net > 0) await tx.user.update({ where: { id: row.userId }, data: { credits: { increment: net } } });
      return { kind: 'added' as const, net, userId: row.userId };
    });

    if (outcome.kind === 'added') this.logger.log(`Added ${outcome.net} credits to user ${outcome.userId}`);
    else if (outcome.kind === 'duplicate') this.logger.warn(`Duplicate webhook for session ${session.id} ignored`);
    else if (outcome.kind === 'closed') {
      this.logger.error(`Session ${session.id} paid but its transaction is ${outcome.status} – no credits added`);
      await this.notifyAdmins('Płatność opłacona, kredyty nie dodane', [
        `Sesja Stripe ${session.id} została opłacona, ale transakcja ${transaction.id} ma status ${outcome.status}.`,
        `Konto: ${transaction.userId}. Sprawdź płatność w Stripe i zwróć ją albo dodaj kredyty ręcznie.`,
      ]);
    } else {
      this.logger.error(`Welcome pack of user ${transaction.userId} paid twice (session ${session.id}) – not granted`);
      await this.notifyAdmins('Drugi pakiet powitalny – kredyty nie dodane', [
        `Konto ${transaction.userId} opłaciło pakiet powitalny drugi raz (sesja ${session.id}, transakcja ${transaction.id}).`,
        'Kredyty nie zostały dodane. Zwróć płatność w Stripe.',
      ]);
    }

    // Payment details may arrive with any delivery – store them where still missing.
    const invoiceId = idOf(session.invoice);
    if (invoiceId) {
      await this.prisma.paymentTransaction.updateMany({
        where: { id: transaction.id, stripeInvoiceId: null },
        data: { stripeInvoiceId: invoiceId },
      });
    }
    if (paymentIntentId && outcome.kind === 'duplicate')
      await this.rememberPaymentIntent(transaction.id, paymentIntentId);
  }

  private async handleSubscriptionCheckout(session: any) {
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (!userId || !planId || !subscriptionId) return;

    if (session.customer && typeof session.customer === 'string') {
      await this.prisma.user.updateMany({
        where: { id: userId, stripeCustomerId: null },
        data: { stripeCustomerId: session.customer },
      });
    }
    await this.prisma.subscription.upsert({
      where: { userId },
      create: { userId, stripeSubscriptionId: subscriptionId, planId, status: 'active' },
      update: { stripeSubscriptionId: subscriptionId, planId, status: 'active', cancelAtPeriodEnd: false },
    });
  }

  /**
   * Credits for the first payment and each renewal of a subscription, idempotent per invoice id.
   * Proration / plan-change / manual invoices (`billing_reason` other than create/cycle) never grant
   * credits – otherwise an upgrade mid-cycle or a downgrade credit note would hand out a full month.
   */
  private async handleInvoicePaid(invoice: any) {
    if (!invoice?.id) return;
    // Stripe API 2025-03+ moved `subscription` under `parent.subscription_details`; support both shapes.
    const subscriptionId: string | undefined =
      (typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id) ||
      invoice.parent?.subscription_details?.subscription;
    if (!subscriptionId) return; // not a subscription invoice

    const reason: string | undefined = invoice.billing_reason;
    if (reason && reason !== 'subscription_create' && reason !== 'subscription_cycle') {
      this.logger.log(`invoice.paid ${invoice.id}: billing_reason=${reason} – no credits granted`);
      return;
    }

    const subscription = await this.prisma.subscription.findUnique({ where: { stripeSubscriptionId: subscriptionId } });
    const metadataPlan =
      invoice.parent?.subscription_details?.metadata?.planId || invoice.subscription_details?.metadata?.planId;
    // The price actually billed wins over metadata – the portal changes the price, never the metadata.
    const lines: any[] = invoice.lines?.data ?? [];
    const mainLine = [...lines].sort((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0))[0];
    const linePrice = mainLine?.pricing?.price_details?.price || mainLine?.price?.id;
    const plan =
      this.planByPriceId(linePrice) || findPlan(metadataPlan) || (subscription && findPlan(subscription.planId));

    let userId = subscription?.userId;
    if (!userId) {
      const metaUser =
        invoice.parent?.subscription_details?.metadata?.userId || invoice.subscription_details?.metadata?.userId;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      const user = metaUser
        ? await this.prisma.user.findUnique({ where: { id: metaUser } })
        : customerId
          ? await this.prisma.user.findUnique({ where: { stripeCustomerId: customerId } })
          : null;
      userId = user?.id;
    }
    if (!userId || !plan) {
      this.logger.warn(`invoice.paid ${invoice.id}: cannot resolve user/plan (sub=${subscriptionId})`);
      return;
    }

    const paymentIntentId = invoicePaymentIntentId(invoice);
    try {
      await this.prisma.$transaction(async (tx) => {
        const piFree =
          paymentIntentId &&
          !(await tx.paymentTransaction.findUnique({ where: { stripePaymentIntentId: paymentIntentId } }));
        await tx.paymentTransaction.create({
          data: {
            userId,
            stripeSessionId: invoice.id,
            amountPln: Number(invoice.amount_paid ?? plan.priceGrosze),
            creditsAdded: plan.credits,
            status: TRANSACTION_STATUS.completed,
            kind: 'subscription',
            stripeInvoiceId: invoice.id,
            completedAt: new Date(),
            ...(piFree ? { stripePaymentIntentId: paymentIntentId } : {}),
          },
        });
        await tx.user.update({ where: { id: userId }, data: { credits: { increment: plan.credits } } });
        await tx.subscription.upsert({
          where: { userId },
          create: { userId, stripeSubscriptionId: subscriptionId, planId: plan.id, status: 'active' },
          update: { stripeSubscriptionId: subscriptionId, planId: plan.id, status: 'active' },
        });
      });
      this.logger.log(`Subscription invoice ${invoice.id}: +${plan.credits} credits for user ${userId}`);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        this.logger.warn(`Duplicate invoice.paid ${invoice.id} ignored`);
        return;
      }
      throw err;
    }
  }

  private async syncSubscription(sub: any) {
    if (!sub?.id) return;
    const existing = await this.prisma.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
    const userId = existing?.userId || sub.metadata?.userId;
    if (!userId) return;

    const priceId = sub.items?.data?.[0]?.price?.id;
    const plan =
      this.planByPriceId(priceId) || findPlan(sub.metadata?.planId) || (existing && findPlan(existing.planId));
    // `current_period_end` lives on the subscription (older API) or on its items (2025-03+).
    const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;

    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeSubscriptionId: sub.id,
        planId: plan?.id ?? 'unknown',
        status: sub.status ?? 'active',
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      },
      update: {
        stripeSubscriptionId: sub.id,
        ...(plan ? { planId: plan.id } : {}),
        status: sub.status ?? existing?.status ?? 'active',
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : (existing?.currentPeriodEnd ?? null),
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      },
    });
  }

  private async markTransaction(sessionId: string | undefined, status: 'expired' | 'failed') {
    if (!sessionId) return;
    await this.prisma.paymentTransaction.updateMany({
      where: { stripeSessionId: sessionId, status: TRANSACTION_STATUS.pending, completedAt: null },
      data: { status },
    });
  }

  // ─── Refunds and disputes (spec 09, AC-PAY-017..022) ──────────────

  private async handleChargeRefunded(event: any, charge: any) {
    if (!charge) return;
    const transactionId = await this.matchPayment(event, {
      paymentIntentId: idOf(charge.payment_intent),
      invoiceId: idOf(charge.invoice),
      customerId: idOf(charge.customer),
      chargeId: idOf(charge.id),
    });
    if (!transactionId) return;
    await this.applyReversal(event, transactionId, 'refund', { amountRefunded: Number(charge.amount_refunded ?? 0) });
  }

  private async handleDispute(event: any, dispute: any) {
    if (!dispute) return;
    let state: DisputeState;
    if (event.type === 'charge.dispute.created') state = 'open';
    else if (dispute.status === 'lost') state = 'lost';
    else if (dispute.status === 'won' || dispute.status === 'warning_closed') state = 'won';
    else {
      this.logger.warn(`Dispute ${dispute.id} closed with unknown status ${dispute.status} – ignored`);
      return;
    }

    let paymentIntentId = idOf(dispute.payment_intent);
    let customerId: string | undefined;
    const charge = dispute.charge;
    if (charge && typeof charge === 'object') {
      paymentIntentId ||= idOf(charge.payment_intent);
      customerId = idOf(charge.customer);
    } else if (!paymentIntentId && typeof charge === 'string' && this.stripe?.charges?.retrieve) {
      const loaded = await this.stripe.charges.retrieve(charge);
      paymentIntentId = idOf(loaded?.payment_intent);
      customerId = idOf(loaded?.customer);
    }

    const transactionId = await this.matchPayment(event, { paymentIntentId, customerId, chargeId: idOf(charge) });
    if (!transactionId) return;
    await this.applyReversal(event, transactionId, 'dispute', {
      dispute: { status: state, amount: Number(dispute.amount ?? 0) },
    });
  }

  /**
   * Finds our transaction for a Stripe payment: by the stored PaymentIntent, by a legacy invoice id, and
   * for rows stored before PaymentIntents were kept, through Stripe (the Checkout session or the invoice
   * of that PaymentIntent). The Stripe account is shared with the JAN-MAT shop: foreign payments return
   * null without noise. A payment of our own customer that matches nothing is retried by Stripe (503)
   * for a few hours – e.g. invoice.paid is still on its way – and then reported to the admins.
   */
  private async matchPayment(
    event: any,
    ref: { paymentIntentId?: string; invoiceId?: string; customerId?: string; chargeId?: string },
  ): Promise<string | null> {
    const { paymentIntentId, invoiceId } = ref;
    if (paymentIntentId) {
      const row = await this.prisma.paymentTransaction.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
        select: { id: true },
      });
      if (row) return row.id;
    }
    if (invoiceId) {
      const row = await this.prisma.paymentTransaction.findFirst({
        where: { OR: [{ stripeInvoiceId: invoiceId }, { stripeSessionId: invoiceId }] },
        select: { id: true },
      });
      if (row) return this.rememberPaymentIntent(row.id, paymentIntentId);
    }

    if (paymentIntentId && this.stripe) {
      const sessions = await this.stripe.checkout?.sessions?.list?.({ payment_intent: paymentIntentId, limit: 3 });
      for (const session of sessions?.data ?? []) {
        const row = await this.prisma.paymentTransaction.findUnique({
          where: { stripeSessionId: session.id },
          select: { id: true },
        });
        if (row) return this.rememberPaymentIntent(row.id, paymentIntentId);
      }
      const payments = await this.stripe.invoicePayments?.list?.({
        payment: { type: 'payment_intent', payment_intent: paymentIntentId },
        limit: 3,
      });
      for (const payment of payments?.data ?? []) {
        const invoice = idOf(payment?.invoice);
        if (!invoice) continue;
        const row = await this.prisma.paymentTransaction.findFirst({
          where: { OR: [{ stripeInvoiceId: invoice }, { stripeSessionId: invoice }] },
          select: { id: true },
        });
        if (row) return this.rememberPaymentIntent(row.id, paymentIntentId);
      }
    }

    const ours = ref.customerId
      ? await this.prisma.user.findUnique({ where: { stripeCustomerId: ref.customerId }, select: { id: true } })
      : null;
    if (!ours) {
      this.logger.log(`${event.type} ${event.id}: payment ${paymentIntentId ?? ref.chargeId} is not ours – ignored`);
      return null;
    }

    const ageMs = typeof event.created === 'number' ? Date.now() - event.created * 1000 : Infinity;
    if (ageMs < UNMATCHED_RETRY_WINDOW_MS) {
      this.logger.warn(
        `${event.type} ${event.id}: payment of user ${ours.id} not matched yet – asking Stripe to retry`,
      );
      throw new ServiceUnavailableException('Płatność nie jest jeszcze zarejestrowana – spróbuj ponownie później');
    }
    if (await this.recordEvent(event)) {
      this.logger.error(`${event.type} ${event.id}: payment of user ${ours.id} matches no transaction`);
      await this.notifyAdmins('Nie dopasowano zwrotu lub sporu', [
        `Zdarzenie ${event.type} (${event.id}) dotyczy płatności klienta AllGrafiki (konto ${ours.id}),`,
        `ale nie znaleziono transakcji (PaymentIntent ${paymentIntentId ?? '-'}, charge ${ref.chargeId ?? '-'}).`,
        'Kredyty nie zostały zmienione – sprawdź płatność w Stripe i popraw saldo ręcznie.',
      ]);
    }
    return null;
  }

  /** Stores a PaymentIntent found later on a row that has none yet (best effort). */
  private async rememberPaymentIntent(transactionId: string, paymentIntentId: string | undefined) {
    if (paymentIntentId) {
      await this.prisma.paymentTransaction
        .updateMany({
          where: { id: transactionId, stripePaymentIntentId: null },
          data: { stripePaymentIntentId: paymentIntentId },
        })
        .catch((err) => this.logger.warn(`Could not store PaymentIntent on ${transactionId}: ${err?.message}`));
    }
    return transactionId;
  }

  /** Records a processed Stripe event outside any other work; false when it was already recorded. */
  private async recordEvent(event: any): Promise<boolean> {
    const inserted = await this.prisma.$executeRaw`
      INSERT INTO "stripe_events" ("id", "type") VALUES (${String(event.id)}, ${String(event.type)})
      ON CONFLICT ("id") DO NOTHING`;
    return inserted === 1;
  }

  /**
   * Applies a refund / dispute to the payment, once per Stripe event id (recorded in the same database
   * transaction). The target number of reversed credits is recomputed from the cumulative amounts, so the
   * order of events does not matter: only an increase is taken from the balance (never below 0 – the rest
   * is the shortfall) and a decrease (dispute won) is given back, the shortfall first. Before fulfilment
   * nothing is moved – the completion adds only what is left (AC-PAY-021).
   */
  private async applyReversal(event: any, transactionId: string, kind: 'refund' | 'dispute', change: ReversalChange) {
    const outcome = await this.prisma.$transaction(async (tx): Promise<ReversalOutcome | null> => {
      const inserted = await tx.$executeRaw`
        INSERT INTO "stripe_events" ("id", "type") VALUES (${String(event.id)}, ${String(event.type)})
        ON CONFLICT ("id") DO NOTHING`;
      if (inserted !== 1) return null;

      const [row] = await tx.$queryRaw<LockedTransaction[]>`
        SELECT "id", "userId", "status", "amountPln", "creditsAdded", "packageId", "completedAt", "amountRefunded",
               "disputeAmount", "disputeStatus", "creditsReversed", "creditsShortfall"
        FROM "payment_transactions" WHERE "id" = ${transactionId} FOR UPDATE`;
      if (!row) return null;

      const next: LockedTransaction = { ...row };
      if (change.amountRefunded !== undefined) {
        // Stripe reports the running total – an older (smaller) total never gives credits back.
        next.amountRefunded = Math.max(row.amountRefunded, Math.min(row.amountPln, change.amountRefunded));
      }
      if (change.dispute) {
        const closed = row.disputeStatus === 'won' || row.disputeStatus === 'lost';
        if (!(closed && change.dispute.status === 'open')) {
          next.disputeStatus = change.dispute.status;
          next.disputeAmount = change.dispute.status === 'won' ? 0 : Math.max(0, change.dispute.amount);
        }
      }

      const target = creditsToReverse(next);
      let balanceChange = 0;
      let balanceAfter: number | null = null;
      if (row.completedAt) {
        const [user] = await tx.$queryRaw<{ credits: number }[]>`
          SELECT "credits" FROM "users" WHERE "id" = ${row.userId} FOR UPDATE`;
        let credits = user?.credits ?? 0;
        if (target > row.creditsReversed) {
          const wanted = target - row.creditsReversed;
          const removed = Math.min(wanted, Math.max(0, credits));
          next.creditsShortfall = row.creditsShortfall + (wanted - removed);
          credits -= removed;
          balanceChange = removed;
        } else if (target < row.creditsReversed) {
          const back = row.creditsReversed - target;
          const cleared = Math.min(row.creditsShortfall, back);
          next.creditsShortfall = row.creditsShortfall - cleared;
          credits += back - cleared;
          balanceChange = -(back - cleared);
        }
        if (balanceChange !== 0 && user) {
          await tx.user.update({ where: { id: row.userId }, data: { credits: { decrement: balanceChange } } });
        }
        balanceAfter = user ? credits : null;
      }
      next.creditsReversed = target;
      next.status = reversalStatus(next);

      await tx.paymentTransaction.update({
        where: { id: row.id },
        data: {
          amountRefunded: next.amountRefunded,
          disputeAmount: next.disputeAmount,
          disputeStatus: next.disputeStatus,
          creditsReversed: next.creditsReversed,
          creditsShortfall: next.creditsShortfall,
          status: next.status,
        },
      });

      return {
        transactionId: row.id,
        userId: row.userId,
        kind,
        status: next.status,
        amountPln: row.amountPln,
        amountRefunded: next.amountRefunded,
        disputeStatus: next.disputeStatus,
        creditsAdded: row.creditsAdded,
        creditsReversed: next.creditsReversed,
        creditsShortfall: next.creditsShortfall,
        balanceChange,
        balanceAfter,
      };
    });

    if (!outcome) {
      this.logger.warn(`Duplicate ${event.type} ${event.id} ignored`);
      return;
    }
    this.logger.warn(
      `${event.type} ${event.id}: transaction ${outcome.transactionId} → ${outcome.status}, ` +
        `credits ${outcome.balanceChange >= 0 ? '-' : '+'}${Math.abs(outcome.balanceChange)} ` +
        `(reversed ${outcome.creditsReversed}/${outcome.creditsAdded}, shortfall ${outcome.creditsShortfall})`,
    );
    await this.notifyReversal(event, outcome);
  }

  private async notifyReversal(event: any, o: ReversalOutcome) {
    const user = await this.prisma.user.findUnique({ where: { id: o.userId }, select: { email: true } });
    const what =
      o.kind === 'refund'
        ? 'Zwrot płatności'
        : o.disputeStatus === 'open'
          ? 'Spór (chargeback) otwarty'
          : `Spór zamknięty: ${o.disputeStatus === 'won' ? 'wygrany' : 'przegrany'}`;
    await this.notifyAdmins(`${what} – ${user?.email ?? o.userId}`, [
      `${what} (${event.type}, ${event.id}).`,
      `Konto: ${user?.email ?? '(usunięte)'} (${o.userId})`,
      `Transakcja: ${o.transactionId}, status: ${o.status}`,
      `Zapłacono: ${zl(o.amountPln)}, zwrócono łącznie: ${zl(o.amountRefunded)}, spór: ${o.disputeStatus ?? 'brak'}`,
      `Kredyty z płatności: ${o.creditsAdded}, odebrane łącznie: ${o.creditsReversed}, niedobór (już wydane): ${o.creditsShortfall}`,
      o.balanceChange >= 0
        ? `Teraz odebrano z salda: ${o.balanceChange}`
        : `Teraz oddano na saldo: ${-o.balanceChange}`,
      `Saldo kupionych kredytów po zmianie: ${o.balanceAfter ?? 'płatność jeszcze nie zrealizowana'}`,
      '',
      `Panel: ${this.frontendUrl()}/admin`,
    ]);
  }

  /**
   * Operator alert (spec 16 – ADMIN_EMAILS + MailService). Best effort: the accounting is already
   * committed, a mail failure only gets logged.
   */
  private async notifyAdmins(subject: string, lines: string[]) {
    const admins = [...parseAdminEmails(this.configService.get<string>('ADMIN_EMAILS'))];
    if (!admins.length) {
      this.logger.warn(`ADMIN_EMAILS not set – alert not e-mailed: ${subject}`);
      return;
    }
    for (const to of admins) {
      try {
        await this.mail.send({ to, subject: `[AllGrafika] ${subject}`, text: lines.join('\n') });
      } catch (err: any) {
        this.logger.error(`Could not e-mail payment alert to an administrator: ${err?.message}`);
      }
    }
  }

  // ─── History and invoices ─────────────────────────────────────────

  async getTransactionHistory(userId: string) {
    const rows = await this.prisma.paymentTransaction.findMany({
      where: { userId, NOT: { stripeSessionId: { startsWith: RESERVATION_PREFIX } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        creditsAdded: true,
        amountPln: true,
        status: true,
        kind: true,
        createdAt: true,
        stripeInvoiceId: true,
        amountRefunded: true,
        creditsReversed: true,
      },
    });
    // The Stripe id stays on the server; the UI only needs to know an invoice exists.
    return rows.map(({ stripeInvoiceId, ...row }) => ({ ...row, hasInvoice: Boolean(stripeInvoiceId) }));
  }

  /**
   * Fresh link to the invoice PDF (Stripe links expire, so they are never stored). Only the owner
   * of the transaction gets it; transactions without an invoice are a 404.
   */
  async getInvoiceUrl(userId: string, transactionId: string): Promise<{ url: string }> {
    const tx = await this.prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      select: { userId: true, stripeInvoiceId: true },
    });
    if (!tx || tx.userId !== userId || !tx.stripeInvoiceId)
      throw new NotFoundException('Brak faktury dla tej płatności');
    const stripe = this.requireStripe();
    const invoice = await stripe.invoices.retrieve(tx.stripeInvoiceId);
    const url: string | undefined = invoice?.invoice_pdf || invoice?.hosted_invoice_url;
    if (!url) throw new NotFoundException('Faktura nie jest jeszcze gotowa. Spróbuj za kilka minut.');
    return { url };
  }
}
