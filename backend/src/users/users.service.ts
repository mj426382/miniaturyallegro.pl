import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../images/storage.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private paymentsService: PaymentsService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        credits: true,
        freeCreditsUsed: true,
        termsAcceptedAt: true,
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
    const { password, ...safeUser } = user;

    const totalGenerations = await this.prisma.generation.count({
      where: {
        image: { userId: id },
        status: 'COMPLETED',
      },
    });

    return { ...safeUser, hasPassword: Boolean(password), totalGenerations };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async updateProfile(id: string, data: { name?: string }) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Permanently deletes the account, all uploaded photos and generated graphics.
   * Database rows cascade; storage objects are removed best-effort (a failure to
   * delete a file must not block the erasure request).
   */
  async deleteAccount(id: string, confirmEmail: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { images: { include: { generations: { select: { url: true } } } } },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.email.toLowerCase() !== confirmEmail.toLowerCase()) {
      throw new BadRequestException('Podany adres email nie zgadza się z adresem konta');
    }

    const keys: string[] = [];
    for (const image of user.images) {
      keys.push(image.filename);
      for (const g of image.generations) if (g.url) keys.push(g.url);
    }

    await this.paymentsService.cancelSubscriptionForUser(id);
    await this.prisma.user.delete({ where: { id } });

    const results = await Promise.allSettled(keys.map((k) => this.storageService.deleteFile(k)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    this.logger.log(`Konto ${id} usunięte (${keys.length} plików, ${failed} błędów usuwania plików)`);

    return { message: 'Konto i wszystkie dane zostały usunięte' };
  }
}
