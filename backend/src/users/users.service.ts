import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseAdminEmails } from '../admin/admin-emails';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../images/storage.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly admins: Set<string>;

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private paymentsService: PaymentsService,
    config: ConfigService,
  ) {
    this.admins = parseAdminEmails(config.get<string>('ADMIN_EMAILS'));
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        credits: true,
        freeCreditsUsed: true,
        freeCreditsLimit: true,
        termsAcceptedAt: true,
        emailVerifiedAt: true,
        marketingConsentAt: true,
        notifyBatchDone: true,
        createdAt: true,
        updatedAt: true,
        password: true,
        _count: {
          select: { images: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    // The hash never leaves the service – the UI only needs to know whether a password exists (Google-only accounts have none).
    const { password, emailVerifiedAt, marketingConsentAt, ...safeUser } = user;

    // Spec 16, AC-ADM-014: an admin address counts only once it is confirmed.
    const isAdmin = Boolean(emailVerifiedAt) && this.admins.has(user.email.toLowerCase());
    const totalGenerations = await this.prisma.generation.count({
      where: {
        image: { userId: id },
        status: 'COMPLETED',
      },
    });

    return {
      ...safeUser,
      emailVerified: Boolean(emailVerifiedAt),
      marketingConsent: Boolean(marketingConsentAt),
      isAdmin,
      // Spec 16, AC-ADM-012: admins generate without a credit limit (see CreditsService).
      unlimitedCredits: isAdmin,
      hasPassword: Boolean(password),
      totalGenerations,
    };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /** Name and notification settings (spec 16). Turning consent on records when it was given. */
  async updateProfile(id: string, data: { name?: string; marketingConsent?: boolean; notifyBatchDone?: boolean }) {
    const current = await this.prisma.user.findUnique({ where: { id }, select: { marketingConsentAt: true } });
    if (!current) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.notifyBatchDone !== undefined ? { notifyBatchDone: data.notifyBatchDone } : {}),
        ...(data.marketingConsent !== undefined
          ? { marketingConsentAt: data.marketingConsent ? (current.marketingConsentAt ?? new Date()) : null }
          : {}),
      },
      select: { id: true, email: true, name: true, updatedAt: true, marketingConsentAt: true, notifyBatchDone: true },
    });
    const { marketingConsentAt, ...rest } = updated;
    return { ...rest, marketingConsent: Boolean(marketingConsentAt) };
  }

  /**
   * Permanently deletes the account, all uploaded photos and generated graphics.
   * Database rows cascade; storage objects are removed best-effort (a failure to
   * delete a file must not block the erasure request).
   */
  async deleteAccount(id: string, confirmEmail: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { images: { include: { generations: { select: { url: true, referenceKey: true } } } } },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.email.toLowerCase() !== confirmEmail.toLowerCase()) {
      throw new BadRequestException('Podany adres email nie zgadza się z adresem konta');
    }

    const keys: string[] = [];
    for (const image of user.images) {
      keys.push(image.filename);
      for (const g of image.generations) {
        if (g.url) keys.push(g.url);
        // Spec 05, AC-GEN-028: stored reference images of custom styles / reworks.
        if (g.referenceKey) keys.push(g.referenceKey);
      }
    }

    // Spec 03, AC-AUTH-026: landing demo requests of the same mailbox (e-mail + photo) go too.
    const demos = await this.prisma.demoRequest.findMany({
      where: { OR: [{ email: user.email }, { emailCanonical: user.emailCanonical }] },
      select: { id: true, imageKey: true, resultKey: true },
    });
    for (const demo of demos) {
      keys.push(demo.imageKey);
      if (demo.resultKey) keys.push(demo.resultKey);
    }

    await this.paymentsService.cancelSubscriptionForUser(id);
    await this.prisma.$transaction([
      this.prisma.demoRequest.deleteMany({ where: { id: { in: demos.map((d) => d.id) } } }),
      this.prisma.user.delete({ where: { id } }),
    ]);

    const results = await Promise.allSettled(keys.map((k) => this.storageService.deleteFile(k)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    this.logger.log(`Konto ${id} usunięte (${keys.length} plików, ${failed} błędów usuwania plików)`);

    return { message: 'Konto i wszystkie dane zostały usunięte' };
  }
}
