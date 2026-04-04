import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../images/storage.service';
import { GeminiService, GENERATION_STYLES } from './gemini.service';
import * as https from 'https';

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private prisma: PrismaService,
    private geminiService: GeminiService,
    private storageService: StorageService,
  ) {}

  async startGeneration(imageId: string, userId: string) {
    const image = await this.prisma.image.findUnique({
      where: { id: imageId },
    });

    if (!image) throw new NotFoundException('Image not found');
    if (image.userId !== userId) throw new ForbiddenException('Access denied');

    // Create 12 generation records (one per style)
    const generations = await Promise.all(
      GENERATION_STYLES.map((style) =>
        this.prisma.generation.create({
          data: {
            imageId,
            style: style.id,
            prompt: style.prompt,
            status: 'PENDING',
          },
        }),
      ),
    );

    // Process generations asynchronously
    this.processGenerations(image.originalUrl, generations.map((g) => g.id)).catch(
      (err) => this.logger.error('Generation processing failed', err),
    );

    return {
      message: 'Generation started',
      generationIds: generations.map((g) => g.id),
      count: generations.length,
    };
  }

  private async processGenerations(originalUrl: string, generationIds: string[]) {
    for (const generationId of generationIds) {
      try {
        await this.prisma.generation.update({
          where: { id: generationId },
          data: { status: 'PROCESSING' },
        });

        const generation = await this.prisma.generation.findUnique({
          where: { id: generationId },
        });

        const style = GENERATION_STYLES.find((s) => s.id === generation.style);

        // Fetch original image
        const imageBuffer = await this.fetchImageBuffer(originalUrl);
        const base64Image = imageBuffer.toString('base64');

        // Generate description using Gemini
        const description = await this.geminiService.generateImageDescription(
          base64Image,
          'image/jpeg',
        );

        // Generate optimized prompt for this style
        const optimizedPrompt = await this.geminiService.generatePromptForStyle(
          description,
          style,
        );

        // TODO: Replace with actual image generation API call (e.g. Imagen 3 via Vertex AI
        // or another image synthesis service) and upload the result to B2 storage.
        // For now, the optimized prompt is stored and the original image URL is used as placeholder.
        await this.prisma.generation.update({
          where: { id: generationId },
          data: {
            prompt: optimizedPrompt,
            status: 'COMPLETED',
            url: originalUrl,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to process generation ${generationId}`, error);
        await this.prisma.generation.update({
          where: { id: generationId },
          data: { status: 'FAILED' },
        });
      }
    }
  }

  private fetchImageBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      });
    });
  }

  async getGenerations(imageId: string, userId: string) {
    const image = await this.prisma.image.findUnique({
      where: { id: imageId },
    });

    if (!image) throw new NotFoundException('Image not found');
    if (image.userId !== userId) throw new ForbiddenException('Access denied');

    return this.prisma.generation.findMany({
      where: { imageId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getGenerationById(id: string, userId: string) {
    const generation = await this.prisma.generation.findUnique({
      where: { id },
      include: { image: true },
    });

    if (!generation) throw new NotFoundException('Generation not found');
    if (generation.image.userId !== userId) throw new ForbiddenException('Access denied');

    return generation;
  }

  async getStyles() {
    return GENERATION_STYLES;
  }
}
