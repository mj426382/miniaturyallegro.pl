import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { emailNotVerifiedException, isVerificationRequired } from '../auth/email-verification';
import { parseAdminEmails } from '../admin/admin-emails';

export interface CreditDeduction<T = void> {
  free: number;
  paid: number;
  result: T;
}

export interface DeductOptions<T> {
  /** Reject when the user already has this many generations in flight (counted under the row lock). */
  maxActive?: number;
  /** Extra work (e.g. creating generation rows) executed in the SAME transaction – all or nothing. */
  within?: (tx: Prisma.TransactionClient) => Promise<T>;
}

/**
 * Credit accounting.
 *
 * Every new account gets FREE_CREDITS_LIMIT free generations; afterwards one
 * credit = one generated graphic. Deductions run inside a transaction with a
 * row lock so concurrent requests (e.g. bulk upload, double clicks) can never
 * drive the balance negative or over-spend the free pool.
 *
 * Spec 16 (AC-ADM-010/011): accounts listed in ADMIN_EMAILS have no credit limit – nothing is
 * charged and nothing is refunded. Verification and the in-flight cap still apply to them.
 */
@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);
  readonly freeLimit: number;
  /** Spec 13: unconfirmed accounts may not spend credits (switch: EMAIL_VERIFICATION_REQUIRED). */
  readonly verificationRequired: boolean;
  private readonly admins: Set<string>;

  constructor(
    private prisma: PrismaService,
    configService: ConfigService,
  ) {
    const configured = Number(configService.get<string>('FREE_CREDITS_LIMIT'));
    this.freeLimit = Number.isInteger(configured) && configured >= 0 ? configured : 10;
    this.verificationRequired = isVerificationRequired(configService.get<string>('EMAIL_VERIFICATION_REQUIRED'));
    this.admins = parseAdminEmails(configService.get<string>('ADMIN_EMAILS'));
  }

  /** Unlimited credits – decided by the server configuration only, never by data the user controls. */
  hasUnlimitedCredits(email: string): boolean {
    return this.admins.has(email.toLowerCase());
  }

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true, freeCreditsUsed: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      paid: user.credits,
      freeLeft: Math.max(0, this.freeLimit - user.freeCreditsUsed),
      freeLimit: this.freeLimit,
    };
  }

  async deduct<T = void>(userId: string, count: number, options: DeductOptions<T> = {}): Promise<CreditDeduction<T>> {
    if (!Number.isInteger(count) || count <= 0) {
      throw new HttpException('Nieprawidłowa liczba kredytów', HttpStatus.BAD_REQUEST);
    }

    return this.prisma.$transaction(async (tx) => {
      // The row lock serialises every concurrent start of this user – the in-flight cap and
      // the balance check below are therefore exact, not best-effort.
      const rows = await tx.$queryRaw<
        { email: string; credits: number; freeCreditsUsed: number; emailVerifiedAt: Date | null }[]
      >`SELECT "email", "credits", "freeCreditsUsed", "emailVerifiedAt" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
      const user = rows[0];
      if (!user) throw new NotFoundException('User not found');
      if (this.verificationRequired && !user.emailVerifiedAt) throw emailNotVerifiedException();

      if (options.maxActive !== undefined) {
        const active = await tx.generation.count({
          where: { status: { in: ['PENDING', 'PROCESSING'] }, image: { userId } },
        });
        if (active + count > options.maxActive) {
          throw new HttpException(
            `Masz już ${active} generacji w toku. Poczekaj na ich zakończenie przed uruchomieniem kolejnych.`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      if (this.hasUnlimitedCredits(user.email)) {
        const result = options.within ? await options.within(tx) : (undefined as T);
        return { free: 0, paid: 0, result };
      }

      const freeLeft = Math.max(0, this.freeLimit - user.freeCreditsUsed);
      const free = Math.min(count, freeLeft);
      const paid = count - free;

      if (paid > 0 && user.credits < paid) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            error: 'Payment Required',
            message: `Niewystarczająca liczba kredytów. Potrzebujesz ${paid} ${plural(paid)}, masz ${user.credits}. Doładuj konto na stronie Kredyty.`,
            creditsRequired: paid,
            creditsAvailable: user.credits,
            freeLeft,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          freeCreditsUsed: { increment: free },
          credits: { decrement: paid },
        },
      });

      const result = options.within ? await options.within(tx) : (undefined as T);
      return { free, paid, result };
    });
  }

  /**
   * Returns credits after a failed generation. Free credits are restored first –
   * the user always ends up with the same total value as before the attempt.
   */
  async refund(userId: string, count: number): Promise<void> {
    if (count <= 0) return;
    try {
      await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ email: string; freeCreditsUsed: number }[]>`
          SELECT "email", "freeCreditsUsed" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
        const user = rows[0];
        if (!user) return;
        // Nothing was charged for an unlimited account, so nothing is given back.
        if (this.hasUnlimitedCredits(user.email)) return;

        const freeToRefund = Math.min(count, user.freeCreditsUsed);
        const paidToRefund = count - freeToRefund;

        await tx.user.update({
          where: { id: userId },
          data: {
            freeCreditsUsed: { decrement: freeToRefund },
            credits: { increment: paidToRefund },
          },
        });
        this.logger.log(`Refunded ${count} credit(s) to user ${userId} (free: ${freeToRefund}, paid: ${paidToRefund})`);
      });
    } catch (err) {
      this.logger.error(`Failed to refund credits for user ${userId}`, err);
    }
  }
}

function plural(n: number): string {
  if (n === 1) return 'kredytu';
  return 'kredytów';
}
