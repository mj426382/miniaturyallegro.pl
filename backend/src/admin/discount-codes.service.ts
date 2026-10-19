import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DiscountCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateDiscountCodeDto } from './discount-codes.dto';

export type DiscountCodeStatus = 'active' | 'inactive' | 'expired' | 'exhausted';

/** A code row with its partner (spec 24, AC-PRT-004). */
type CodeWithPartner = DiscountCode & { partner?: { id: string; name: string } | null };

const LIST_LIMIT = 100;
export const CONFLICT_MESSAGE = 'Taki kod już istnieje – wybierz inny';
export const PAST_EXPIRY_MESSAGE = 'Data ważności musi być w przyszłości';
const WITH_PARTNER = { partner: { select: { id: true, name: true } } } as const;

/** Stripe refuses a second active promotion code with the same text (also one of the JAN-MAT shop). */
function isDuplicateCodeError(err: any): boolean {
  return err?.code === 'resource_already_exists' || /already exists/i.test(String(err?.message ?? ''));
}

/**
 * Spec 16, AC-ADM-017/018: partner discount codes. Each code is a Stripe coupon (`duration: once`) with one
 * promotion code; buyers type it on the Stripe checkout page of a regular pack (spec 09, AC-PAY-026). The
 * Stripe account is shared with the JAN-MAT shop, so the panel only knows the codes recorded in our table.
 */
@Injectable()
export class DiscountCodesService {
  private readonly logger = new Logger(DiscountCodesService.name);

  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
  ) {}

  /** `options.partnerId` links the new code to a partner in the same write (spec 24, AC-PRT-001). */
  async create(adminEmail: string, dto: CreateDiscountCodeDto, options: { partnerId?: string } = {}) {
    const code = dto.code.trim().toUpperCase();
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(PAST_EXPIRY_MESSAGE);
    }
    const amountOffGrosze = dto.type === 'amount' ? Math.round(Number(dto.amountOffPln) * 100) : null;
    const percentOff = dto.type === 'percent' ? Number(dto.percentOff) : null;
    const note = dto.note?.trim() || null;

    if (await this.prisma.discountCode.findUnique({ where: { code }, select: { id: true } })) {
      throw new ConflictException(CONFLICT_MESSAGE);
    }

    const stripe = this.payments.stripeClient();
    let couponId: string | undefined;
    let promotionCodeId: string | undefined;
    try {
      const coupon = await stripe.coupons.create({
        duration: 'once',
        name: code,
        ...(percentOff !== null ? { percent_off: percentOff } : { amount_off: amountOffGrosze, currency: 'pln' }),
        metadata: { app: 'allgrafika' },
      });
      couponId = coupon.id;
      const promotionCode = await stripe.promotionCodes.create({
        promotion: { type: 'coupon', coupon: coupon.id },
        code,
        ...(dto.maxRedemptions ? { max_redemptions: dto.maxRedemptions } : {}),
        ...(expiresAt ? { expires_at: Math.floor(expiresAt.getTime() / 1000) } : {}),
        metadata: { app: 'allgrafika' },
      });
      promotionCodeId = promotionCode.id;

      const row = await this.prisma.discountCode.create({
        data: {
          code,
          type: dto.type,
          percentOff,
          amountOffGrosze,
          maxRedemptions: dto.maxRedemptions ?? null,
          expiresAt,
          note,
          stripeCouponId: coupon.id,
          stripePromotionCodeId: promotionCode.id,
          createdBy: adminEmail,
          partnerId: options.partnerId ?? null,
        },
        include: WITH_PARTNER,
      });
      this.logger.log(`Discount code ${code} created (${dto.type})`);
      return this.toRow(row, { timesRedeemed: 0, active: true }, 0);
    } catch (err: any) {
      // Nothing half-made stays behind: no row, no usable code, no orphaned coupon.
      if (promotionCodeId) {
        await Promise.resolve(stripe.promotionCodes.update(promotionCodeId, { active: false })).catch(() => undefined);
      }
      if (couponId) await Promise.resolve(stripe.coupons.del(couponId)).catch(() => undefined);
      if (err?.code === 'P2002' || isDuplicateCodeError(err)) throw new ConflictException(CONFLICT_MESSAGE);
      this.logger.error(`Could not create discount code ${code} in Stripe: ${err?.message}`);
      throw new ServiceUnavailableException('Nie udało się utworzyć kodu w Stripe. Spróbuj ponownie za chwilę.');
    }
  }

  /** Newest first, with redemptions from Stripe (null when Stripe does not answer) and fulfilled orders. */
  async list() {
    const rows = await this.prisma.discountCode.findMany({
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
      include: WITH_PARTNER,
    });
    return { codes: await this.describe(rows) };
  }

  async deactivate(id: string) {
    const row = await this.prisma.discountCode.findUnique({ where: { id }, include: WITH_PARTNER });
    if (!row) throw new NotFoundException('Nie znaleziono kodu rabatowego');
    if (!row.active) return (await this.describe([row]))[0];

    try {
      await this.payments.stripeClient().promotionCodes.update(row.stripePromotionCodeId, { active: false });
    } catch (err: any) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.logger.error(`Could not deactivate discount code ${row.code} in Stripe: ${err?.message}`);
      throw new ServiceUnavailableException('Nie udało się wyłączyć kodu w Stripe. Spróbuj ponownie za chwilę.');
    }
    const updated = await this.prisma.discountCode.update({
      where: { id },
      data: { active: false, deactivatedAt: new Date() },
      include: WITH_PARTNER,
    });
    this.logger.log(`Discount code ${row.code} deactivated`);
    return (await this.describe([updated]))[0];
  }

  private async describe(rows: CodeWithPartner[]) {
    if (!rows.length) return [];
    const orders = await this.prisma.paymentTransaction.groupBy({
      by: ['promotionCode'],
      where: { promotionCode: { in: rows.map((r) => r.code) }, completedAt: { not: null } },
      _count: { _all: true },
    });
    const ordersByCode = new Map(orders.map((o) => [o.promotionCode, o._count._all]));

    let stripe: any = null;
    try {
      stripe = this.payments.stripeClient();
    } catch {
      stripe = null;
    }
    const live = await Promise.all(
      rows.map(async (row) => {
        if (!stripe) return null;
        try {
          const promo = await stripe.promotionCodes.retrieve(row.stripePromotionCodeId);
          return { timesRedeemed: Number(promo?.times_redeemed ?? 0), active: promo?.active !== false };
        } catch (err: any) {
          this.logger.warn(`Could not read discount code ${row.code} from Stripe: ${err?.message}`);
          return null;
        }
      }),
    );
    return rows.map((row, i) => this.toRow(row, live[i], ordersByCode.get(row.code) ?? 0));
  }

  private toRow(row: CodeWithPartner, live: { timesRedeemed: number; active: boolean } | null, orders: number) {
    const timesRedeemed = live ? live.timesRedeemed : null;
    let status: DiscountCodeStatus = 'active';
    if (!row.active || live?.active === false) status = 'inactive';
    else if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) status = 'expired';
    else if (row.maxRedemptions && timesRedeemed !== null && timesRedeemed >= row.maxRedemptions) status = 'exhausted';
    return {
      id: row.id,
      code: row.code,
      type: row.type,
      percentOff: row.percentOff,
      amountOffGrosze: row.amountOffGrosze,
      maxRedemptions: row.maxRedemptions,
      expiresAt: row.expiresAt,
      note: row.note,
      status,
      timesRedeemed,
      orders,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      deactivatedAt: row.deactivatedAt,
      partner: row.partner ? { id: row.partner.id, name: row.partner.name } : null,
    };
  }
}
