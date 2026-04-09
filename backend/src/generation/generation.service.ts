import { Injectable, Logger, NotFoundException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../images/storage.service';
import { GeminiService, GENERATION_STYLES } from './gemini.service';
import * as https from 'https';
import * as http from 'http';
import * as sharp from 'sharp';

/** Max concurrent image generation requests to Gemini */
const MAX_CONCURRENT = 2;
/** Pause between launching batches (ms) */
const BATCH_PAUSE_MS = 2000;
/** Max dimension for images sent to Gemini API (saves tokens & cost) */
const MAX_IMAGE_DIM = 1024;

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

  /**
   * Compress and resize image to save Gemini API tokens (smaller base64 = fewer input tokens = lower cost).
   */
  private async compressImage(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      const image = sharp(buffer);
      const meta = await image.metadata();
      const needsResize = (meta.width && meta.width > MAX_IMAGE_DIM) || (meta.height && meta.height > MAX_IMAGE_DIM);

      let pipeline = needsResize
        ? image.resize(MAX_IMAGE_DIM, MAX_IMAGE_DIM, { fit: 'inside', withoutEnlargement: true })
        : image;

      // Always output as JPEG for smallest size (unless PNG is needed for transparency)
      if (mimeType === 'image/png') {
        pipeline = pipeline.png({ quality: 85, compressionLevel: 9 });
      } else {
        pipeline = pipeline.jpeg({ quality: 85 });
      }

      const compressed = await pipeline.toBuffer();
      const ratio = Math.round(compressed.length / buffer.length * 100);
      this.logger.debug(`Image compressed: ${buffer.length} -> ${compressed.length} bytes (${ratio}%)`);

      // Only use compressed version if it's actually smaller
      if (compressed.length >= buffer.length) {
        this.logger.debug('Compressed image is larger than original, keeping original');
        return { buffer, mimeType };
      }

      return { buffer: compressed, mimeType: mimeType === 'image/png' ? 'image/png' : 'image/jpeg' };
    } catch (err) {
      this.logger.warn('Image compression failed, using original', err);
      return { buffer, mimeType };
    }
  }

  private async processGenerations(originalUrl: string, generationIds: string[], basePrompt?: string) {
    // Fetch and compress the original image once
    const rawBuffer = await this.fetchImageBuffer(originalUrl);
    const rawMimeType = this.detectMimeType(originalUrl);
    const { buffer: imageBuffer, mimeType } = await this.compressImage(rawBuffer, rawMimeType);
    const base64Image = imageBuffer.toString('base64');

    // Generate product description once (cheap model, 1 API call)
    const description = await this.geminiService.generateImageDescription(base64Image, mimeType);

    // Generate ALL style prompts in a single API call (saves 5 calls)
    const styles = generationIds.map((id) => {
      // Look up the style for each generation
      return { genId: id, style: null as any };
    });

    // Map generationId -> style
    const genStyles = new Map<string, any>();
    for (const generationId of generationIds) {
      const generation = await this.prisma.generation.findUnique({ where: { id: generationId } });
      const style = GENERATION_STYLES.find((s) => s.id === generation.style);
      genStyles.set(generationId, style);
    }

    const allStyles = [...genStyles.values()];
    const allPrompts = await this.geminiService.generateAllStylePrompts(description, allStyles, basePrompt);

    // Process in batches of MAX_CONCURRENT with pauses between batches
    for (let i = 0; i < generationIds.length; i += MAX_CONCURRENT) {
      const batch = generationIds.slice(i, i + MAX_CONCURRENT);

      await Promise.all(batch.map(async (generationId) => {
        try {
          await this.prisma.generation.update({
            where: { id: generationId },
            data: { status: 'PROCESSING' },
          });

          const style = genStyles.get(generationId);
          const optimizedPrompt = allPrompts.get(style.id) || style.prompt;

          const generated = await this.geminiService.generateImage(base64Image, mimeType, optimizedPrompt);

          const imageData = Buffer.from(generated.base64, 'base64');
          const { url } = await this.storageService.uploadFile(imageData, `${style.id}.png`, generated.mimeType, 'generated');

          await this.prisma.generation.update({
            where: { id: generationId },
            data: { prompt: optimizedPrompt, status: 'COMPLETED', url },
          });
        } catch (error) {
          this.logger.error(`Failed to process generation ${generationId}`, error);
          await this.prisma.generation.update({
            where: { id: generationId },
            data: { status: 'FAILED' },
          });
          const gen = await this.prisma.generation.findUnique({ where: { id: generationId }, include: { image: true } });
          if (gen) await this.refundCredits(gen.image.userId, 1);
        }
      }));

      // Pause between batches to avoid rate limiting
      if (i + MAX_CONCURRENT < generationIds.length) {
        await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
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
    isRework = false,
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
    this.processCustomGeneration(originalUrlSigned, generation.id, userPrompt, referenceBuffer, referenceMimeType, isRework).catch(
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
    isRework = false,
  ) {
    try {
      await this.prisma.generation.update({
        where: { id: generationId },
        data: { status: 'PROCESSING' },
      });

      const rawOriginalBuffer = await this.fetchImageBuffer(originalUrl);
      const rawOriginalMimeType = this.detectMimeType(originalUrl);
      const { buffer: originalBuffer, mimeType: originalMimeType } = await this.compressImage(rawOriginalBuffer, rawOriginalMimeType);

      // In rework mode the generated thumbnail becomes the primary image;
      // the original product photo is passed as reference for product identity.
      const primaryBase64 = isRework && referenceBuffer
        ? referenceBuffer.toString('base64')
        : originalBuffer.toString('base64');
      const primaryMimeType = isRework && referenceMimeType
        ? referenceMimeType
        : originalMimeType;

      // For description, always use the original product photo
      const descBase64 = originalBuffer.toString('base64');
      const description = await this.geminiService.generateImageDescription(descBase64, originalMimeType);

      const optimizedPrompt = isRework
        ? await this.geminiService.generateReworkPrompt(description, userPrompt)
        : await this.geminiService.generateCustomPrompt(description, userPrompt);

      // In rework mode pass original as reference (for product identity);
      // in normal mode pass the user-uploaded reference (for style).
      const refBase64 = isRework
        ? originalBuffer.toString('base64')
        : referenceBuffer ? referenceBuffer.toString('base64') : undefined;
      const refMime = isRework
        ? originalMimeType
        : referenceMimeType;

      const generated = await this.geminiService.generateImage(
        primaryBase64,
        primaryMimeType,
        optimizedPrompt,
        refBase64,
        refMime,
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
      // Refund 1 credit for this failed generation
      const gen = await this.prisma.generation.findUnique({ where: { id: generationId }, include: { image: true } });
      if (gen) await this.refundCredits(gen.image.userId, 1);
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

  async retryGeneration(generationId: string, userId: string) {
    const generation = await this.prisma.generation.findUnique({
      where: { id: generationId },
      include: { image: true },
    });

    if (!generation) throw new NotFoundException('Generation not found');
    if (generation.image.userId !== userId) throw new ForbiddenException('Access denied');
    if (generation.status !== 'FAILED') {
      throw new HttpException('Only failed generations can be retried', HttpStatus.BAD_REQUEST);
    }

    // Deduct credits again for retry
    await this.deductCredits(userId, 1);

    await this.prisma.generation.update({
      where: { id: generationId },
      data: { status: 'PENDING' },
    });

    const originalUrlSigned = this.storageService.getSignedUrl(generation.image.originalUrl);

    if (generation.style === 'custom') {
      this.processCustomGeneration(
        originalUrlSigned,
        generationId,
        generation.prompt || '',
      ).catch((err) => this.logger.error('Retry custom generation failed', err));
    } else {
      // Re-process single auto style
      this.reprocessSingleGeneration(originalUrlSigned, generationId).catch(
        (err) => this.logger.error('Retry generation failed', err),
      );
    }

    return { message: 'Ponowienie rozpoczęte', generationId };
  }

  private async reprocessSingleGeneration(originalUrl: string, generationId: string) {
    try {
      await this.prisma.generation.update({
        where: { id: generationId },
        data: { status: 'PROCESSING' },
      });

      const generation = await this.prisma.generation.findUnique({ where: { id: generationId } });
      const style = GENERATION_STYLES.find((s) => s.id === generation.style);

      const rawBuffer = await this.fetchImageBuffer(originalUrl);
      const rawMime = this.detectMimeType(originalUrl);
      const { buffer: imageBuffer, mimeType } = await this.compressImage(rawBuffer, rawMime);
      const base64Image = imageBuffer.toString('base64');

      const description = await this.geminiService.generateImageDescription(base64Image, mimeType);
      const optimizedPrompt = await this.geminiService.generatePromptForStyle(description, style);

      const generated = await this.geminiService.generateImage(base64Image, mimeType, optimizedPrompt);

      const imageData = Buffer.from(generated.base64, 'base64');
      const { url } = await this.storageService.uploadFile(imageData, `${style.id}.png`, generated.mimeType, 'generated');

      await this.prisma.generation.update({
        where: { id: generationId },
        data: { prompt: optimizedPrompt, status: 'COMPLETED', url },
      });
    } catch (error) {
      this.logger.error(`Retry generation ${generationId} failed`, error);
      await this.prisma.generation.update({
        where: { id: generationId },
        data: { status: 'FAILED' },
      });
      const gen = await this.prisma.generation.findUnique({ where: { id: generationId }, include: { image: true } });
      if (gen) await this.refundCredits(gen.image.userId, 1);
    }
  }

  /** Refund credits back to user (reverse of deductCredits). */
  private async refundCredits(userId: string, count: number) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { freeCreditsUsed: true },
      });
      if (!user) return;

      // If user still has free credits used, refund to free pool first
      const freeToRefund = Math.min(count, user.freeCreditsUsed);
      const paidToRefund = count - freeToRefund;

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          freeCreditsUsed: { decrement: freeToRefund },
          credits: { increment: paidToRefund },
        },
      });
      this.logger.log(`Refunded ${count} credit(s) to user ${userId} (free: ${freeToRefund}, paid: ${paidToRefund})`);
    } catch (err) {
      this.logger.error(`Failed to refund credits for user ${userId}`, err);
    }
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
