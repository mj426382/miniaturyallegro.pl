import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreditsService } from '../generation/credits.service';
import { findPlan } from '../payments/plans';
import { renderEmail } from '../notifications/email-template';

export const ADMIN_PAGE_SIZE = 20;

interface UserStats {
  completedGenerations: number;
  failedGenerations: number;
  lastGenerationAt: Date | null;
  paidTotalGrosze: number;
}

/** Spec 16: the operator's view of accounts and individual messages to a user. */
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private credits: CreditsService,
  ) {}

  async list(options: { search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(Math.max(options.limit ?? ADMIN_PAGE_SIZE, 1), 100);
    const search = options.search?.trim();
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: this.userSelect,
      }),
    ]);
    const stats = await this.statsFor(users.map((u) => u.id));
    return {
      users: users.map((u) => this.toRow(u, stats.get(u.id))),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async detail(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: this.userSelect });
    if (!user) throw new NotFoundException('Nie znaleziono użytkownika');
    const [stats, payments, emails, subscription] = await Promise.all([
      this.statsFor([userId]),
      this.prisma.paymentTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          amountPln: true,
          creditsAdded: true,
          status: true,
          kind: true,
          createdAt: true,
          stripeInvoiceId: true,
        },
      }),
      this.prisma.emailLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, kind: true, subject: true, body: true, sentBy: true, createdAt: true },
      }),
      this.prisma.subscription.findUnique({ where: { userId } }),
    ]);
    return {
      ...this.toRow(user, stats.get(userId)),
      subscription: subscription
        ? {
            planId: subscription.planId,
            planName: findPlan(subscription.planId)?.name ?? subscription.planId,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
      payments: payments.map(({ stripeInvoiceId, ...p }) => ({ ...p, hasInvoice: Boolean(stripeInvoiceId) })),
      emails,
    };
  }

  /** Individual message from the operator; replies go straight to the operator's mailbox. */
  async sendEmail(adminEmail: string, userId: string, subject: string, message: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new NotFoundException('Nie znaleziono użytkownika');
    const paragraphs = message
      .trim()
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    const content = renderEmail({
      heading: subject,
      paragraphs: [`Cześć${user.name ? ` ${user.name}` : ''},`, ...paragraphs, 'Pozdrawiamy,\nzespół AllGrafika'],
      footer: ['Odpowiedz na tę wiadomość – trafi bezpośrednio do zespołu AllGrafika.'],
    });
    try {
      await this.mail.send({ to: user.email, subject, text: content.text, html: content.html, replyTo: adminEmail });
    } catch (err: any) {
      this.logger.error(`Admin message to user ${userId} failed: ${err?.message}`);
      throw new HttpException(
        'Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const entry = await this.prisma.emailLog.create({
      data: { userId, kind: 'admin', key: `admin:${randomUUID()}`, subject, body: message.trim(), sentBy: adminEmail },
      select: { id: true, kind: true, subject: true, body: true, sentBy: true, createdAt: true },
    });
    this.logger.log(`Admin message sent to user ${userId}`);
    return entry;
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private readonly userSelect = {
    id: true,
    email: true,
    name: true,
    createdAt: true,
    emailVerifiedAt: true,
    googleId: true,
    password: true,
    credits: true,
    freeCreditsUsed: true,
    marketingConsentAt: true,
    subscription: { select: { planId: true, status: true } },
    _count: { select: { images: true } },
  } satisfies Prisma.UserSelect;

  private toRow(user: Prisma.UserGetPayload<{ select: AdminUsersService['userSelect'] }>, stats?: UserStats) {
    const provider = user.googleId && user.password ? 'google+password' : user.googleId ? 'google' : 'password';
    const sub = user.subscription;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      emailVerified: Boolean(user.emailVerifiedAt),
      provider,
      images: user._count.images,
      completedGenerations: stats?.completedGenerations ?? 0,
      failedGenerations: stats?.failedGenerations ?? 0,
      lastActivityAt: stats?.lastGenerationAt ?? null,
      credits: user.credits,
      freeCreditsLeft: Math.max(0, this.credits.freeLimit - user.freeCreditsUsed),
      plan: sub ? { planId: sub.planId, name: findPlan(sub.planId)?.name ?? sub.planId, status: sub.status } : null,
      paidTotalGrosze: stats?.paidTotalGrosze ?? 0,
      marketingConsent: Boolean(user.marketingConsentAt),
    };
  }

  private async statsFor(userIds: string[]): Promise<Map<string, UserStats>> {
    const result = new Map<string, UserStats>();
    if (!userIds.length) return result;
    const [generationRows, payments] = await Promise.all([
      this.prisma.$queryRaw<Array<{ userId: string; completed: bigint; failed: bigint; last: Date | null }>>`
        SELECT i."userId" AS "userId",
               count(*) FILTER (WHERE g."status" = 'COMPLETED') AS completed,
               count(*) FILTER (WHERE g."status" = 'FAILED') AS failed,
               max(g."createdAt") AS last
        FROM "generations" g JOIN "images" i ON i."id" = g."imageId"
        WHERE i."userId" IN (${Prisma.join(userIds)})
        GROUP BY i."userId"`,
      this.prisma.paymentTransaction.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, status: 'completed' },
        _sum: { amountPln: true },
      }),
    ]);
    for (const id of userIds) {
      result.set(id, { completedGenerations: 0, failedGenerations: 0, lastGenerationAt: null, paidTotalGrosze: 0 });
    }
    for (const row of generationRows) {
      Object.assign(result.get(row.userId)!, {
        completedGenerations: Number(row.completed),
        failedGenerations: Number(row.failed),
        lastGenerationAt: row.last,
      });
    }
    for (const row of payments) result.get(row.userId)!.paidTotalGrosze = row._sum.amountPln ?? 0;
    return result;
  }
}
