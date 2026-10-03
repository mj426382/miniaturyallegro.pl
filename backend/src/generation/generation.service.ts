import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../images/storage.service';
import { GeminiService } from './gemini.service';
import { CreditsService } from './credits.service';
import { ExportService, ExportOptions } from './export.service';
import { detectMimeTypeFromUrl, prepareForAi } from '../images/image-prep';
import { GENERATION_STYLES, GenerationStyle, getDefaultStyleIds, getStyle } from './styles';

/** Max concurrent image generation requests to Gemini per batch */
const MAX_CONCURRENT = 2;
/** Pause between launching batches (ms) */
const BATCH_PAUSE_MS = 2000;
/** A user may not have more than this many generations in flight (budget guard). */
const MAX_ACTIVE_PER_USER = 30;
/** Generations stuck in PENDING/PROCESSING longer than this are failed and refunded. */
const STALE_GENERATION_MINUTES = 20;
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class GenerationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GenerationService.name);

  /** Short-lived cache of AI-ready (≤1024 px) originals – avoids re-downloading and re-encoding within a session */
  private readonly preparedCache = new Map<string, { base64: string; mimeType: string; expiresAt: number }>();
  private readonly BUFFER_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private readonly BUFFER_CACHE_MAX = 50;

  private reconcileTimer: NodeJS.Timeout | null = null;
  readonly defaultStyleIds: string[];

  constructor(
    private prisma: PrismaService,
    private geminiService: GeminiService,
    private storageService: StorageService,
    private credits: CreditsService,
    private exportService: ExportService,
    configService: ConfigService,
  ) {
    this.defaultStyleIds = getDefaultStyleIds(configService.get<string>('DEFAULT_STYLE_IDS'));
  }

  // ─── Lifecycle: recover from crashes / restarts ───────────────────

  onModuleInit() {
    this.reconcileStaleGenerations().catch((err) => this.logger.error('Initial reconciliation failed', err));
    this.reconcileTimer = setInterval(() => {
      this.reconcileStaleGenerations().catch((err) => this.logger.error('Reconciliation failed', err));
    }, RECONCILE_INTERVAL_MS);
    this.reconcileTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
  }

  /**
   * Generations are processed in-memory; a crash or deploy in the middle leaves
   * rows stuck in PENDING/PROCESSING with the credit already charged. Fail them
   * and give the credit back so the user can retry.
   */
  async reconcileStaleGenerations(): Promise<number> {
    const cutoff = new Date(Date.now() - STALE_GENERATION_MINUTES * 60 * 1000);
    const stale = await this.prisma.generation.findMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] }, updatedAt: { lt: cutoff } },
      select: { id: true, image: { select: { userId: true } } },
      take: 200,
    });

    let refunded = 0;
    for (const gen of stale) {
      // Conditional update: only the instance that flips the row refunds.
      const { count } = await this.prisma.generation.updateMany({
        where: { id: gen.id, status: { in: ['PENDING', 'PROCESSING'] } },
        data: { status: 'FAILED' },
      });
      if (count === 1) {
        await this.credits.refund(gen.image.userId, 1);
        refunded++;
      }
    }
    if (refunded) this.logger.warn(`Reconciled ${refunded} stale generation(s) – credits refunded`);
    return refunded;
  }

  // ─── Public API ───────────────────────────────────────────────────

  getStyles() {
    return {
      styles: GENERATION_STYLES.map(({ id, name, description, starter }) => ({ id, name, description, starter })),
      defaultStyleIds: this.defaultStyleIds,
    };
  }

  async startGeneration(imageId: string, userId: string, options: { styleIds?: string[]; basePrompt?: string } = {}) {
    const image = await this.getOwnedImage(imageId, userId);

    const styleIds = options.styleIds?.length ? options.styleIds : this.defaultStyleIds;
    const styles = styleIds.map((id) => getStyle(id)).filter((s): s is GenerationStyle => Boolean(s));
    if (!styles.length) throw new HttpException('Nie wybrano żadnego stylu', HttpStatus.BAD_REQUEST);

    // Charge, enforce the in-flight cap and create the rows in ONE transaction under the user row lock.
    const { result: generations } = await this.credits.deduct(userId, styles.length, {
      maxActive: MAX_ACTIVE_PER_USER,
      within: async (tx) => {
        const rows: { id: string }[] = [];
        for (const style of styles) {
          rows.push(
            await tx.generation.create({
              data: { imageId, style: style.id, prompt: style.prompt, status: 'PENDING' },
              select: { id: true },
            }),
          );
        }
        return rows;
      },
    });

    const originalUrlSigned = await this.storageService.getSignedUrl(image.originalUrl);
    this.processGenerations(
      image.id,
      originalUrlSigned,
      generations.map((g) => g.id),
      options.basePrompt,
    ).catch((err) => this.logger.error('Generation processing failed', err));

    return {
      message: 'Generation started',
      generationIds: generations.map((g) => g.id),
      styles: styles.map((s) => s.id),
      count: generations.length,
    };
  }

  async startCustomGeneration(
    imageId: string,
    userId: string,
    userPrompt: string,
    referenceBuffer?: Buffer,
    referenceMimeType?: string,
    isRework = false,
  ) {
    const image = await this.getOwnedImage(imageId, userId);
    if (isRework && !referenceBuffer) {
      throw new HttpException(
        'Przeróbka wymaga wcześniej wygenerowanej grafiki jako pliku referencyjnego',
        HttpStatus.BAD_REQUEST,
      );
    }
    const { result: generation } = await this.credits.deduct(userId, 1, {
      maxActive: MAX_ACTIVE_PER_USER,
      within: (tx) =>
        tx.generation.create({
          data: { imageId, style: 'custom', prompt: userPrompt, status: 'PENDING' },
          select: { id: true },
        }),
    });

    const originalUrlSigned = await this.storageService.getSignedUrl(image.originalUrl);
    this.processCustomGeneration(
      image.id,
      originalUrlSigned,
      generation.id,
      userPrompt,
      referenceBuffer,
      referenceMimeType,
      isRework,
    ).catch((err) => this.logger.error('Custom generation failed', err));

    return { generationId: generation.id };
  }

  async getGenerations(imageId: string, userId: string) {
    await this.getOwnedImage(imageId, userId);

    const generations = await this.prisma.generation.findMany({
      where: { imageId },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      generations.map(async (g) => ({
        ...g,
        url: g.url ? await this.storageService.getSignedUrl(g.url) : null,
      })),
    );
  }

  async getGenerationById(id: string, userId: string) {
    const generation = await this.getOwnedGeneration(id, userId);
    return {
      ...generation,
      url: generation.url ? await this.storageService.getSignedUrl(generation.url) : null,
    };
  }

  async getGenerationForDownload(
    id: string,
    userId: string,
  ): Promise<{ buffer: Buffer; contentType: string; style: string }> {
    const generation = await this.getOwnedGeneration(id, userId);
    if (!generation.url) throw new NotFoundException('Generation file not available');

    const { buffer, contentType } = await this.storageService.getFileBuffer(generation.url);
    return { buffer, contentType, style: generation.style || 'custom' };
  }

  async retryGeneration(generationId: string, userId: string) {
    const generation = await this.getOwnedGeneration(generationId, userId);
    if (generation.status !== 'FAILED') {
      throw new HttpException('Ponowić można tylko nieudane generacje', HttpStatus.BAD_REQUEST);
    }

    // Charge and claim the row in one transaction – a double click must not start two retries.
    await this.credits.deduct(userId, 1, {
      maxActive: MAX_ACTIVE_PER_USER,
      within: async (tx) => {
        const { count } = await tx.generation.updateMany({
          where: { id: generationId, status: 'FAILED' },
          data: { status: 'PENDING' },
        });
        if (count !== 1) throw new HttpException('Ta generacja jest już ponawiana', HttpStatus.CONFLICT);
      },
    });

    const originalUrlSigned = await this.storageService.getSignedUrl(generation.image.originalUrl);

    if (generation.style === 'custom') {
      this.processCustomGeneration(generation.imageId, originalUrlSigned, generationId, generation.prompt || '').catch(
        (err) => this.logger.error('Retry custom generation failed', err),
      );
    } else {
      this.processGenerations(generation.imageId, originalUrlSigned, [generationId]).catch((err) =>
        this.logger.error('Retry generation failed', err),
      );
    }

    return { message: 'Ponowienie rozpoczęte', generationId };
  }

  /** Thumbs up/down on a finished graphic – the signal used to tune styles and prompts. */
  async submitFeedback(id: string, userId: string, rating: 1 | -1, reason?: string, comment?: string) {
    const generation = await this.getOwnedGeneration(id, userId);
    if (generation.status !== 'COMPLETED') {
      throw new HttpException('Ocenić można tylko ukończone generacje', HttpStatus.BAD_REQUEST);
    }
    const ratingReason = rating === -1 ? [reason, comment].filter(Boolean).join(': ') || 'other' : null;
    await this.prisma.generation.update({ where: { id }, data: { rating, ratingReason } });
    return { id, rating, ratingReason };
  }

  /** Aggregated feedback per style – for the owner to see which styles under-deliver. */
  async getFeedbackStats() {
    const rows = await this.prisma.generation.groupBy({
      by: ['style', 'rating'],
      where: { rating: { not: null } },
      _count: { _all: true },
    });
    const stats = new Map<string, { up: number; down: number }>();
    for (const row of rows) {
      const entry = stats.get(row.style || 'custom') ?? { up: 0, down: 0 };
      if (row.rating === 1) entry.up += row._count._all;
      else entry.down += row._count._all;
      stats.set(row.style || 'custom', entry);
    }
    return [...stats.entries()].map(([style, counts]) => ({ style, ...counts }));
  }

  /** Marketplace-ready export (ratio / size / promo badge) of a finished graphic. */
  async exportGeneration(id: string, userId: string, options: ExportOptions) {
    const generation = await this.getOwnedGeneration(id, userId);
    if (!generation.url) throw new NotFoundException('Generation file not available');
    const { buffer } = await this.storageService.getFileBuffer(generation.url);
    const exported = await this.exportService.exportImage(buffer, options);
    return { ...exported, style: generation.style || 'custom' };
  }

  // ─── Processing pipeline ──────────────────────────────────────────

  private async processGenerations(imageId: string, originalUrl: string, generationIds: string[], basePrompt?: string) {
    let base64Image: string;
    let mimeType: string;
    let description: string;
    try {
      const prepared = await this.prepareOriginal(originalUrl);
      base64Image = prepared.base64;
      mimeType = prepared.mimeType;
      description = await this.getOrCreateDescription(imageId, base64Image, mimeType);
    } catch (error) {
      this.logger.error('Failed to prepare image/description – failing whole batch', error);
      await Promise.all(generationIds.map((id) => this.failGeneration(id)));
      return;
    }

    const generations = await this.prisma.generation.findMany({ where: { id: { in: generationIds } } });
    const genStyles = new Map<string, GenerationStyle>();
    for (const gen of generations) {
      const style = getStyle(gen.style || '');
      if (style) genStyles.set(gen.id, style);
      else await this.failGeneration(gen.id);
    }

    const uniqueStyles = [...new Map([...genStyles.values()].map((s) => [s.id, s])).values()];
    let allPrompts: Map<string, string>;
    try {
      allPrompts = await this.geminiService.generateAllStylePrompts(description, uniqueStyles, basePrompt);
    } catch (error) {
      this.logger.warn('Prompt generation failed – falling back to base style prompts', error);
      allPrompts = new Map(uniqueStyles.map((s) => [s.id, s.prompt]));
    }

    const ids = [...genStyles.keys()];
    for (let i = 0; i < ids.length; i += MAX_CONCURRENT) {
      const batch = ids.slice(i, i + MAX_CONCURRENT);

      await Promise.all(
        batch.map(async (generationId) => {
          const style = genStyles.get(generationId)!;
          const optimizedPrompt = allPrompts.get(style.id) || style.prompt;
          try {
            if (!(await this.claimForProcessing(generationId))) return;
            const generated = await this.geminiService.generateImage(base64Image, mimeType, optimizedPrompt);
            const url = await this.storeGenerated(generated.base64, generated.mimeType, `${style.id}.png`);
            await this.prisma.generation.update({
              where: { id: generationId },
              data: { prompt: optimizedPrompt, status: 'COMPLETED', url },
            });
          } catch (error) {
            this.logger.error(`Failed to process generation ${generationId}`, error);
            await this.failGeneration(generationId);
          }
        }),
      );

      if (i + MAX_CONCURRENT < ids.length) {
        await sleep(BATCH_PAUSE_MS);
      }
    }
  }

  private async processCustomGeneration(
    imageId: string,
    originalUrl: string,
    generationId: string,
    userPrompt: string,
    referenceBuffer?: Buffer,
    referenceMimeType?: string,
    isRework = false,
  ) {
    try {
      if (!(await this.claimForProcessing(generationId))) return;

      const original = await this.prepareOriginal(originalUrl);
      const description = await this.getOrCreateDescription(imageId, original.base64, original.mimeType);

      // Reference uploads are user-controlled – compress & validate them like the original.
      let reference: { base64: string; mimeType: string } | undefined;
      if (referenceBuffer && referenceMimeType) {
        const compressed = await prepareForAi(referenceBuffer, referenceMimeType);
        reference = { base64: compressed.buffer.toString('base64'), mimeType: compressed.mimeType };
      }

      // Rework: the previously generated graphic is edited; the original photo is the identity reference.
      const primary = isRework && reference ? reference : original;
      const ref = isRework ? original : reference;

      const optimizedPrompt = isRework
        ? await this.geminiService.generateReworkPrompt(description, userPrompt)
        : await this.geminiService.generateCustomPrompt(description, userPrompt);

      const generated = await this.geminiService.generateImage(
        primary.base64,
        primary.mimeType,
        optimizedPrompt,
        ref?.base64,
        ref?.mimeType,
      );

      const url = await this.storeGenerated(generated.base64, generated.mimeType, 'custom.png');
      await this.prisma.generation.update({
        where: { id: generationId },
        data: { prompt: optimizedPrompt, status: 'COMPLETED', url },
      });
    } catch (error) {
      this.logger.error(`Custom generation ${generationId} failed`, error);
      await this.failGeneration(generationId);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private async getOwnedImage(imageId: string, userId: string) {
    const image = await this.prisma.image.findUnique({ where: { id: imageId } });
    if (!image) throw new NotFoundException('Image not found');
    if (image.userId !== userId) throw new ForbiddenException('Access denied');
    return image;
  }

  private async getOwnedGeneration(id: string, userId: string) {
    const generation = await this.prisma.generation.findUnique({ where: { id }, include: { image: true } });
    if (!generation) throw new NotFoundException('Generation not found');
    if (generation.image.userId !== userId) throw new ForbiddenException('Access denied');
    return generation;
  }

  /**
   * PENDING → PROCESSING, but only if the row is still PENDING. If the reconciler already
   * failed and refunded it (e.g. after a very long queue), we must not process it again.
   */
  private async claimForProcessing(generationId: string): Promise<boolean> {
    const { count } = await this.prisma.generation.updateMany({
      where: { id: generationId, status: 'PENDING' },
      data: { status: 'PROCESSING' },
    });
    if (count !== 1) this.logger.warn(`Generation ${generationId} is no longer PENDING – skipping`);
    return count === 1;
  }

  /** Marks a generation FAILED and refunds exactly once (conditional update). */
  private async failGeneration(generationId: string) {
    const { count } = await this.prisma.generation.updateMany({
      where: { id: generationId, status: { in: ['PENDING', 'PROCESSING'] } },
      data: { status: 'FAILED' },
    });
    if (count !== 1) return;
    const gen = await this.prisma.generation.findUnique({
      where: { id: generationId },
      select: { image: { select: { userId: true } } },
    });
    if (gen) await this.credits.refund(gen.image.userId, 1);
  }

  /** The product description is generated once per uploaded image and reused. */
  private async getOrCreateDescription(imageId: string, base64: string, mimeType: string): Promise<string> {
    const image = await this.prisma.image.findUnique({ where: { id: imageId }, select: { description: true } });
    if (image?.description) return image.description;

    const description = await this.geminiService.generateImageDescription(base64, mimeType);
    await this.prisma.image.update({ where: { id: imageId }, data: { description } }).catch(() => undefined);
    return description;
  }

  private async prepareOriginal(originalUrl: string): Promise<{ base64: string; mimeType: string }> {
    // Strip the signature so the cache key is stable per file.
    const cacheKey = originalUrl.split('?')[0];
    const now = Date.now();
    const cached = this.preparedCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return { base64: cached.base64, mimeType: cached.mimeType };
    }

    const rawBuffer = originalUrl.startsWith('http')
      ? await fetchBufferFromUrl(originalUrl)
      : (await this.storageService.getFileBuffer(originalUrl)).buffer;
    const { buffer, mimeType } = await prepareForAi(rawBuffer, detectMimeTypeFromUrl(originalUrl));
    const prepared = { base64: buffer.toString('base64'), mimeType, expiresAt: now + this.BUFFER_TTL_MS };

    for (const [key, entry] of this.preparedCache) {
      if (entry.expiresAt <= now) this.preparedCache.delete(key);
    }
    if (this.preparedCache.size >= this.BUFFER_CACHE_MAX) {
      const oldest = this.preparedCache.keys().next().value;
      if (oldest) this.preparedCache.delete(oldest);
    }
    this.preparedCache.set(cacheKey, prepared);
    return { base64: prepared.base64, mimeType: prepared.mimeType };
  }

  private async storeGenerated(base64: string, mimeType: string, name: string): Promise<string> {
    const imageData = Buffer.from(base64, 'base64');
    const { url } = await this.storageService.uploadFile(imageData, name, mimeType, 'generated');
    return url;
  }
}

function fetchBufferFromUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        response.resume();
        return reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
      }
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    req.setTimeout(30_000, () => req.destroy(new Error('Image download timed out')));
    req.on('error', reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
