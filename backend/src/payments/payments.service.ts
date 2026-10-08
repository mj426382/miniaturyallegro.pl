import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CREDIT_PACKAGES, SUBSCRIPTION_PLANS, findPackage, findPlan, SubscriptionPlan } from './plans';
import { emailNotVerifiedException, isVerificationRequired } from '../auth/email-verification';

// Stripe v22 CJS – use require to avoid TS namespace issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StripeLib = require('stripe');

export const TRANSACTION_STATUS = {
  pending: 'pending',
  completed: 'completed',
  failed: 'failed',
  expired: 'expired',
} as const;

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'];

/**
 * Spec 09: every payment gets a Stripe invoice. Checkout asks for the billing address and lets the
 * buyer tick "purchasing as a business" with a NIP; both are saved on the Stripe customer.
 */
const INVOICE_DETAILS_COLLECTION = {
  billing_address_collection: 'required',
  tax_id_collection: { enabled: true },
  customer_update: { name: 'auto', address: 'auto' },
} as const;

@Injectable()
export class PaymentsService {
  private stripe: any = null;
  private readonly logger = new Logger(PaymentsService.name);
  private readonly verificationRequired: boolean;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
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

  getPlans() {
    return SUBSCRIPTION_PLANS.map((plan) => ({
      id: plan.id,
      name: plan.name,
      credits: plan.credits,
      priceGrosze: plan.priceGrosze,
      priceLabel: plan.priceLabel,
      description: plan.description,
      available: Boolean(this.stripe && this.stripePriceId(plan)),
    }));
  }

  private stripePriceId(plan: SubscriptionPlan): string | undefined {
    const value = this.configService.get<string>(plan.priceEnv);
    return value && !/PLACEHOLDER/i.test(value) ? value : undefined;
  }

  private planByPriceId(priceId: string | undefined): SubscriptionPlan | undefined {
    if (!priceId) return undefined;
    return SUBSCRIPTION_PLANS.find((p) => this.stripePriceId(p) === priceId);
  }

  // ─── One-time packs ───────────────────────────────────────────────

  async createCheckoutSession(userId: string, packageId: string) {
    const stripe = this.requireStripe();
    const pkg = findPackage(packageId);
    if (!pkg) throw new BadRequestException('Nieprawidłowy pakiet');

    await this.assertCanPurchase(userId);
    const customerId = await this.ensureCustomer(userId);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Payment methods (card, BLIK, Przelewy24...) are managed in the Stripe dashboard.
      customer: customerId,
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
        credits: String(pkg.credits),
        // Consumer-law consent (art. 38 pkt 13) collected in our UI before this call.
        withdrawalWaiverAcceptedAt: new Date().toISOString(),
      },
      success_url: this.frontendUrl() + '/credits?success=1',
      cancel_url: this.frontendUrl() + '/credits?canceled=1',
    });

    await this.prisma.paymentTransaction.create({
      data: {
        userId,
        stripeSessionId: session.id,
        amountPln: pkg.priceGrosze,
        creditsAdded: pkg.credits,
        status: TRANSACTION_STATUS.pending,
        kind: 'package',
      },
    });

    return { url: session.url };
  }

  // ─── Subscriptions ────────────────────────────────────────────────

  /** Spec 13: only confirmed accounts may pay (otherwise they would buy credits they cannot spend). */
  private async assertCanPurchase(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } });
    if (!user) throw new BadRequestException('Nie znaleziono użytkownika');
    if (this.verificationRequired && !user.emailVerifiedAt) throw emailNotVerifiedException();
  }

  /** The Stripe customer carries the invoice details (name, address, tax id) between purchases. */
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
    await this.prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
    return customer.id;
  }

  async createSubscriptionSession(userId: string, planId: string) {
    const stripe = this.requireStripe();
    const plan = findPlan(planId);
    const priceId = plan && this.stripePriceId(plan);
    if (!plan || !priceId) throw new BadRequestException('Ten plan nie jest obecnie dostępny');

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
      default:
        break;
    }

    return { received: true };
  }

  /**
   * Idempotent: Stripe may deliver the same event several times. Only the
   * request that flips the row from `pending` to `completed` adds credits.
   */
  private async handleCheckoutCompleted(session: any) {
    if (!session?.id) return;
    if (session.payment_status && session.payment_status !== 'paid') {
      this.logger.log(`Session ${session.id} completed but payment_status=${session.payment_status} – waiting`);
      return;
    }

    const transaction = await this.prisma.paymentTransaction.findUnique({ where: { stripeSessionId: session.id } });
    if (!transaction) {
      this.logger.warn(`Webhook for unknown session ${session.id}`);
      return;
    }

    const added = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.paymentTransaction.updateMany({
        where: { id: transaction.id, status: TRANSACTION_STATUS.pending },
        data: { status: TRANSACTION_STATUS.completed },
      });
      if (count !== 1) return false;
      await tx.user.update({
        where: { id: transaction.userId },
        data: { credits: { increment: transaction.creditsAdded } },
      });
      return true;
    });

    if (added) this.logger.log(`Added ${transaction.creditsAdded} credits to user ${transaction.userId}`);
    else this.logger.warn(`Duplicate webhook for session ${session.id} ignored`);

    const invoiceId = typeof session.invoice === 'string' ? session.invoice : session.invoice?.id;
    if (invoiceId) {
      await this.prisma.paymentTransaction.updateMany({
        where: { id: transaction.id, stripeInvoiceId: null },
        data: { stripeInvoiceId: invoiceId },
      });
    }
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

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.paymentTransaction.create({
          data: {
            userId,
            stripeSessionId: invoice.id,
            amountPln: Number(invoice.amount_paid ?? plan.priceGrosze),
            creditsAdded: plan.credits,
            status: TRANSACTION_STATUS.completed,
            kind: 'subscription',
            stripeInvoiceId: invoice.id,
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
      where: { stripeSessionId: sessionId, status: TRANSACTION_STATUS.pending },
      data: { status },
    });
  }

  async getTransactionHistory(userId: string) {
    const rows = await this.prisma.paymentTransaction.findMany({
      where: { userId },
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
