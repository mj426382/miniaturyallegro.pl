import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { emailNotVerifiedException, isVerificationRequired } from '../auth/email-verification';
import { parseAdminEmails } from '../admin/admin-emails';

/**
 * Pool a single credit was charged from (spec 05, AC-GEN-027): `free` = the account's free pool,
 * `paid` = purchased credits, `none` = nothing charged (unlimited admin account).
 */
export type CreditPool = 'free' | 'paid' | 'none';

/** What one deduction took: free credits are always used first. */
export interface CreditCharge {
  free: number;
  paid: number;
  /** Unlimited (admin) account – nothing was charged. */
  unlimited: boolean;
}

export interface CreditDeduction<T = void> {
  free: number;
  paid: number;
  result: T;
}

export interface DeductOptions<T> {
  /** Reject when the user already has this many generations in flight (counted under the row lock). */
  maxActive?: number;
  /**
   * Extra work (e.g. creating generation rows) executed in the SAME transaction – all or nothing.
   * Receives the split, so every generation row can record the pool of its credit (`poolsOf`).
   */
  within?: (tx: Prisma.TransactionClient, charge: CreditCharge) => Promise<T>;
}

/**
 * The pool of each charged credit in charging order – free first, then paid; `count` × `none` for an
 * unlimited account.
 */
export function poolsOf(charge: CreditCharge, count: number): CreditPool[] {
  if (charge.unlimited) return Array.from({ length: count }, () => 'none' as const);
  return [
    ...Array.from({ length: charge.free }, () => 'free' as const),
    ...Array.from({ length: charge.paid }, () => 'paid' as const),
  ];
}

type LockedUser = { email: string; credits: number; freeCreditsUsed: number; emailVerifiedAt: Date | null };

/**
 * Credit accounting.
 *
 * Every new account gets FREE_CREDITS_LIMIT free generations (stored on the account at sign-up as
 * `freeCreditsLimit`, so changing the setting never shrinks an existing pool – spec 19); afterwards one
 * credit = one generated graphic. Deductions run inside a transaction with a
 * row lock so concurrent requests (e.g. bulk upload, double clicks) can never
 * drive the balance negative or over-spend the free pool.
 *
 * Every generation records the pool its credit came from, and a failure refunds to exactly that pool
 * (spec 05, AC-GEN-027) – a purchased credit never turns into a free one, which would skew the
 * withdrawal quote (spec 19).
 *
 * Spec 16 (AC-ADM-010/011): accounts listed in ADMIN_EMAILS have no credit limit – nothing is
 * charged and nothing is refunded. Verification and the in-flight cap still apply to them.
 */
@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);
  /** Free pool given to accounts created now (FREE_CREDITS_LIMIT); each account keeps its own `freeCreditsLimit`. */
  readonly freeLimit: number;
  /** Spec 13: unconfirmed accounts may not spend credits (switch: EMAIL_VERIFICATION_REQUIRED). */
  readonly verificationRequired: boolean;
  private readonly admins: Set<string>;

  constructor(
    private prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.freeLimit = freeCreditsForNewAccounts(configService.get<string>('FREE_CREDITS_LIMIT'));
    this.verificationRequired = isVerificationRequired(configService.get<string>('EMAIL_VERIFICATION_REQUIRED'));
    this.admins = parseAdminEmails(configService.get<string>('ADMIN_EMAILS'));
  }

  /**
   * Unlimited credits – decided by the server configuration only, never by data the user controls,
   * and only for a confirmed address (spec 16, AC-ADM-014).
   */
  hasUnlimitedCredits(email: string, emailVerifiedAt: Date | null): boolean {
    return Boolean(emailVerifiedAt) && this.admins.has(email.toLowerCase());
  }

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true, freeCreditsUsed: true, freeCreditsLimit: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      paid: user.credits,
      freeLeft: Math.max(0, user.freeCreditsLimit - user.freeCreditsUsed),
      freeLimit: user.freeCreditsLimit,
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
        {
          email: string;
          credits: number;
          freeCreditsUsed: number;
          freeCreditsLimit: number;
          emailVerifiedAt: Date | null;
        }[]
      >`SELECT "email", "credits", "freeCreditsUsed", "freeCreditsLimit", "emailVerifiedAt" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
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

      if (this.hasUnlimitedCredits(user.email, user.emailVerifiedAt)) {
        const result = options.within
          ? await options.within(tx, { free: 0, paid: 0, unlimited: true })
          : (undefined as T);
        return { free: 0, paid: 0, result };
      }

      const freeLeft = Math.max(0, user.freeCreditsLimit - user.freeCreditsUsed);
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

      const result = options.within ? await options.within(tx, { free, paid, unlimited: false }) : (undefined as T);
      return { free, paid, result };
    });
  }

  /**
   * Marks an in-flight generation FAILED and returns its credit to the pool it was charged from – in ONE
   * transaction, so a crash can never leave a failed graphic without its refund, and a second caller
   * (processing error + reconciler) can never refund twice. Lock order is the same as in `deduct`
   * (user row first, then the generation row), so a retry and a failure cannot deadlock.
   * Returns true when this call failed (and refunded) the generation. Rows charged before 2026-10-18
   * (creditPool NULL) are refunded the old way: free pool first.
   */
  async failGeneration(userId: string, generationId: string): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await this.lockUser(tx, userId);
        const { count } = await tx.generation.updateMany({
          where: { id: generationId, status: { in: ['PENDING', 'PROCESSING'] } },
          data: { status: 'FAILED' },
        });
        if (count !== 1) return false;
        const row = await tx.generation.findUnique({ where: { id: generationId }, select: { creditPool: true } });
        if (user) await this.refundOne(tx, userId, user, toPool(row?.creditPool));
        return true;
      });
    } catch (err) {
      // Nothing changed – the row stays in flight and the reconciler fails + refunds it later.
      this.logger.error(`Could not fail generation ${generationId} of user ${userId}`, err);
      return false;
    }
  }

  private async lockUser(tx: Prisma.TransactionClient, userId: string): Promise<LockedUser | undefined> {
    const rows = await tx.$queryRaw<LockedUser[]>`
      SELECT "email", "credits", "freeCreditsUsed", "emailVerifiedAt" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
    return rows[0];
  }

  /**
   * Gives one credit back to `pool` and keeps the locked snapshot `user` in step. `none` (unlimited admin)
   * gives nothing; `null` (charged before 2026-10-18) uses the old rule: free pool first, nothing for an
   * unlimited account.
   */
  private async refundOne(tx: Prisma.TransactionClient, userId: string, user: LockedUser, pool: CreditPool | null) {
    let target: 'free' | 'paid' | null;
    if (pool === 'none') target = null;
    else if (pool === 'paid') target = 'paid';
    else if (pool === 'free') target = user.freeCreditsUsed > 0 ? 'free' : null;
    else if (this.hasUnlimitedCredits(user.email, user.emailVerifiedAt)) target = null;
    else target = user.freeCreditsUsed > 0 ? 'free' : 'paid';

    if (target === 'free') {
      await tx.user.update({ where: { id: userId }, data: { freeCreditsUsed: { decrement: 1 } } });
      user.freeCreditsUsed -= 1;
    } else if (target === 'paid') {
      await tx.user.update({ where: { id: userId }, data: { credits: { increment: 1 } } });
      user.credits += 1;
    }

    if (target) this.logger.log(`Refunded 1 ${target} credit to user ${userId}`);
    else if (pool === 'free') this.logger.error(`Free-pool refund for user ${userId} skipped – nothing was used`);
  }
}

function toPool(value: string | null | undefined): CreditPool | null {
  return value === 'free' || value === 'paid' || value === 'none' ? value : null;
}

/** FREE_CREDITS_LIMIT as an integer 0–100 (validated at start-up); default 5 since spec 19. */
export function freeCreditsForNewAccounts(value: string | undefined): number {
  const configured = Number(value);
  return value !== undefined && value !== '' && Number.isInteger(configured) && configured >= 0 ? configured : 5;
}

function plural(n: number): string {
  if (n === 1) return 'kredytu';
  return 'kredytów';
}
