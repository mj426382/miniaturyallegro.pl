import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

@Injectable()
export class ImagesService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async uploadImage(userId: string, file: any) {
    const { url, filename } = await this.storageService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      'originals',
    );

    const image = await this.prisma.image.create({
      data: {
        userId,
        originalUrl: url,
        filename,
      },
      include: {
        generations: true,
      },
    });

    return this.withSignedUrls(image);
  }

  async getUserImages(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [images, total] = await Promise.all([
      this.prisma.image.findMany({
        where: { userId },
        include: {
          generations: {
            where: { status: 'COMPLETED' },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.image.count({ where: { userId } }),
    ]);

    return {
      images: images.map((img) => this.withSignedUrls(img)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getImageById(id: string, userId: string) {
    const image = await this.prisma.image.findUnique({
      where: { id },
      include: {
        generations: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    if (image.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.withSignedUrls(image);
  }

  async deleteImage(id: string, userId: string) {
    const image = await this.getImageById(id, userId);

    await this.storageService.deleteFile(image.filename);
    await this.prisma.image.delete({ where: { id } });

    return { message: 'Image deleted successfully' };
  }

  private withSignedUrls(image: any): any {
    return {
      ...image,
      originalUrl: this.storageService.getSignedUrl(image.originalUrl),
      generations: (image.generations ?? []).map((g: any) => ({
        ...g,
        url: g.url ? this.storageService.getSignedUrl(g.url) : null,
      })),
    };
  }
}
