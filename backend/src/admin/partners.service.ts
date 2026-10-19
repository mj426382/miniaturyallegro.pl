import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { findPackage, WELCOME_PACKAGE } from '../payments/plans';
import { CONFLICT_MESSAGE, DiscountCodesService, PAST_EXPIRY_MESSAGE } from './discount-codes.service';
import {
  CreatePartnerCodeDto,
  CreatePartnerDto,
  CreatePartnerPayoutDto,
  LinkPartnerCodeDto,
  UpdatePartnerDto,
} from './partners.dto';
import { isCalendarDate, MIN_PAYOUT_GROSZE, PARTNER_DEFAULTS, todayInPoland } from '../partners/commission';

const NOT_FOUND = 'Nie znaleziono partnera';

/** Month of a ledger entry in Polish time (DST-aware – PostgreSQL time zone database, AC-PRT-011). */
const MONTH_SQL = Prisma.sql`to_char(("occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM')`;

export interface Totals {
  orders: number;
  netPaidGrosze: number;
  commissionGrosze: number;
}

export interface Summary {
  currentMonth: Totals;
  allTime: Totals;
  paidOutGrosze: number;
  balanceGrosze: number;
}

const zero = (): Totals => ({ orders: 0, netPaidGrosze: 0, commissionGrosze: 0 });
const zl = (grosze: number) => `${grosze < 0 ? '−' : ''}${(Math.abs(grosze) / 100).toFixed(2).replace('.', ',')} zł`;

const PARTNER_INCLUDE = {
  codes: { orderBy: { createdAt: 'desc' as const } },
  _count: { select: { customers: true } },
};
type PartnerWithCodes = Prisma.PartnerGetPayload<{ include: typeof PARTNER_INCLUDE }>;

/**
 * Spec 24 – the admin side of the partner programme: partners and their codes, the monthly commission statement and
 * payouts. Bookings come from PartnerLedgerService (payments); this service only reads the ledger. No customer e-mail
 * and no Stripe id ever leaves it – customers are short hashes (AC-PRT-013).
 */
@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);

  constructor(
    private prisma: PrismaService,
    private discountCodes: DiscountCodesService,
  ) {}

  async list() {
    const [partners, month] = await Promise.all([
      this.prisma.partner.findMany({ orderBy: { createdAt: 'desc' }, include: PARTNER_INCLUDE }),
      this.currentMonth(),
    ]);
    const summaries = await this.summaries(month);
    return {
      month,
      minPayoutGrosze: MIN_PAYOUT_GROSZE,
      partners: partners.map((p) => this.toRow(p, summaries.get(p.id))),
    };
  }

  async detail(id: string) {
    const partner = await this.findOrThrow(id);
    const month = await this.currentMonth();
    const [summaries, entries, payouts] = await Promise.all([
      this.summaries(month, id),
      this.prisma.$queryRaw<
        Array<{
          id: string;
          kind: string;
          productKind: string;
          packageId: string | null;
          customerRef: string;
          netPaidGrosze: number;
          commissionGrosze: number;
          commissionPercent: number;
          occurredAt: Date;
          month: string;
        }>
      >`
        SELECT "id", "kind", "productKind", "packageId", "customerRef", "netPaidGrosze", "commissionGrosze",
               "commissionPercent", "occurredAt", ${MONTH_SQL} AS "month"
        FROM "partner_commissions" WHERE "partnerId" = ${id}
        ORDER BY "occurredAt" DESC, "createdAt" DESC`,
      this.prisma.partnerPayout.findMany({
        where: { partnerId: id },
        orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    const months: Array<Totals & { month: string; entries: unknown[] }> = [];
    for (const e of entries) {
      let bucket = months[months.length - 1];
      if (!bucket || bucket.month !== e.month) {
        bucket = { month: e.month, ...zero(), entries: [] };
        months.push(bucket);
      }
      if (e.kind === 'payment') bucket.orders++;
      bucket.netPaidGrosze += e.netPaidGrosze;
      bucket.commissionGrosze += e.commissionGrosze;
      bucket.entries.push({
        id: e.id,
        occurredAt: e.occurredAt,
        kind: e.kind,
        product: this.productLabel(e.productKind, e.packageId),
        customer: e.customerRef,
        netPaidGrosze: e.netPaidGrosze,
        commissionGrosze: e.commissionGrosze,
        commissionPercent: e.commissionPercent,
      });
    }

    return {
      ...this.toRow(partner, summaries.get(id)),
      month,
      minPayoutGrosze: MIN_PAYOUT_GROSZE,
      months,
      payouts: payouts.map((p) => this.payoutRow(p)),
    };
  }

  async create(adminEmail: string, dto: CreatePartnerDto) {
    if (dto.code) await this.assertCodeAvailable(dto.code, dto.codeExpiresAt);
    const partner = await this.prisma.partner.create({
      data: {
        name: dto.name,
        contactEmail: dto.contactEmail,
        companyName: dto.companyName ?? null,
        nip: dto.nip ?? null,
        customerDiscountPercent: dto.customerDiscountPercent ?? PARTNER_DEFAULTS.customerDiscountPercent,
        commissionPercent: dto.commissionPercent ?? PARTNER_DEFAULTS.commissionPercent,
        commissionMonths: dto.commissionMonths ?? PARTNER_DEFAULTS.commissionMonths,
        active: dto.active ?? true,
        note: dto.note ?? null,
        createdBy: adminEmail,
      },
    });
    if (dto.code) {
      try {
        await this.createCodeFor(adminEmail, partner, {
          code: dto.code,
          maxRedemptions: dto.codeMaxRedemptions,
          expiresAt: dto.codeExpiresAt,
        });
      } catch (err) {
        // AC-PRT-002: no partner without the code the administrator asked for.
        await this.prisma.partner.delete({ where: { id: partner.id } }).catch(() => undefined);
        throw err;
      }
    }
    this.logger.log(`Partner ${partner.id} created`);
    return this.rowOf(partner.id);
  }

  async update(id: string, dto: UpdatePartnerDto) {
    await this.findOrThrow(id);
    const data: Prisma.PartnerUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.contactEmail !== undefined) data.contactEmail = dto.contactEmail;
    // null (an emptied field) clears it
    if (dto.companyName !== undefined) data.companyName = dto.companyName;
    if (dto.nip !== undefined) data.nip = dto.nip;
    if (dto.note !== undefined) data.note = dto.note;
    if (dto.customerDiscountPercent != null) data.customerDiscountPercent = dto.customerDiscountPercent;
    if (dto.commissionPercent != null) data.commissionPercent = dto.commissionPercent;
    if (dto.commissionMonths != null) data.commissionMonths = dto.commissionMonths;
    if (dto.active != null) data.active = dto.active;
    if (dto.name === null || dto.contactEmail === null) {
      throw new BadRequestException('Nazwa i e-mail partnera są wymagane');
    }
    await this.prisma.partner.update({ where: { id }, data });
    return this.rowOf(id);
  }

  async createCode(adminEmail: string, id: string, dto: CreatePartnerCodeDto) {
    const partner = await this.findOrThrow(id);
    await this.assertCodeAvailable(dto.code, dto.expiresAt);
    await this.createCodeFor(adminEmail, partner, dto);
    return this.rowOf(id);
  }

  async linkCode(id: string, dto: LinkPartnerCodeDto) {
    await this.findOrThrow(id);
    const code = await this.prisma.discountCode.findUnique({ where: { code: dto.code } });
    if (!code)
      throw new NotFoundException('Nie znaleziono kodu rabatowego – najpierw utwórz go w zakładce „Kody rabatowe”');
    const { count } = await this.prisma.discountCode.updateMany({
      where: { id: code.id, OR: [{ partnerId: null }, { partnerId: id }] },
      data: { partnerId: id },
    });
    if (count === 0) throw new ConflictException('Ten kod jest już podłączony do innego partnera');
    return this.rowOf(id);
  }

  async unlinkCode(id: string, codeId: string) {
    await this.findOrThrow(id);
    const { count } = await this.prisma.discountCode.updateMany({
      where: { id: codeId, partnerId: id },
      data: { partnerId: null },
    });
    if (count === 0) throw new NotFoundException('Ten kod nie jest podłączony do tego partnera');
    return this.rowOf(id);
  }

  async recordPayout(adminEmail: string, id: string, dto: CreatePartnerPayoutDto) {
    await this.findOrThrow(id);
    if (!isCalendarDate(dto.paidOn)) throw new BadRequestException('Nieprawidłowa data wypłaty');
    if (dto.paidOn > todayInPoland()) throw new BadRequestException('Data wypłaty nie może być z przyszłości');
    const amountGrosze = Math.round(dto.amountPln * 100);

    const before = (await this.summaries(await this.currentMonth(), id)).get(id)?.balanceGrosze ?? 0;
    const payout = await this.prisma.partnerPayout.create({
      data: {
        partnerId: id,
        amountGrosze,
        paidOn: new Date(`${dto.paidOn}T00:00:00.000Z`),
        reference: dto.reference,
        createdBy: adminEmail,
      },
    });
    const warnings: string[] = [];
    if (amountGrosze < MIN_PAYOUT_GROSZE) warnings.push(`Kwota jest poniżej progu wypłaty ${zl(MIN_PAYOUT_GROSZE)}.`);
    if (amountGrosze > before) warnings.push(`Wypłata jest wyższa niż saldo do wypłaty (${zl(before)}).`);
    this.logger.log(`Payout of ${amountGrosze} grosze recorded for partner ${id}`);
    return { payout: this.payoutRow(payout), balanceGrosze: before - amountGrosze, warnings };
  }

  // ─── helpers ──────────────────────────────────────────────────────

  private async findOrThrow(id: string): Promise<PartnerWithCodes> {
    const partner = await this.prisma.partner.findUnique({ where: { id }, include: PARTNER_INCLUDE });
    if (!partner) throw new NotFoundException(NOT_FOUND);
    return partner;
  }

  private async rowOf(id: string) {
    const partner = await this.findOrThrow(id);
    const summaries = await this.summaries(await this.currentMonth(), id);
    return this.toRow(partner, summaries.get(id));
  }

  /** The same checks as the code service, before anything is written (AC-PRT-002: no partner on a bad code). */
  private async assertCodeAvailable(code: string, expiresAt?: string) {
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) throw new BadRequestException(PAST_EXPIRY_MESSAGE);
    if (await this.prisma.discountCode.findUnique({ where: { code }, select: { id: true } })) {
      throw new ConflictException(CONFLICT_MESSAGE);
    }
  }

  private createCodeFor(
    adminEmail: string,
    partner: { id: string; name: string; customerDiscountPercent: number },
    dto: { code: string; maxRedemptions?: number; expiresAt?: string },
  ) {
    return this.discountCodes.create(
      adminEmail,
      {
        code: dto.code,
        type: 'percent',
        percentOff: partner.customerDiscountPercent,
        maxRedemptions: dto.maxRedemptions,
        expiresAt: dto.expiresAt,
        note: partner.name.slice(0, 200),
      },
      { partnerId: partner.id },
    );
  }

  private async currentMonth(): Promise<string> {
    const [row] = await this.prisma.$queryRaw<Array<{ month: string }>>`
      SELECT to_char(now() AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM') AS "month"`;
    return row.month;
  }

  /** Current month and all-time totals, payouts and the unpaid balance per partner. */
  private async summaries(month: string, partnerId?: string): Promise<Map<string, Summary>> {
    const filter = partnerId ? Prisma.sql`WHERE "partnerId" = ${partnerId}` : Prisma.empty;
    const [rows, payouts] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ partnerId: string; month: string; orders: bigint; net: bigint | null; commission: bigint | null }>
      >`
        SELECT "partnerId", ${MONTH_SQL} AS "month",
               count(*) FILTER (WHERE "kind" = 'payment') AS "orders",
               sum("netPaidGrosze") AS "net", sum("commissionGrosze") AS "commission"
        FROM "partner_commissions" ${filter}
        GROUP BY 1, 2`,
      this.prisma.partnerPayout.groupBy({
        by: ['partnerId'],
        where: partnerId ? { partnerId } : undefined,
        _sum: { amountGrosze: true },
      }),
    ]);
    const out = new Map<string, Summary>();
    const get = (id: string) => {
      let s = out.get(id);
      if (!s) {
        s = { currentMonth: zero(), allTime: zero(), paidOutGrosze: 0, balanceGrosze: 0 };
        out.set(id, s);
      }
      return s;
    };
    for (const r of rows) {
      const s = get(r.partnerId);
      const totals = {
        orders: Number(r.orders),
        netPaidGrosze: Number(r.net ?? 0),
        commissionGrosze: Number(r.commission ?? 0),
      };
      for (const target of r.month === month ? [s.allTime, s.currentMonth] : [s.allTime]) {
        target.orders += totals.orders;
        target.netPaidGrosze += totals.netPaidGrosze;
        target.commissionGrosze += totals.commissionGrosze;
      }
    }
    for (const p of payouts) get(p.partnerId).paidOutGrosze = p._sum.amountGrosze ?? 0;
    for (const s of out.values()) s.balanceGrosze = s.allTime.commissionGrosze - s.paidOutGrosze;
    return out;
  }

  private toRow(p: PartnerWithCodes, summary?: Summary) {
    const now = Date.now();
    const s = summary ?? { currentMonth: zero(), allTime: zero(), paidOutGrosze: 0, balanceGrosze: 0 };
    return {
      id: p.id,
      name: p.name,
      contactEmail: p.contactEmail,
      companyName: p.companyName,
      nip: p.nip,
      customerDiscountPercent: p.customerDiscountPercent,
      commissionPercent: p.commissionPercent,
      commissionMonths: p.commissionMonths,
      active: p.active,
      note: p.note,
      createdBy: p.createdBy,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      codes: p.codes.map((c) => ({
        id: c.id,
        code: c.code,
        type: c.type,
        percentOff: c.percentOff,
        amountOffGrosze: c.amountOffGrosze,
        expiresAt: c.expiresAt,
        status: !c.active ? 'inactive' : c.expiresAt && c.expiresAt.getTime() <= now ? 'expired' : 'active',
      })),
      customers: p._count.customers,
      ...s,
    };
  }

  private payoutRow(p: {
    id: string;
    amountGrosze: number;
    paidOn: Date;
    reference: string;
    createdBy: string;
    createdAt: Date;
  }) {
    return {
      id: p.id,
      amountGrosze: p.amountGrosze,
      paidOn: p.paidOn.toISOString().slice(0, 10),
      reference: p.reference,
      createdBy: p.createdBy,
      createdAt: p.createdAt,
    };
  }

  private productLabel(kind: string, packageId: string | null): string {
    if (kind === 'subscription') return 'Abonament';
    if (packageId === WELCOME_PACKAGE.id) return WELCOME_PACKAGE.label;
    const pkg = findPackage(packageId ?? '');
    return pkg ? `Pakiet ${pkg.label}` : 'Pakiet';
  }
}
