import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { findPlan } from '../payments/plans';

const STALE_MINUTES = 20;

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const staleCutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [users, usersLast30d, byStatus, stale, revenue, revenue30d, subscriptions, demoLeads, demoLeads30d, rated] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
        this.prisma.generation.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.generation.count({
          where: { status: { in: ['PENDING', 'PROCESSING'] }, updatedAt: { lt: staleCutoff } },
        }),
        this.prisma.paymentTransaction.aggregate({
          where: { status: 'completed' },
          _sum: { amountPln: true, creditsAdded: true },
          _count: { _all: true },
        }),
        this.prisma.paymentTransaction.aggregate({
          where: { status: 'completed', createdAt: { gte: monthAgo } },
          _sum: { amountPln: true },
        }),
        this.prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.demoRequest.count(),
        this.prisma.demoRequest.count({ where: { createdAt: { gte: monthAgo } } }),
        this.prisma.generation.count({ where: { rating: { not: null } } }),
      ]);

    return {
      users: { total: users, last30d: usersLast30d },
      generations: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      /** Rows the reconciler will fail + refund on its next run – check before a deploy. */
      staleGenerations: stale,
      revenue: {
        completedTransactions: revenue._count._all,
        totalGrosze: revenue._sum.amountPln ?? 0,
        last30dGrosze: revenue30d._sum.amountPln ?? 0,
        creditsSold: revenue._sum.creditsAdded ?? 0,
      },
      subscriptions: Object.fromEntries(subscriptions.map((r) => [r.status, r._count._all])),
      demo: { leads: demoLeads, last30d: demoLeads30d },
      ratedGenerations: rated,
    };
  }

  async feedbackStats() {
    const rows = await this.prisma.generation.groupBy({
      by: ['style', 'rating'],
      where: { rating: { not: null } },
      _count: { _all: true },
    });
    const byStyle = new Map<string, { up: number; down: number }>();
    for (const row of rows) {
      const key = row.style || 'custom';
      const entry = byStyle.get(key) ?? { up: 0, down: 0 };
      if (row.rating === 1) entry.up += row._count._all;
      else entry.down += row._count._all;
      byStyle.set(key, entry);
    }

    const reasons = await this.prisma.generation.findMany({
      where: { rating: -1, ratingReason: { not: null } },
      select: { style: true, ratingReason: true },
      take: 2000,
      orderBy: { updatedAt: 'desc' },
    });
    const reasonCounts = new Map<string, number>();
    for (const r of reasons) {
      const key = `${r.style || 'custom'}:${(r.ratingReason || 'other').split(':')[0]}`;
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }

    return {
      styles: [...byStyle.entries()]
        .map(([style, c]) => ({
          style,
          ...c,
          approval: c.up + c.down ? Math.round((100 * c.up) / (c.up + c.down)) : null,
        }))
        .sort((a, b) => (a.approval ?? 101) - (b.approval ?? 101)),
      topReasons: [...reasonCounts.entries()]
        .map(([key, count]) => ({ style: key.split(':')[0], reason: key.split(':')[1], count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
    };
  }

  /**
   * Consumer withdrawal from a subscription within 14 days (art. 35 u.p.k.): the
   * consumer pays for what was delivered. Delivered = credits of the plan that were
   * actually used (plan credits minus whatever is still on the balance, capped).
   * This is a quote for the operator, who issues the refund in Stripe and cancels the plan.
   */
  async withdrawalQuote(email: string) {
    if (!email) throw new BadRequestException('email jest wymagany');
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { subscription: true },
    });
    if (!user) throw new NotFoundException('Nie znaleziono użytkownika');
    const sub = user.subscription;
    if (!sub) throw new NotFoundException('Użytkownik nie ma subskrypcji');
    const plan = findPlan(sub.planId);
    if (!plan) throw new NotFoundException('Nieznany plan subskrypcji');

    const daysSinceStart = Math.floor((Date.now() - sub.createdAt.getTime()) / 86_400_000);
    const unitPriceGrosze = Math.round(plan.priceGrosze / plan.credits);
    const creditsUsedFromPlan = Math.max(0, plan.credits - Math.min(plan.credits, user.credits));
    const chargeForUsedGrosze = creditsUsedFromPlan * unitPriceGrosze;
    const refundGrosze = Math.max(0, plan.priceGrosze - chargeForUsedGrosze);

    return {
      email: user.email,
      plan: plan.id,
      subscriptionStatus: sub.status,
      subscriptionStartedAt: sub.createdAt,
      daysSinceStart,
      withinWithdrawalWindow: daysSinceStart <= 14,
      planCredits: plan.credits,
      creditsOnBalance: user.credits,
      creditsUsedFromPlan,
      unitPriceGrosze,
      chargeForUsedGrosze,
      suggestedRefundGrosze: refundGrosze,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      procedure: [
        'Stripe → Subscriptions → anuluj subskrypcję natychmiast (bez proraty).',
        `Stripe → ostatnia faktura → Refund na kwotę ${(refundGrosze / 100).toFixed(2)} zł.`,
        `W bazie: credits -= ${Math.min(plan.credits, user.credits)} (zabierz niewykorzystane kredyty z planu).`,
        'Odpowiedz konsumentowi w ciągu 14 dni od otrzymania oświadczenia (art. 32 u.p.k.).',
      ],
    };
  }
}
