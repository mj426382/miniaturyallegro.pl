import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GenerationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../images/storage.service';

export const ADMIN_IMAGES_PAGE = 12;
export const ADMIN_GENERATIONS_PAGE = 24;
export const ADMIN_RATING_FILTERS = ['up', 'down', 'rated'] as const;
export type AdminRatingFilter = (typeof ADMIN_RATING_FILTERS)[number];

/**
 * Spec 16: the operator looks at users' photos and graphics (support, quality, abuse). Every view is
 * logged with the admin's address – accountability for access to customer content (RODO art. 5(2)).
 */
@Injectable()
export class AdminContentService {
  private readonly logger = new Logger(AdminContentService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async userImages(adminEmail: string, userId: string, page = 1, limit = ADMIN_IMAGES_PAGE) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('Nie znaleziono użytkownika');
    const take = Math.min(Math.max(limit, 1), 48);
    const safePage = Math.max(1, page);

    const [total, images] = await Promise.all([
      this.prisma.image.count({ where: { userId } }),
      this.prisma.image.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (safePage - 1) * take,
        take,
        select: {
          id: true,
          originalUrl: true,
          createdAt: true,
          allegroOfferId: true,
          offerDescription: { select: { title: true } },
          generations: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              style: true,
              status: true,
              url: true,
              rating: true,
              ratingReason: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);
    this.logger.log(`Admin ${adminEmail} viewed images of user ${userId} (page ${safePage})`);

    return {
      images: await Promise.all(
        images.map(async ({ offerDescription, ...image }) => ({
          ...image,
          originalUrl: await this.storage.getSignedUrl(image.originalUrl),
          descriptionTitle: offerDescription?.title ?? null,
          generations: await Promise.all(
            image.generations.map(async (g) => ({ ...g, url: g.url ? await this.storage.getSignedUrl(g.url) : null })),
          ),
        })),
      ),
      pagination: { page: safePage, limit: take, total, pages: Math.max(1, Math.ceil(total / take)) },
    };
  }

  async recentGenerations(
    adminEmail: string,
    options: { page?: number; limit?: number; status?: GenerationStatus; rating?: AdminRatingFilter },
  ) {
    const take = Math.min(Math.max(options.limit ?? ADMIN_GENERATIONS_PAGE, 1), 96);
    const page = Math.max(1, options.page ?? 1);
    const where: Prisma.GenerationWhereInput = {
      ...(options.status ? { status: options.status } : {}),
      ...(options.rating === 'up' ? { rating: 1 } : options.rating === 'down' ? { rating: -1 } : {}),
      ...(options.rating === 'rated' ? { rating: { not: null } } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.generation.count({ where }),
      this.prisma.generation.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * take,
        take,
        select: {
          id: true,
          style: true,
          status: true,
          url: true,
          rating: true,
          ratingReason: true,
          createdAt: true,
          image: { select: { id: true, originalUrl: true, user: { select: { id: true, email: true } } } },
        },
      }),
    ]);
    this.logger.log(
      `Admin ${adminEmail} viewed recent generations (page ${page}, status ${options.status ?? 'any'}, rating ${options.rating ?? 'any'})`,
    );

    return {
      generations: await Promise.all(
        rows.map(async ({ image, ...g }) => ({
          ...g,
          url: g.url ? await this.storage.getSignedUrl(g.url) : null,
          image: { id: image.id, originalUrl: await this.storage.getSignedUrl(image.originalUrl) },
          user: image.user,
        })),
      ),
      pagination: { page, limit: take, total, pages: Math.max(1, Math.ceil(total / take)) },
    };
  }
}
