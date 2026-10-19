import { Prisma } from '@prisma/client';

/** Payments that were paid at some point – pending, failed and expired checkouts never brought money. */
export const PAID_STATUSES = ['completed', 'partially_refunded', 'refunded', 'disputed'];

/**
 * Spec 16 AC-ADM-015: money held back from a payment – refunds plus an open or lost dispute
 * (a won dispute has disputeAmount 0), never more than the payment itself.
 */
export const HELD_SQL = Prisma.sql`LEAST("amountPln", GREATEST("amountRefunded", 0) + GREATEST("disputeAmount", 0))`;

/**
 * The same rule as HELD_SQL for one row in TypeScript (spec 24: the partner commission base must match the revenue in
 * the panel). A unit test keeps the two in step.
 */
export function heldGrosze(row: { amountPln: number; amountRefunded: number; disputeAmount: number }): number {
  return Math.min(row.amountPln, Math.max(0, row.amountRefunded) + Math.max(0, row.disputeAmount));
}

/** What the payment brought in after refunds and open/lost disputes (never below 0). */
export function netPaidGrosze(row: { amountPln: number; amountRefunded: number; disputeAmount: number }): number {
  return Math.max(0, row.amountPln - heldGrosze(row));
}
