import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// Stripe v22 CJS – use require to avoid TS namespace issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StripeLib = require('stripe');

export const CREDIT_PACKAGES = [
  { id: 'credits_5',  credits: 5,  priceGrosze: 1000, label: '5 kredytów',  priceLabel: '10 zł', savingLabel: null },
  { id: 'credits_15', credits: 15, priceGrosze: 2800, label: '15 kredytów', priceLabel: '28 zł', savingLabel: 'Oszczędzasz 2 zł' },
  { id: 'credits_40', credits: 40, priceGrosze: 7000, label: '40 kredytów', priceLabel: '70 zł', savingLabel: 'Oszczędzasz 10 zł' },
];

@Injectable()
export class PaymentsService {
  private stripe: any = null;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const key = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (key && key !== 'sk_test_PLACEHOLDER') {
      this.stripe = new StripeLib(key, { apiVersion: '2026-03-25.dahlia' });
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not configured -- payments disabled');
    }
  }

  getPackages() {
    return CREDIT_PACKAGES;
  }

  async createCheckoutSession(userId: string, packageId: string) {
    if (!this.stripe) {
      throw new BadRequestException('Platnosci nie sa skonfigurowane. Skontaktuj sie z administratorem.');
    }

    const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) throw new BadRequestException('Nieprawidlowy pakiet');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Nie znaleziono uzytkownika');

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'pln',
            unit_amount: pkg.priceGrosze,
            product_data: {
              name: pkg.label + ' - AllGrafika',
              description: 'Doladowanie ' + pkg.credits + ' kredytow do generowania miniaturek',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        packageId,
        credits: String(pkg.credits),
      },
      success_url: frontendUrl + '/credits?success=1',
      cancel_url: frontendUrl + '/credits?canceled=1',
    });

    await this.prisma.paymentTransaction.create({
      data: {
        userId,
        stripeSessionId: session.id,
        amountPln: pkg.priceGrosze,
        creditsAdded: pkg.credits,
        status: 'pending',
      },
    });

    return { url: session.url };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    if (!this.stripe) {
      throw new BadRequestException('Platnosci nie sa skonfigurowane');
    }

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret || webhookSecret === 'whsec_PLACEHOLDER') {
      throw new BadRequestException('Webhook secret nie jest skonfigurowany');
    }

    let event: any;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      this.logger.error('Webhook signature verification failed', err);
      throw new BadRequestException('Nieprawidlowy podpis webhooka');
    }

    if (event.type === 'checkout.session.completed') {
      await this.handleCheckoutCompleted(event.data.object);
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: any) {
    const creditsToAdd = parseInt(session.metadata?.credits || '0');
    if (!creditsToAdd) return;

    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { stripeSessionId: session.id },
    });

    if (!transaction || transaction.status === 'completed') {
      this.logger.warn('Duplicate or missing transaction for session ' + session.id);
      return;
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: transaction.userId },
        data: { credits: { increment: creditsToAdd } },
      }),
      this.prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: { status: 'completed' },
      }),
    ]);

    this.logger.log('Added ' + creditsToAdd + ' credits to user ' + transaction.userId);
  }

  async getTransactionHistory(userId: string) {
    return this.prisma.paymentTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
