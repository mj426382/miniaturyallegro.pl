import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { canonicalEmail } from '../auth/email-canonical';
import { StorageService } from '../images/storage.service';
import { GeminiService } from '../generation/gemini.service';
import { getStyle } from '../generation/styles';
import { MailService } from '../mail/mail.service';
import { prepareForAi } from '../images/image-prep';
import { sha256 } from '../common/crypto';
import { freeCreditsForNewAccounts } from '../generation/credits.service';

/** Hard caps – the demo is a lead magnet, not a free tier. */
const MAX_PER_IP_PER_DAY = 2;
const MAX_PER_EMAIL = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Terms of Service: demo photos and results are deleted after 30 days. */
const DEMO_RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class DemoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DemoService.name);
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly ipSalt: string;
  private readonly landingUrl: string;
  private readonly frontendUrl: string;
  /** Free graphics a new account gets – the demo e-mail promises exactly this many. */
  private readonly freeCredits: number;
  private readonly enabled: boolean;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private gemini: GeminiService,
    private mail: MailService,
    config: ConfigService,
  ) {
    this.ipSalt = config.get<string>('JWT_SECRET') || 'demo-salt';
    this.landingUrl = (config.get<string>('LANDING_URL') || 'https://allgrafika.pl').replace(/\/$/, '');
    this.frontendUrl = (config.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(/\/$/, '');
    this.freeCredits = freeCreditsForNewAccounts(config.get<string>('FREE_CREDITS_LIMIT'));
    this.enabled = (config.get<string>('DEMO_ENABLED') ?? 'true') !== 'false';
  }

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.cleanupExpired().catch((err) => this.logger.error('Demo cleanup failed', err));
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired().catch((err) => this.logger.error('Demo cleanup failed', err));
    }, CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  /** Deletes demo rows and their files once the retention period has passed. */
  async cleanupExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - DEMO_RETENTION_DAYS * DAY_MS);
    const expired = await this.prisma.demoRequest.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true, imageKey: true, resultKey: true },
      take: 500,
    });
    for (const row of expired) {
      await Promise.allSettled(
        [row.imageKey, row.resultKey].filter(Boolean).map((key) => this.storage.deleteFile(key!)),
      );
      await this.prisma.demoRequest.delete({ where: { id: row.id } }).catch(() => undefined);
    }
    if (expired.length)
      this.logger.log(`Demo cleanup: removed ${expired.length} request(s) older than ${DEMO_RETENTION_DAYS} days`);
    return expired.length;
  }

  async create(params: {
    email: string;
    ip: string;
    buffer: Buffer;
    mimeType: string;
    styleId: string;
    marketingOk: boolean;
    honeypot?: string;
  }) {
    if (!this.enabled) throw new HttpException('Demo jest chwilowo wyłączone', HttpStatus.SERVICE_UNAVAILABLE);
    if (params.honeypot) {
      // Pretend success for bots – never reveal the honeypot.
      return { id: 'ok', status: 'PENDING' };
    }

    const ipHash = sha256(`${params.ip}|${this.ipSalt}`);
    const [byIp, byEmail] = await Promise.all([
      this.prisma.demoRequest.count({ where: { ipHash, createdAt: { gte: new Date(Date.now() - DAY_MS) } } }),
      this.prisma.demoRequest.count({
        where: { OR: [{ emailCanonical: canonicalEmail(params.email) }, { email: params.email }] },
      }),
    ]);
    if (byEmail >= MAX_PER_EMAIL) {
      throw new ConflictException(
        'Ten adres e-mail skorzystał już z darmowego demo. Załóż konto, aby otrzymać darmowe grafiki na start.',
      );
    }
    if (byIp >= MAX_PER_IP_PER_DAY) {
      throw new HttpException(
        'Limit darmowych prób na dziś został wykorzystany. Załóż konto, aby generować dalej.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const style = getStyle(params.styleId) ?? getStyle('white-bg')!;
    const { url: imageKey } = await this.storage.uploadFile(params.buffer, 'demo.jpg', params.mimeType, 'demo');

    const request = await this.prisma.demoRequest.create({
      data: {
        email: params.email,
        emailCanonical: canonicalEmail(params.email),
        ipHash,
        imageKey,
        marketingOk: params.marketingOk,
        status: 'PENDING',
      },
    });

    this.process(request.id, params.buffer, params.mimeType, style.id).catch((err) =>
      this.logger.error(`Demo ${request.id} failed`, err),
    );

    return { id: request.id, status: 'PENDING' };
  }

  async get(id: string) {
    const request = await this.prisma.demoRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Nie znaleziono demo');
    return {
      id: request.id,
      status: request.status,
      originalUrl: await this.storage.getSignedUrl(request.imageKey),
      resultUrl: request.resultKey ? await this.storage.getSignedUrl(request.resultKey) : null,
      registerUrl: `${this.frontendUrl}/register`,
    };
  }

  private async process(id: string, buffer: Buffer, mimeType: string, styleId: string) {
    const style = getStyle(styleId)!;
    try {
      await this.prisma.demoRequest.update({ where: { id }, data: { status: 'PROCESSING' } });
      const prepared = await prepareForAi(buffer, mimeType);
      const base64 = prepared.buffer.toString('base64');

      const description = await this.gemini.generateImageDescription(base64, prepared.mimeType);
      const prompt = await this.gemini.generatePromptForStyle(description, style);
      const generated = await this.gemini.generateImage(base64, prepared.mimeType, prompt);

      const { url: resultKey } = await this.storage.uploadFile(
        Buffer.from(generated.base64, 'base64'),
        'demo-result.png',
        generated.mimeType,
        'demo',
      );
      const request = await this.prisma.demoRequest.update({ where: { id }, data: { status: 'COMPLETED', resultKey } });

      const resultLink = `${this.landingUrl}/?demo=${request.id}`;
      // The result is already stored and visible on the page – an e-mail failure must not undo that.
      // Transactional by default; the promotional line is added only with explicit marketing consent (art. 10 UŚUDE).
      const promo = request.marketingOk
        ? [
            `Załóż darmowe konto, aby wygenerować ${this.freeCredits} kolejnych grafik bez karty: ${this.frontendUrl}/register`,
            '',
          ]
        : [];
      const promoHtml = request.marketingOk
        ? `<p><a href="${this.frontendUrl}/register">Załóż darmowe konto</a>, aby wygenerować ${this.freeCredits} kolejnych grafik bez karty.</p>`
        : '';
      await this.mail
        .send({
          to: request.email,
          subject: 'Twoja próbna grafika AllGrafika jest gotowa',
          text: [
            'Cześć,',
            '',
            `Twoja próbna grafika w stylu „${style.name}” jest gotowa: ${resultLink}`,
            '',
            ...promo,
            'Jeśli to nie Ty wysłałeś zdjęcie, zignoruj tę wiadomość.',
          ].join('\n'),
          html: `<p>Cześć,</p><p>Twoja próbna grafika w stylu „${style.name}” jest gotowa: <a href="${resultLink}">zobacz wynik</a>.</p>${promoHtml}`,
        })
        .catch((err) => this.logger.error(`Demo ${id}: result e-mail failed`, err));
    } catch (error) {
      this.logger.error(`Demo ${id} processing failed`, error);
      await this.prisma.demoRequest.update({ where: { id }, data: { status: 'FAILED' } }).catch(() => undefined);
    }
  }
}
