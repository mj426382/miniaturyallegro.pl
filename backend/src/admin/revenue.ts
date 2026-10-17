import { Prisma } from '@prisma/client';

/** Payments that were paid at some point – pending, failed and expired checkouts never brought money. */
export const PAID_STATUSES = ['completed', 'partially_refunded', 'refunded', 'disputed'];

/**
 * Spec 16 AC-ADM-015: money held back from a payment – refunds plus an open or lost dispute
 * (a won dispute has disputeAmount 0), never more than the payment itself.
 */
export const HELD_SQL = Prisma.sql`LEAST("amountPln", GREATEST("amountRefunded", 0) + GREATEST("disputeAmount", 0))`;
