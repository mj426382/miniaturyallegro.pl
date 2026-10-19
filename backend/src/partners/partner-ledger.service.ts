import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { canonicalEmail } from '../auth/email-canonical';
import { netPaidGrosze } from '../admin/revenue';
import { addMonthsUtc, commissionOf, customerRef } from './commission';

type Tx = Prisma.TransactionClient;

interface LedgerRow {
  id: string;
  userId: string;
  kind: string;
  packageId: string | null;
  completedAt: Date | null;
  amountPln: number;
  amountRefunded: number;
  disputeAmount: number;
  partnerId: string | null;
  partnerCommissionPercent: number | null;
}

/**
 * Spec 24 – attribution of customers to partners and the commission ledger. Every method runs inside the caller's
 * database transaction, after the payment row was locked (fulfilment, subscription invoice, refund or dispute), so
 * parallel and repeated Stripe deliveries can never book an entry twice (NFR-REL-002).
 *
 * The ledger is cumulative: for a payment the sum of its entries always equals `round(rate × net paid)`. Each call
 * books only the difference to what is already booked – the first entry is the order ("payment"), later ones are
 * corrections ("adjustment") dated when the refund or dispute happened, so closed months never change (AC-PRT-010).
 */
@Injectable()
export class PartnerLedgerService {
  private readonly logger = new Logger(PartnerLedgerService.name);

  /**
   * After a payment was fulfilled (or delivered again): attributes the customer when they paid with a partner's code
   * (first attribution wins, no self-referral – AC-PRT-005/006/007), links the payment to the customer's partner when
   * it falls in the commission period of an active partner (AC-PRT-008), then books the ledger.
   * `paidAt` is the payment time (the Stripe event time).
   */
  async attachPayment(tx: Tx, transactionId: string, paidAt: Date, promotionCode?: string | null): Promise<void> {
    const row = await tx.paymentTransaction.findUnique({
      where: { id: transactionId },
      select: { id: true, userId: true, completedAt: true, partnerId: true },
    });
    if (!row?.completedAt) return;

    if (promotionCode) await this.attribute(tx, row.userId, promotionCode, paidAt);

    if (!row.partnerId) {
      const user = await tx.user.findUnique({
        where: { id: row.userId },
        select: {
          partnerId: true,
          partnerAttributedAt: true,
          partnerCommissionUntil: true,
          partner: { select: { active: true, commissionPercent: true } },
        },
      });
      const inPeriod =
        user?.partnerAttributedAt &&
        user.partnerCommissionUntil &&
        paidAt.getTime() >= user.partnerAttributedAt.getTime() &&
        paidAt.getTime() < user.partnerCommissionUntil.getTime();
      if (user?.partnerId && user.partner?.active && inPeriod) {
        await tx.paymentTransaction.update({
          where: { id: row.id },
          data: { partnerId: user.partnerId, partnerCommissionPercent: user.partner.commissionPercent },
        });
      }
    }
    await this.book(tx, transactionId, paidAt);
  }

  /**
   * Books the difference between `round(rate × net paid)` of the payment and its entries so far. A payment without a
   * partner (or not fulfilled yet) books nothing. Corrections are never dated before the order itself.
   */
  async book(tx: Tx, transactionId: string, at: Date): Promise<void> {
    const [row] = await tx.$queryRaw<LedgerRow[]>`
      SELECT "id", "userId", "kind", "packageId", "completedAt", "amountPln", "amountRefunded", "disputeAmount",
             "partnerId", "partnerCommissionPercent"
      FROM "payment_transactions" WHERE "id" = ${transactionId}`;
    if (!row?.partnerId || !row.completedAt) return;

    const percent = row.partnerCommissionPercent ?? 0;
    const net = netPaidGrosze(row);
    const commission = commissionOf(net, percent);
    const booked = await tx.partnerCommission.aggregate({
      where: { transactionId: row.id },
      _sum: { netPaidGrosze: true, commissionGrosze: true },
      _min: { occurredAt: true },
      _count: { _all: true },
    });
    const first = booked._count._all === 0;
    const netDelta = net - (booked._sum.netPaidGrosze ?? 0);
    const commissionDelta = commission - (booked._sum.commissionGrosze ?? 0);
    // The order is always recorded (also a 100% code: 0 zł, 0 commission); corrections only when something changed.
    if (!first && netDelta === 0 && commissionDelta === 0) return;

    const orderTime = booked._min.occurredAt;
    const occurredAt = !first && orderTime && orderTime.getTime() > at.getTime() ? orderTime : at;
    await tx.partnerCommission.create({
      data: {
        partnerId: row.partnerId,
        transactionId: row.id,
        customerRef: customerRef(row.userId),
        kind: first ? 'payment' : 'adjustment',
        productKind: row.kind,
        packageId: row.packageId,
        netPaidGrosze: netDelta,
        commissionGrosze: commissionDelta,
        commissionPercent: percent,
        occurredAt,
      },
    });
  }

  /** First attribution wins; inactive partners, codes without a partner and the partner's own mailbox attribute nobody. */
  private async attribute(tx: Tx, userId: string, promotionCode: string, paidAt: Date) {
    const code = await tx.discountCode.findUnique({
      where: { code: promotionCode.trim().toUpperCase() },
      select: {
        partner: { select: { id: true, active: true, contactEmail: true, commissionMonths: true } },
      },
    });
    const partner = code?.partner;
    if (!partner?.active) return;

    const user = await tx.user.findUnique({ where: { id: userId }, select: { emailCanonical: true, partnerId: true } });
    if (!user || user.partnerId) return;
    if (user.emailCanonical === canonicalEmail(partner.contactEmail)) {
      this.logger.warn(`Self-referral: account ${userId} paid with a code of partner ${partner.id} – not attributed`);
      return;
    }
    const { count } = await tx.user.updateMany({
      where: { id: userId, partnerId: null },
      data: {
        partnerId: partner.id,
        partnerAttributedAt: paidAt,
        partnerCommissionUntil: addMonthsUtc(paidAt, partner.commissionMonths),
      },
    });
    if (count === 1) this.logger.log(`Account ${userId} attributed to partner ${partner.id}`);
  }
}
