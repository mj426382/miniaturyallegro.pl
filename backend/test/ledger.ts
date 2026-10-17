import { TestContext } from './test-app';

export interface LedgerBase {
  /** Purchased credits put on the account directly by the test (not through a payment). */
  paid?: number;
  /** Free credits marked as used directly by the test. */
  freeUsed?: number;
}

/**
 * Credit balance recomputed from the rows that explain it (spec 09, AC-PAY-025):
 *   paid = Σ fulfilled payments (creditsAdded − creditsReversed + creditsShortfall)
 *          − generations in flight or finished that were charged from the paid pool
 *   free = generations in flight or finished that were charged from the free pool
 * A FAILED generation has always been refunded, so it does not count.
 */
export async function ledgerOf(ctx: TestContext, userId: string, base: LedgerBase = {}) {
  const payments = await ctx.prisma.paymentTransaction.findMany({
    where: { userId, completedAt: { not: null } },
    select: { creditsAdded: true, creditsReversed: true, creditsShortfall: true },
  });
  const purchased = payments.reduce((sum, t) => sum + t.creditsAdded - t.creditsReversed + t.creditsShortfall, 0);
  const charged = await ctx.prisma.generation.groupBy({
    by: ['creditPool'],
    where: { image: { userId }, status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] } },
    _count: { _all: true },
  });
  const count = (pool: string) => charged.find((c) => c.creditPool === pool)?._count._all ?? 0;
  return {
    paid: (base.paid ?? 0) + purchased - count('paid'),
    free: (base.freeUsed ?? 0) + count('free'),
  };
}

/** Asserts the stored balance equals the ledger and is never negative; returns the balance. */
export async function expectBalanceMatchesLedger(ctx: TestContext, userId: string, base: LedgerBase = {}) {
  const user = await ctx.prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { credits: true, freeCreditsUsed: true, freeCreditsLimit: true },
  });
  const ledger = await ledgerOf(ctx, userId, base);
  expect({ paid: user.credits, free: user.freeCreditsUsed }).toEqual(ledger);
  expect(user.credits).toBeGreaterThanOrEqual(0);
  expect(user.freeCreditsUsed).toBeGreaterThanOrEqual(0);
  expect(user.freeCreditsUsed).toBeLessThanOrEqual(user.freeCreditsLimit);
  return user;
}
