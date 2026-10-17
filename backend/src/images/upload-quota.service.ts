import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { dateSetting, integerSetting } from '../config/env.validation';
import { isVerificationRequired } from '../auth/email-verification';
import { pluralPl } from '../notifications/email-template';

export const UPLOAD_LIMIT_UNVERIFIED = 'UPLOAD_LIMIT_UNVERIFIED';
export const UPLOAD_LIMIT_DAILY = 'UPLOAD_LIMIT_DAILY';

const WINDOW_MS = 24 * 60 * 60 * 1000;
/** Ledger rows of confirmed accounts older than this are no longer needed for any limit. */
const KEEP_VERIFIED_ROWS_MS = 2 * WINDOW_MS;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Spec 04: upload limits. Unconfirmed accounts may upload UPLOAD_LIMIT_UNVERIFIED photos in total
 * (default 5), confirmed accounts UPLOAD_LIMIT_PER_DAY in a rolling 24 h window (default 200).
 *
 * Each upload reserves a row in `upload_log` inside a transaction that first locks the user row, so
 * parallel uploads (bulk upload sends one request per file) are counted exactly – never more than the
 * limit get through. A reservation is released when storing the file fails afterwards.
 */
@Injectable()
export class UploadQuotaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UploadQuotaService.name);
  readonly unverifiedLimit: number;
  readonly dailyLimit: number;
  private readonly verificationRequired: boolean;
  private readonly limitsFrom: Date;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    this.unverifiedLimit = integerSetting('UPLOAD_LIMIT_UNVERIFIED', config.get<string>('UPLOAD_LIMIT_UNVERIFIED'));
    this.dailyLimit = integerSetting('UPLOAD_LIMIT_PER_DAY', config.get<string>('UPLOAD_LIMIT_PER_DAY'));
    this.verificationRequired = isVerificationRequired(config.get<string>('EMAIL_VERIFICATION_REQUIRED'));
    this.limitsFrom = dateSetting('UPLOAD_LIMITS_FROM', config.get<string>('UPLOAD_LIMITS_FROM'));
  }

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const run = () => this.cleanup().catch((err) => this.logger.error('Upload log cleanup failed', err));
    run();
    this.timer = setInterval(run, CLEANUP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Reserves one upload for the user or throws the limit error (403 UPLOAD_LIMIT_UNVERIFIED /
   * 429 UPLOAD_LIMIT_DAILY). Returns the reservation id for release().
   */
  async reserve(userId: string, now: Date = new Date()): Promise<string> {
    return this.prisma.$transaction(
      async (tx) => {
        // The row lock serialises concurrent uploads of this user, so the count below is exact.
        const rows = await tx.$queryRaw<{ emailVerifiedAt: Date | null }[]>`
          SELECT "emailVerifiedAt" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
        if (!rows.length) throw new HttpException('Nie znaleziono konta', HttpStatus.UNAUTHORIZED);

        // AC-UPL-025: before UPLOAD_LIMITS_FROM uploads are only recorded, so the limits count them later.
        if (now < this.limitsFrom) {
          // no limit yet
        } else if (this.verificationRequired && !rows[0].emailVerifiedAt) {
          const total = await tx.uploadLog.count({ where: { userId } });
          if (total >= this.unverifiedLimit) throw this.unverifiedError();
        } else {
          const since = new Date(now.getTime() - WINDOW_MS);
          const recent = await tx.uploadLog.findMany({
            where: { userId, createdAt: { gt: since } },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
            take: this.dailyLimit,
          });
          if (recent.length >= this.dailyLimit) {
            // The oldest upload in the window frees the next slot.
            const retryAfterMs = recent[0].createdAt.getTime() + WINDOW_MS - now.getTime();
            throw this.dailyError(Math.max(1, Math.ceil(retryAfterMs / 1000)));
          }
        }

        const row = await tx.uploadLog.create({ data: { userId, createdAt: now }, select: { id: true } });
        return row.id;
      },
      // Bulk upload sends up to 50 requests at once – they queue on the row lock, not on the pool.
      { maxWait: 15_000, timeout: 15_000 },
    );
  }

  /** Gives the slot back when the upload failed after the reservation (e.g. storage error). */
  async release(reservationId: string): Promise<void> {
    await this.prisma.uploadLog.deleteMany({ where: { id: reservationId } });
  }

  /** Drops ledger rows no limit needs any more (confirmed accounts, older than 48 h). */
  async cleanup(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.uploadLog.deleteMany({
      where: {
        createdAt: { lt: new Date(now.getTime() - KEEP_VERIFIED_ROWS_MS) },
        user: { emailVerifiedAt: { not: null } },
      },
    });
    return count;
  }

  private unverifiedError(): HttpException {
    const n = this.unverifiedLimit;
    return new HttpException(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        code: UPLOAD_LIMIT_UNVERIFIED,
        limit: n,
        message: `Przed potwierdzeniem adresu e-mail możesz przesłać najwyżej ${n} ${pluralPl(n, 'zdjęcie', 'zdjęcia', 'zdjęć')}. Kliknij link z wiadomości, którą wysłaliśmy po rejestracji (możesz wysłać go ponownie z banera u góry strony), a potem prześlesz kolejne.`,
      },
      HttpStatus.FORBIDDEN,
    );
  }

  private dailyError(retryAfterSeconds: number): HttpException {
    const n = this.dailyLimit;
    const hours = Math.max(1, Math.ceil(retryAfterSeconds / 3600));
    return new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        code: UPLOAD_LIMIT_DAILY,
        limit: n,
        retryAfterSeconds,
        message: `Osiągnięto dzienny limit ${n} ${pluralPl(n, 'przesłanego zdjęcia', 'przesłanych zdjęć', 'przesłanych zdjęć')}. Kolejne prześlesz za około ${hours} ${pluralPl(hours, 'godzinę', 'godziny', 'godzin')}.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
