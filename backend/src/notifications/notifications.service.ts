import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreditsService } from '../generation/credits.service';
import { GENERATION_STYLES, GenerationStyle } from '../generation/styles';
import { parseBool } from '../config/env.validation';
import { renderEmail } from './email-template';

/** Spec 16 constants. */
export const MIN_BATCH_IMAGES = 3;
export const MAX_BATCH_IMAGES = 50;
export const MAX_MAILS_PER_RUN = 50;
export const FREE_REMINDER_AFTER_MS = 72 * 60 * 60 * 1000;
export const FREE_REMINDER_MAX_ACCOUNT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const SEASON_CAMPAIGN_DAYS = 7;
export const BATCH_EXPIRY_MS = 24 * 60 * 60 * 1000;
export const SENDING_HOURS = { from: 9, to: 20 } as const;

const BATCH_INTERVAL_MS = 2 * 60 * 1000;
const REMINDER_INTERVAL_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const warsawHour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: 'numeric', hourCycle: 'h23' });
const warsawDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Marketing mail goes out only during the day in Poland. */
export function isSendingHour(now: Date): boolean {
  const hour = Number(warsawHour.format(now));
  return hour >= SENDING_HOURS.from && hour < SENDING_HOURS.to;
}

/**
 * The seasonal campaign runs during the first SEASON_CAMPAIGN_DAYS of a style's window (Polish calendar day).
 * Returns the campaign key (`season:<id>:<year of the window start>`) or null.
 */
export function seasonCampaignKey(style: Pick<GenerationStyle, 'id' | 'season'>, now: Date): string | null {
  if (!style.season) return null;
  const [y, m, d] = warsawDate.format(now).split('-').map(Number);
  const today = Date.UTC(y, m - 1, d);
  const [fromMonth, fromDay] = style.season.from.split('-').map(Number);
  for (const year of [y, y - 1]) {
    const start = Date.UTC(year, fromMonth - 1, fromDay);
    const diff = Math.round((today - start) / DAY_MS);
    if (diff >= 0 && diff < SEASON_CAMPAIGN_DAYS) return `season:${style.id}:${year}`;
  }
  return null;
}

type MailKind = 'free-credits-reminder' | 'seasonal' | 'batch-done';

/**
 * Automatic e-mails (spec 16): free-credit reminder and seasonal styles (marketing – consent only,
 * 9–20 Polish time, unsubscribe link + List-Unsubscribe) and the transactional "batch finished" mail.
 * Every send is claimed first in email_log under a unique (user, key), so restarts and parallel runs
 * never send twice; a failed send releases the claim and is retried on the next run.
 */
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly frontendUrl: string;
  private readonly apiUrl: string;
  private readonly enabled: boolean;
  private timers: NodeJS.Timeout[] = [];
  private running = { batches: false, reminders: false };

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private jwt: JwtService,
    private credits: CreditsService,
    config: ConfigService,
  ) {
    this.frontendUrl = (config.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(/\/$/, '');
    this.apiUrl = (config.get<string>('API_PUBLIC_URL') || 'http://localhost:3000').replace(/\/$/, '');
    // Jobs never run on their own in tests – tests call them with a fixed clock.
    this.enabled =
      parseBool(config.get<string>('NOTIFICATIONS_ENABLED'), true) && config.get<string>('NODE_ENV') !== 'test';
  }

  onModuleInit() {
    if (!this.enabled) return;
    const every = (ms: number, job: () => Promise<unknown>) => {
      const timer = setInterval(() => job().catch((err) => this.logger.error('Notification job failed', err)), ms);
      timer.unref?.();
      this.timers.push(timer);
    };
    every(BATCH_INTERVAL_MS, () => this.runBatchJob());
    every(REMINDER_INTERVAL_MS, () => this.runReminderJob());
  }

  onModuleDestroy() {
    this.timers.forEach(clearInterval);
  }

  // ─── Batches (transactional) ──────────────────────────────────────

  async registerBatch(userId: string, imageIds: string[]) {
    const unique = [...new Set(imageIds)];
    if (unique.length < MIN_BATCH_IMAGES || unique.length > MAX_BATCH_IMAGES) {
      throw new BadRequestException(`Paczka musi mieć od ${MIN_BATCH_IMAGES} do ${MAX_BATCH_IMAGES} zdjęć`);
    }
    const owned = await this.prisma.image.count({ where: { id: { in: unique }, userId } });
    if (owned !== unique.length) throw new NotFoundException('Nie znaleziono zdjęcia');
    const batch = await this.prisma.notificationBatch.create({ data: { userId, imageIds: unique } });
    return { id: batch.id };
  }

  async runBatchJob(now: Date = new Date()): Promise<number> {
    if (this.running.batches) return 0;
    this.running.batches = true;
    let sent = 0;
    try {
      const open = await this.prisma.notificationBatch.findMany({
        where: { closedAt: null },
        orderBy: { createdAt: 'asc' },
        take: MAX_MAILS_PER_RUN * 4,
        include: { user: { select: { id: true, email: true, name: true, notifyBatchDone: true } } },
      });
      for (const batch of open) {
        if (sent >= MAX_MAILS_PER_RUN) break;
        if (now.getTime() - batch.createdAt.getTime() > BATCH_EXPIRY_MS) {
          await this.closeBatch(batch.id, now, false);
          continue;
        }
        const counts = await this.prisma.generation.groupBy({
          by: ['status'],
          where: { imageId: { in: batch.imageIds }, image: { userId: batch.userId } },
          _count: { _all: true },
        });
        const by = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>;
        if ((by.PENDING ?? 0) + (by.PROCESSING ?? 0) > 0) continue;
        const completed = by.COMPLETED ?? 0;
        const failed = by.FAILED ?? 0;
        if (!batch.user.notifyBatchDone || completed + failed === 0) {
          await this.closeBatch(batch.id, now, false);
          continue;
        }
        const content = renderEmail({
          heading: 'Twoje grafiki są gotowe',
          paragraphs: [
            `Cześć${batch.user.name ? ` ${batch.user.name}` : ''},`,
            `zakończyliśmy generowanie grafik dla paczki ${batch.imageIds.length} zdjęć. Gotowe: ${completed}` +
              (failed
                ? `, nieudane: ${failed} (kredyty za nie wróciły na konto – możesz je ponowić jednym kliknięciem).`
                : '.'),
            'W galerii pobierzesz wszystko jedną paczką ZIP i napiszesz opisy ofert dla całej partii.',
          ],
          cta: { label: 'Otwórz galerię', url: `${this.frontendUrl}/gallery` },
          footer: [
            'Wysyłamy to powiadomienie, bo uruchomiłeś generowanie wielu zdjęć naraz. Wyłączysz je w ustawieniach konta.',
          ],
        });
        const ok = await this.send(
          batch.user,
          'batch-done',
          `batch:${batch.id}`,
          'AllGrafika – grafiki z paczki są gotowe',
          content,
        );
        if (ok) {
          sent++;
          await this.closeBatch(batch.id, now, true);
        }
      }
    } finally {
      this.running.batches = false;
    }
    return sent;
  }

  private closeBatch(id: string, now: Date, notified: boolean) {
    return this.prisma.notificationBatch.update({
      where: { id },
      data: { closedAt: now, ...(notified ? { notifiedAt: now } : {}) },
    });
  }

  // ─── Reminders (marketing, consent only) ──────────────────────────

  async runReminderJob(now: Date = new Date()): Promise<{ free: number; seasonal: number }> {
    if (this.running.reminders || !isSendingHour(now)) return { free: 0, seasonal: 0 };
    this.running.reminders = true;
    try {
      const free = await this.sendFreeCreditReminders(now, MAX_MAILS_PER_RUN);
      const seasonal = await this.sendSeasonalCampaigns(now, MAX_MAILS_PER_RUN - free);
      return { free, seasonal };
    } finally {
      this.running.reminders = false;
    }
  }

  private async sendFreeCreditReminders(now: Date, quota: number): Promise<number> {
    if (quota <= 0) return 0;
    const users = await this.prisma.user.findMany({
      where: {
        marketingConsentAt: { not: null },
        emailVerifiedAt: { not: null },
        createdAt: {
          lte: new Date(now.getTime() - FREE_REMINDER_AFTER_MS),
          gte: new Date(now.getTime() - FREE_REMINDER_MAX_ACCOUNT_AGE_MS),
        },
        freeCreditsUsed: { lt: this.credits.freeLimit },
        emailLog: { none: { key: 'free-credits-reminder' } },
      },
      select: { id: true, email: true, name: true, freeCreditsUsed: true },
      orderBy: { createdAt: 'asc' },
      take: quota,
    });
    let sent = 0;
    for (const user of users) {
      const left = this.credits.freeLimit - user.freeCreditsUsed;
      const content = renderEmail({
        heading: `Masz jeszcze ${left} ${left === 1 ? 'darmową grafikę' : left < 5 ? 'darmowe grafiki' : 'darmowych grafik'}`,
        paragraphs: [
          `Cześć${user.name ? ` ${user.name}` : ''},`,
          `na Twoim koncie AllGrafika czeka ${left} z ${this.credits.freeLimit} darmowych grafik. Wgraj zdjęcie produktu, a w kilka minut dostaniesz miniatury zgodne z wymaganiami Allegro – na białym tle, w aranżacji albo w stylu sezonowym.`,
          'Do każdego zdjęcia z grafiką napiszemy też gratis opis oferty pod SEO Allegro.',
        ],
        cta: { label: 'Wygeneruj grafiki', url: `${this.frontendUrl}/upload` },
        footer: this.marketingFooter(user.id),
      });
      if (
        await this.send(
          user,
          'free-credits-reminder',
          'free-credits-reminder',
          `AllGrafika – czeka na Ciebie ${left} darmowych grafik`,
          content,
          true,
        )
      ) {
        sent++;
      }
    }
    return sent;
  }

  private async sendSeasonalCampaigns(now: Date, quota: number): Promise<number> {
    let sent = 0;
    for (const style of GENERATION_STYLES) {
      if (sent >= quota) break;
      const key = seasonCampaignKey(style, now);
      if (!key) continue;
      const users = await this.prisma.user.findMany({
        where: {
          marketingConsentAt: { not: null },
          emailVerifiedAt: { not: null },
          emailLog: { none: { key } },
        },
        select: { id: true, email: true, name: true },
        orderBy: { createdAt: 'asc' },
        take: quota - sent,
      });
      for (const user of users) {
        const content = renderEmail({
          heading: `Nowy sezon: styl „${style.name}”`,
          paragraphs: [
            `Cześć${user.name ? ` ${user.name}` : ''},`,
            `zaczyna się sezon „${style.name}” – dobry moment, żeby odświeżyć zdjęcia ofert. W AllGrafika czeka na Ciebie styl sezonowy: ${style.description}`,
            'Grafika sezonowa świetnie sprawdza się jako kolejne zdjęcie oferty i w kampaniach – zdjęcie główne zostaw na białym tle, zgodnie z zasadami Allegro.',
          ],
          cta: { label: 'Wygeneruj grafikę sezonową', url: `${this.frontendUrl}/gallery` },
          footer: this.marketingFooter(user.id),
        });
        if (
          await this.send(
            user,
            'seasonal',
            key,
            `AllGrafika – styl „${style.name}” na nadchodzący sezon`,
            content,
            true,
          )
        ) {
          sent++;
        }
      }
    }
    return sent;
  }

  // ─── Unsubscribe ───────────────────────────────────────────────────

  unsubscribeToken(userId: string): string {
    return this.jwt.sign({ sub: userId, purpose: 'unsubscribe' }, { expiresIn: '3650d' });
  }

  async unsubscribe(token: string | undefined) {
    let payload: any;
    try {
      payload = this.jwt.verify(String(token || ''));
    } catch {
      throw new BadRequestException('Link wypisania jest nieprawidłowy');
    }
    if (payload?.purpose !== 'unsubscribe' || !payload?.sub) {
      throw new BadRequestException('Link wypisania jest nieprawidłowy');
    }
    await this.prisma.user.updateMany({ where: { id: payload.sub }, data: { marketingConsentAt: null } });
    return { unsubscribed: true };
  }

  private marketingFooter(userId: string): EmailFooter {
    const token = this.unsubscribeToken(userId);
    return [
      'Dostajesz tę wiadomość, bo zgodziłeś się na wskazówki i przypomnienia od AllGrafika.',
      {
        text: 'Nie chcesz ich więcej?',
        link: { label: 'Wypisz się jednym kliknięciem', url: `${this.frontendUrl}/unsubscribe?token=${token}` },
      },
    ];
  }

  // ─── Sending ───────────────────────────────────────────────────────

  /** Claims (user, key) in email_log, sends, and releases the claim when the send fails. */
  private async send(
    user: { id: string; email: string },
    kind: MailKind,
    key: string,
    subject: string,
    content: { html: string; text: string },
    marketing = false,
  ): Promise<boolean> {
    let logId: string;
    try {
      logId = (await this.prisma.emailLog.create({ data: { userId: user.id, kind, key, subject } })).id;
    } catch (err: any) {
      if (err?.code === 'P2002') return false; // already sent by another run
      throw err;
    }
    try {
      await this.mail.send({
        to: user.email,
        subject,
        text: content.text,
        html: content.html,
        ...(marketing
          ? {
              headers: {
                'List-Unsubscribe': `<${this.apiUrl}/api/notifications/unsubscribe?token=${this.unsubscribeToken(user.id)}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              },
            }
          : {}),
      });
      return true;
    } catch (err: any) {
      this.logger.error(`Sending ${kind} to user ${user.id} failed: ${err?.message}`);
      await this.prisma.emailLog.delete({ where: { id: logId } }).catch(() => undefined);
      return false;
    }
  }
}

type EmailFooter = NonNullable<Parameters<typeof renderEmail>[0]['footer']>;
