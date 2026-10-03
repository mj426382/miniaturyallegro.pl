import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { validateImageBuffer } from './image-validation';

const MAX_PAGE_SIZE = 50;

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async uploadImage(userId: string, file: { buffer: Buffer; originalname: string }) {
    // Decode the header – never trust the declared MIME type or extension.
    const validated = await validateImageBuffer(file.buffer);

    const { url, filename } = await this.storageService.uploadFile(
      file.buffer,
      `upload${validated.extension}`,
      validated.mimeType,
      'originals',
    );

    const image = await this.prisma.image.create({
      data: {
        userId,
        originalUrl: url,
        filename,
      },
      include: { generations: true },
    });

    return await this.withSignedUrls(image);
  }

  async getUserImages(userId: string, page = 1, limit = 20) {
    const safeLimit = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * safeLimit;

    const [images, total] = await Promise.all([
      this.prisma.image.findMany({
        where: { userId },
        include: {
          generations: {
            orderBy: { createdAt: 'desc' },
            select: { id: true, status: true, style: true, url: true, createdAt: true },
          },
          offerDescription: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.image.count({ where: { userId } }),
    ]);

    return {
      // Gallery cards show whether the SEO offer copy already exists – a flag, not the whole text.
      images: await Promise.all(
        images.map(async ({ offerDescription, ...img }) => ({
          ...(await this.withSignedUrls(img)),
          hasDescription: Boolean(offerDescription),
        })),
      ),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  }

  async getImageById(id: string, userId: string) {
    const image = await this.prisma.image.findUnique({
      where: { id },
      include: {
        generations: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }
    if (image.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return await this.withSignedUrls(image);
  }

  async deleteImage(id: string, userId: string) {
    const image = await this.prisma.image.findUnique({
      where: { id },
      include: { generations: { select: { url: true } } },
    });
    if (!image) throw new NotFoundException('Image not found');
    if (image.userId !== userId) throw new ForbiddenException('Access denied');

    await this.prisma.image.delete({ where: { id } });

    const keys = [image.filename, ...image.generations.map((g) => g.url).filter(Boolean)];
    const results = await Promise.allSettled(keys.map((k) => this.storageService.deleteFile(k)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) this.logger.warn(`Image ${id}: ${failed}/${keys.length} storage objects could not be deleted`);

    return { message: 'Image deleted successfully' };
  }

  private async withSignedUrls(image: any): Promise<any> {
    // `description` is an internal AI artefact – not part of the public API.
    const { description: _description, ...rest } = image;
    return {
      ...rest,
      originalUrl: await this.storageService.getSignedUrl(image.originalUrl),
      generations: await Promise.all(
        (image.generations ?? []).map(async (g: any) => ({
          ...g,
          url: g.url ? await this.storageService.getSignedUrl(g.url) : null,
        })),
      ),
    };
  }
}
