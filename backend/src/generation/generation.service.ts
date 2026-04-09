import { Injectable, Logger, NotFoundException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../images/storage.service';
import { GeminiService, GENERATION_STYLES } from './gemini.service';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  /** Short-lived buffer cache to avoid re-downloading from B2 within the same session */
  private readonly bufferCache = new Map<string, { buffer: Buffer; expiresAt: number }>();
  private readonly BUFFER_TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor(
    private prisma: PrismaService,
    private geminiService: GeminiService,
    private storageService: StorageService,
  ) {}

  async startGeneration(imageId: string, userId: string, basePrompt?: string) {
    const image = await this.prisma.image.findUnique({
      where: { id: imageId },
    });

    if (!image) throw new NotFoundException('Image not found');
    if (image.userId !== userId) throw new ForbiddenException('Access denied');

    const count = GENERATION_STYLES.length;

    // Check and deduct credits before starting (synchronous, before async processing)
    await this.deductCredits(userId, count);

    // Create generation records (one per style)
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
    const originalUrlSigned = this.storageService.getSignedUrl(image.originalUrl);
    this.processGenerations(originalUrlSigned, generations.map((g) => g.id), basePrompt).catch(
      (err) => this.logger.error('Generation processing failed', err),
    );

    return {
      message: 'Generation started',
      generationIds: generations.map((g) => g.id),
      count: generations.length,
    };
  }

  private async processGenerations(originalUrl: string, generationIds: string[], basePrompt?: string) {
    // Fetch the original image once and reuse across all styles
    const imageBuffer = await this.fetchImageBuffer(originalUrl);
    const base64Image = imageBuffer.toString('base64');

    // Detect MIME type from the URL extension, defaulting to JPEG
    const mimeType = this.detectMimeType(originalUrl);

    // Generate a product description once to inform all style prompts
    const description = await this.geminiService.generateImageDescription(
      base64Image,
      mimeType,
    );

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

        // Build a style-specific image generation prompt
        const optimizedPrompt = await this.geminiService.generatePromptForStyle(
          description,
          style,
          basePrompt,
        );

        // Generate the thumbnail image with Gemini
        const generated = await this.geminiService.generateImage(
          base64Image,
          mimeType,
          optimizedPrompt,
        );

        // Upload the generated image to Backblaze B2
        const imageData = Buffer.from(generated.base64, 'base64');
        const { url } = await this.storageService.uploadFile(
          imageData,
          `${style.id}.png`,
          generated.mimeType,
          'generated',
        );

        await this.prisma.generation.update({
          where: { id: generationId },
          data: {
            prompt: optimizedPrompt,
            status: 'COMPLETED',
            url,
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

  private detectMimeType(url: string): string {
    try {
      const { pathname } = new URL(url);
      const ext = pathname.split('.').pop()?.toLowerCase();
      if (ext === 'png') return 'image/png';
      if (ext === 'webp') return 'image/webp';
      if (ext === 'gif') return 'image/gif';
    } catch {
      // fall through to default
    }
    return 'image/jpeg';
  }

  private async fetchImageBuffer(url: string): Promise<Buffer> {
    // Use signed URL as cache key base: strip query string so key is stable per file
    const cacheKey = url.split('?')[0];
    const now = Date.now();
    const cached = this.bufferCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      this.logger.debug(`Buffer cache hit: ${cacheKey}`);
      return cached.buffer;
    }

    const buffer = await this._fetchBufferFromUrl(url);
    this.bufferCache.set(cacheKey, { buffer, expiresAt: now + this.BUFFER_TTL_MS });
    return buffer;
  }

  private _fetchBufferFromUrl(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      client.get(url, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      });
    });
  }

  async startCustomGeneration(
    imageId: string,
    userId: string,
    userPrompt: string,
    referenceBuffer?: Buffer,
    referenceMimeType?: string,
  ) {
    const image = await this.prisma.image.findUnique({ where: { id: imageId } });
    if (!image) throw new NotFoundException('Image not found');
    if (image.userId !== userId) throw new ForbiddenException('Access denied');

    // Check and deduct 1 credit for custom generation
    await this.deductCredits(userId, 1);

    const generation = await this.prisma.generation.create({
      data: {
        imageId,
        style: 'custom',
        prompt: userPrompt,
        status: 'PENDING',
      },
    });

    const originalUrlSigned = this.storageService.getSignedUrl(image.originalUrl);
    this.processCustomGeneration(originalUrlSigned, generation.id, userPrompt, referenceBuffer, referenceMimeType).catch(
      (err) => this.logger.error('Custom generation failed', err),
    );

    return { generationId: generation.id };
  }

  private async processCustomGeneration(
    originalUrl: string,
    generationId: string,
    userPrompt: string,
    referenceBuffer?: Buffer,
    referenceMimeType?: string,
  ) {
    try {
      await this.prisma.generation.update({
        where: { id: generationId },
        data: { status: 'PROCESSING' },
      });

      const imageBuffer = await this.fetchImageBuffer(originalUrl);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.detectMimeType(originalUrl);

      const description = await this.geminiService.generateImageDescription(base64Image, mimeType);
      const optimizedPrompt = await this.geminiService.generateCustomPrompt(description, userPrompt);

      const refBase64 = referenceBuffer ? referenceBuffer.toString('base64') : undefined;

      const generated = await this.geminiService.generateImage(
        base64Image,
        mimeType,
        optimizedPrompt,
        refBase64,
        referenceMimeType,
      );

      const imageData = Buffer.from(generated.base64, 'base64');
      const { url } = await this.storageService.uploadFile(imageData, 'custom.png', generated.mimeType, 'generated');

      await this.prisma.generation.update({
        where: { id: generationId },
        data: { prompt: optimizedPrompt, status: 'COMPLETED', url },
      });
    } catch (error) {
      this.logger.error(`Custom generation ${generationId} failed`, error);
      await this.prisma.generation.update({
        where: { id: generationId },
        data: { status: 'FAILED' },
      });
    }
  }

  async getGenerations(imageId: string, userId: string) {
    const image = await this.prisma.image.findUnique({
      where: { id: imageId },
    });

    if (!image) throw new NotFoundException('Image not found');
    if (image.userId !== userId) throw new ForbiddenException('Access denied');

    const generations = await this.prisma.generation.findMany({
      where: { imageId },
      orderBy: { createdAt: 'asc' },
    });

    return generations.map((g) => ({
      ...g,
      url: g.url ? this.storageService.getSignedUrl(g.url) : null,
    }));
  }

  async getGenerationById(id: string, userId: string) {
    const generation = await this.prisma.generation.findUnique({
      where: { id },
      include: { image: true },
    });

    if (!generation) throw new NotFoundException('Generation not found');
    if (generation.image.userId !== userId) throw new ForbiddenException('Access denied');

    return {
      ...generation,
      url: generation.url ? this.storageService.getSignedUrl(generation.url) : null,
    };
  }

  async getGenerationForDownload(id: string, userId: string): Promise<{ buffer: Buffer; contentType: string; style: string }> {
    const generation = await this.prisma.generation.findUnique({
      where: { id },
      include: { image: true },
    });

    if (!generation) throw new NotFoundException('Generation not found');
    if (generation.image.userId !== userId) throw new ForbiddenException('Access denied');
    if (!generation.url) throw new NotFoundException('Generation file not available');

    const { buffer, contentType } = await this.storageService.getFileBuffer(generation.url);
    return { buffer, contentType, style: generation.style };
  }

  async getStyles() {
    return GENERATION_STYLES;
  }

  /** FREE_LIMIT: first 10 thumbnails are free, then 1 credit = 1 thumbnail */
  private readonly FREE_LIMIT = 10;

  private async deductCredits(userId: string, count: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true, freeCreditsUsed: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const freeLeft = Math.max(0, this.FREE_LIMIT - user.freeCreditsUsed);
    const freeToUse = Math.min(count, freeLeft);
    const paidToUse = count - freeToUse;

    if (paidToUse > 0 && user.credits < paidToUse) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          error: 'Payment Required',
          message: `Niewystarczające kredyty. Potrzebujesz ${paidToUse} kredyt${paidToUse > 1 ? 'ów' : 'u'}, masz ${user.credits}. Doładuj konto na stronie Kredyty.`,
          creditsRequired: paidToUse,
          creditsAvailable: user.credits,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        freeCreditsUsed: { increment: freeToUse },
        credits: { decrement: paidToUse },
      },
    });
  }
}
