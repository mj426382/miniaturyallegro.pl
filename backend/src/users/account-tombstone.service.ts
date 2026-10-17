import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { canonicalEmail } from '../auth/email-canonical';
import { derivePurposeKey, keyedHash } from '../common/keys';
import { integerSetting } from '../config/env.validation';

const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

type Db = PrismaService | Prisma.TransactionClient;

/**
 * Spec 03, "Ślad usuniętego konta": when an account is deleted we keep only an HMAC of its canonical
 * e-mail (spec 13 normalisation: case, spaces, +alias, Gmail dots, googlemail.com) and the date. A new
 * sign-up of the same mailbox then gets no free pool and no referral bonus. The key is purpose-bound
 * (HKDF from JWT_SECRET or ACCOUNT_TOMBSTONE_SECRET), so the hash cannot be reproduced from the address
 * alone. Rows are purged after ACCOUNT_TOMBSTONE_RETENTION_MONTHS (default 12) – at start-up and daily.
 */
@Injectable()
export class AccountTombstoneService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountTombstoneService.name);
  private readonly key: Buffer;
  readonly retentionMonths: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    this.key = derivePurposeKey('account-tombstone', config);
    this.retentionMonths = integerSetting(
      'ACCOUNT_TOMBSTONE_RETENTION_MONTHS',
      config.get<string>('ACCOUNT_TOMBSTONE_RETENTION_MONTHS'),
    );
  }

  onModuleInit() {
    // Tests call purgeExpired() with a fixed clock.
    if (process.env.NODE_ENV === 'test') return;
    const run = () => this.purgeExpired().catch((err) => this.logger.error('Tombstone purge failed', err));
    run();
    this.timer = setInterval(run, PURGE_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** The stored value for an address: HMAC-SHA256 of its canonical form with the tombstone key. */
  hashEmail(email: string): string {
    return keyedHash(this.key, canonicalEmail(email));
  }

  /** Records (or refreshes) the tombstone of a deleted account – call inside the deletion transaction. */
  record(email: string, db: Db = this.prisma, now: Date = new Date()) {
    const emailHash = this.hashEmail(email);
    return db.accountTombstone.upsert({
      where: { emailHash },
      create: { emailHash, deletedAt: now },
      update: { deletedAt: now },
    });
  }

  /** True when an account of this mailbox was deleted within the retention period. */
  async isTombstoned(email: string, now: Date = new Date()): Promise<boolean> {
    const row = await this.prisma.accountTombstone.findUnique({
      where: { emailHash: this.hashEmail(email) },
      select: { deletedAt: true },
    });
    return Boolean(row && row.deletedAt >= this.cutoff(now));
  }

  /** Deletes tombstones older than the retention period. Returns how many were removed. */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.accountTombstone.deleteMany({ where: { deletedAt: { lt: this.cutoff(now) } } });
    if (count) this.logger.log(`Purged ${count} account tombstone(s) older than ${this.retentionMonths} months`);
    return count;
  }

  /** `now` minus the retention period in calendar months (UTC). */
  cutoff(now: Date): Date {
    const d = new Date(now.getTime());
    d.setUTCMonth(d.getUTCMonth() - this.retentionMonths);
    return d;
  }
}
