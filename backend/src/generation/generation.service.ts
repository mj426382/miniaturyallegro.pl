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
import sharp from 'sharp';
import * as http from 'http';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../images/storage.service';
import { GeminiService, fallbackCustomPrompt, fallbackReworkPrompt } from './gemini.service';
import { CreditsService, poolsOf } from './credits.service';
import { ExportService, ExportOptions } from './export.service';
import { InfographicOptions, InfographicService } from './infographic.service';
import { detectMimeTypeFromUrl, prepareForAi } from '../images/image-prep';
import { GENERATION_STYLES, GenerationStyle, getDefaultStyleIds, getStyle, isInSeason } from './styles';
import { toUserGeneration } from './generation-response';
import { withAiDisclosure } from './ai-disclosure';

/** Max concurrent image generation requests to Gemini per batch */
const MAX_CONCURRENT = 2;
/** Pause between launching batches (ms) */
const BATCH_PAUSE_MS = 2000;
/** A user may not have more than this many generations in flight (budget guard). */
const MAX_ACTIVE_PER_USER = 30;
/** Generations stuck in PENDING/PROCESSING longer than this are failed and refunded. */
const STALE_GENERATION_MINUTES = 20;
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;
/** Storage folder of custom-style / rework reference images (spec 05, AC-GEN-028). */
const REFERENCE_FOLDER = 'references';

type PreparedReference = { buffer: Buffer; mimeType: string };

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

/** Short reason for the log line – the pino logger drops a second Error argument, so the cause must be in the message. */
function errorReason(error: unknown): string {
  return String((error as Error)?.message ?? error).slice(0, 300);
}

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
    private infographicService: InfographicService,
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
      // Conditional flip + refund to the charged pool in one transaction: only one caller refunds.
      if (await this.credits.failGeneration(gen.image.userId, gen.id)) refunded++;
    }
    if (refunded) this.logger.warn(`Reconciled ${refunded} stale generation(s) – credits refunded`);
    return refunded;
  }

  // ─── Public API ───────────────────────────────────────────────────

  getStyles() {
    return {
      styles: GENERATION_STYLES.map(({ id, name, description, starter, category, season }) => ({
        id,
        name,
        description,
        starter,
        category,
        inSeason: isInSeason({ season }),
      })),
      defaultStyleIds: this.defaultStyleIds,
    };
  }

  async startGeneration(imageId: string, userId: string, options: { styleIds?: string[]; basePrompt?: string } = {}) {
    const image = await this.getOwnedImage(imageId, userId);

    const styleIds = options.styleIds?.length ? options.styleIds : this.defaultStyleIds;
    const styles = styleIds.map((id) => getStyle(id)).filter((s): s is GenerationStyle => Boolean(s));
    if (!styles.length) throw new HttpException('Nie wybrano żadnego stylu', HttpStatus.BAD_REQUEST);

    // Charge, enforce the in-flight cap and create the rows in ONE transaction under the user row lock.
    // Each row records the pool of its credit (free ones first), so a failure refunds the right pool.
    const { result: generations } = await this.credits.deduct(userId, styles.length, {
      maxActive: MAX_ACTIVE_PER_USER,
      within: async (tx, charge) => {
        const pools = poolsOf(charge, styles.length);
        const rows: { id: string }[] = [];
        for (const [i, style] of styles.entries()) {
          rows.push(
            await tx.generation.create({
              data: { imageId, style: style.id, prompt: style.prompt, status: 'PENDING', creditPool: pools[i] },
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
    // Spec 05, AC-GEN-028: the reference is stored (compressed like for the AI) with the generation, so a
    // retry uses the same reference. Uploaded before the charge; removed again when the charge fails.
    let reference: PreparedReference | undefined;
    let referenceKey: string | null = null;
    if (referenceBuffer && referenceMimeType) {
      const compressed = await prepareForAi(referenceBuffer, referenceMimeType);
      reference = { buffer: compressed.buffer, mimeType: compressed.mimeType };
      const stored = await this.storageService.uploadFile(
        compressed.buffer,
        `reference${extensionFor(compressed.mimeType)}`,
        compressed.mimeType,
        REFERENCE_FOLDER,
      );
      referenceKey = stored.url;
    }

    let generation: { id: string };
    try {
      const deduction = await this.credits.deduct(userId, 1, {
        maxActive: MAX_ACTIVE_PER_USER,
        within: (tx, charge) =>
          tx.generation.create({
            data: {
              imageId,
              style: 'custom',
              prompt: userPrompt,
              status: 'PENDING',
              creditPool: poolsOf(charge, 1)[0],
              referenceKey,
              isRework,
            },
            select: { id: true },
          }),
      });
      generation = deduction.result;
    } catch (err) {
      if (referenceKey) await this.deleteQuietly(referenceKey, 'unused reference');
      throw err;
    }

    const originalUrlSigned = await this.storageService.getSignedUrl(image.originalUrl);
    this.processCustomGeneration(
      image.id,
      originalUrlSigned,
      generation.id,
      userPrompt,
      isRework,
      async () => reference,
    ).catch((err) => this.logger.error('Custom generation failed', err));

    return { generationId: generation.id };
  }

  async getGenerations(imageId: string, userId: string) {
    await this.getOwnedImage(imageId, userId);

    const generations = await this.prisma.generation.findMany({
      where: { imageId },
      orderBy: { createdAt: 'asc' },
    });

    // NFR-SEC-011: no internal prompt in user responses.
    return Promise.all(
      generations.map(async (g) => ({
        ...toUserGeneration(g),
        url: g.url ? await this.storageService.getSignedUrl(g.url) : null,
      })),
    );
  }

  async getGenerationById(id: string, userId: string) {
    const generation = await this.getOwnedGeneration(id, userId);
    // NFR-SEC-011: neither the prompt nor the joined image (with its AI description) leaves the API.
    return {
      ...toUserGeneration(generation),
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
    // Spec 06, AC-EXP-024: the stored AI graphic is served with the IPTC AI-composite marker.
    return { buffer: await withAiDisclosure(buffer), contentType, style: generation.style || 'custom' };
  }

  async retryGeneration(generationId: string, userId: string) {
    const generation = await this.getOwnedGeneration(generationId, userId);
    if (generation.status !== 'FAILED') {
      throw new HttpException('Ponowić można tylko nieudane generacje', HttpStatus.BAD_REQUEST);
    }

    // Charge and claim the row in one transaction – a double click must not start two retries.
    // The new charge may come from another pool than the first one – record it (AC-GEN-027).
    await this.credits.deduct(userId, 1, {
      maxActive: MAX_ACTIVE_PER_USER,
      within: async (tx, charge) => {
        const { count } = await tx.generation.updateMany({
          where: { id: generationId, status: 'FAILED' },
          data: { status: 'PENDING', creditPool: poolsOf(charge, 1)[0] },
        });
        if (count !== 1) throw new HttpException('Ta generacja jest już ponawiana', HttpStatus.CONFLICT);
      },
    });

    const originalUrlSigned = await this.storageService.getSignedUrl(generation.image.originalUrl);

    if (generation.style === 'custom') {
      // AC-GEN-028: the same reference and mode as the first attempt (the stored file is read again).
      const referenceKey = generation.referenceKey;
      const loadReference = async (): Promise<PreparedReference | undefined> => {
        if (!referenceKey) return undefined;
        const { buffer, contentType } = await this.storageService.getFileBuffer(referenceKey);
        return {
          buffer,
          mimeType: contentType.startsWith('image/') ? contentType : detectMimeTypeFromUrl(referenceKey),
        };
      };
      this.processCustomGeneration(
        generation.imageId,
        originalUrlSigned,
        generationId,
        generation.prompt || '',
        generation.isRework,
        loadReference,
      ).catch((err) => this.logger.error('Retry custom generation failed', err));
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
    // Spec 06, AC-EXP-022: the file declares itself as an AI composite (IPTC DigitalSourceType).
    const exported = await this.exportService.exportImage(buffer, options, 'ai-composite');
    return { ...exported, style: generation.style || 'custom' };
  }

  /**
   * The user's own photo, only framed and converted for a platform (spec 08, AC-PLT-009) – for platforms
   * that want the seller's real photo (Vinted). No AI, no badge, no tone correction; the phone's EXIF
   * orientation is applied first so the crop matches what the browser shows.
   */
  async exportOriginal(imageId: string, userId: string, options: ExportOptions) {
    if (options.badgeText?.trim() || options.adjust) {
      throw new HttpException(
        'Oryginalne zdjęcie eksportujesz tylko z kadrem, obrotem i formatem – bez plakietki i korekty',
        HttpStatus.BAD_REQUEST,
      );
    }
    const image = await this.getOwnedImage(imageId, userId);
    const { buffer } = await this.storageService.getFileBuffer(image.originalUrl);
    const oriented = await sharp(buffer, { limitInputPixels: 40_000_000 }).rotate().toBuffer();
    // AC-EXP-023: the seller's own photo – no AI disclosure and no metadata at all.
    return this.exportService.exportImage(oriented, options, 'original-photo');
  }

  /** Free infographic for an additional offer photo (spec 14) – rendered, never stored. */
  async renderInfographic(id: string, userId: string, options: InfographicOptions) {
    const generation = await this.getOwnedGeneration(id, userId);
    if (generation.status !== 'COMPLETED' || !generation.url) {
      throw new HttpException('Grafika nie jest jeszcze gotowa', HttpStatus.BAD_REQUEST);
    }
    const { buffer } = await this.storageService.getFileBuffer(generation.url);
    const rendered = await this.infographicService.render(buffer, options);
    // AC-EXP-024: an infographic is built on an AI graphic – same disclosure as the export.
    return { ...rendered, buffer: await withAiDisclosure(rendered.buffer), style: generation.style || 'custom' };
  }

  // ─── Processing pipeline ──────────────────────────────────────────

  private async processGenerations(imageId: string, originalUrl: string, generationIds: string[], basePrompt?: string) {
    let base64Image: string;
    let mimeType: string;
    try {
      const prepared = await this.prepareOriginal(originalUrl);
      base64Image = prepared.base64;
      mimeType = prepared.mimeType;
    } catch (error) {
      this.logger.error(`Failed to prepare the original image – failing whole batch: ${errorReason(error)}`);
      await Promise.all(generationIds.map((id) => this.failGeneration(id)));
      return;
    }
    // AC-GEN-007: without the text model (e.g. no OpenAI credits) the graphics are still made from the base prompts.
    const description = await this.tryGetDescription(imageId, base64Image, mimeType);

    const generations = await this.prisma.generation.findMany({ where: { id: { in: generationIds } } });
    const genStyles = new Map<string, GenerationStyle>();
    for (const gen of generations) {
      const style = getStyle(gen.style || '');
      if (style) genStyles.set(gen.id, style);
      else await this.failGeneration(gen.id);
    }

    const uniqueStyles = [...new Map([...genStyles.values()].map((s) => [s.id, s])).values()];
    let allPrompts = new Map(uniqueStyles.map((s) => [s.id, s.prompt]));
    if (description !== null) {
      try {
        allPrompts = await this.geminiService.generateAllStylePrompts(description, uniqueStyles, basePrompt);
      } catch (error) {
        this.logger.warn('Prompt generation failed – falling back to base style prompts', error);
      }
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
            await this.completeGeneration(generationId, optimizedPrompt, url);
          } catch (error) {
            this.logger.error(`Failed to process generation ${generationId}: ${errorReason(error)}`);
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
    isRework: boolean,
    loadReference: () => Promise<PreparedReference | undefined>,
  ) {
    try {
      if (!(await this.claimForProcessing(generationId))) return;

      const original = await this.prepareOriginal(originalUrl);
      const description = await this.tryGetDescription(imageId, original.base64, original.mimeType);

      // Reference uploads are user-controlled – compressed & validated like the original before storing.
      const loaded = await loadReference();
      const reference = loaded ? { base64: loaded.buffer.toString('base64'), mimeType: loaded.mimeType } : undefined;
      if (isRework && !reference) throw new Error('Rework reference image is missing');

      // Rework: the previously generated graphic is edited; the original photo is the identity reference.
      const primary = isRework && reference ? reference : original;
      const ref = isRework ? original : reference;

      const optimizedPrompt = await this.customPrompt(description, userPrompt, isRework);

      const generated = await this.geminiService.generateImage(
        primary.base64,
        primary.mimeType,
        optimizedPrompt,
        ref?.base64,
        ref?.mimeType,
      );

      const url = await this.storeGenerated(generated.base64, generated.mimeType, 'custom.png');
      await this.completeGeneration(generationId, optimizedPrompt, url);
    } catch (error) {
      this.logger.error(`Custom generation ${generationId} failed: ${errorReason(error)}`);
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

  /**
   * PROCESSING → COMPLETED only if the row is still being processed. When the reconciler has already
   * failed and refunded it (a very slow AI call) or the photo/account was deleted meanwhile, the
   * result is discarded – the user must not keep both the graphic and the refund, and the file must
   * not be orphaned in storage (spec 05, AC-GEN-025).
   */
  private async completeGeneration(generationId: string, prompt: string, url: string) {
    const row = await this.prisma.generation.findUnique({
      where: { id: generationId },
      select: { referenceKey: true },
    });
    const { count } = await this.prisma.generation.updateMany({
      where: { id: generationId, status: 'PROCESSING' },
      data: { prompt, status: 'COMPLETED', url, referenceKey: null },
    });
    if (count === 1) {
      // A finished graphic is never retried – its reference is no longer needed (data minimisation).
      if (row?.referenceKey) await this.deleteQuietly(row.referenceKey, `reference of ${generationId}`);
      return;
    }
    this.logger.warn(`Generation ${generationId} finished after it was failed or deleted – result discarded`);
    await this.storageService
      .deleteFile(url)
      .catch((err) => this.logger.error(`Could not delete discarded result of ${generationId}`, err));
  }

  /** Marks a generation FAILED and refunds exactly once, to the pool it was charged from (AC-GEN-027). */
  private async failGeneration(generationId: string) {
    const gen = await this.prisma.generation.findUnique({
      where: { id: generationId },
      select: { image: { select: { userId: true } } },
    });
    if (gen) await this.credits.failGeneration(gen.image.userId, generationId);
  }

  private async deleteQuietly(key: string, what: string) {
    await this.storageService.deleteFile(key).catch((err) => this.logger.error(`Could not delete ${what}`, err));
  }

  /** AC-GEN-007/031: the description, or null when the text model is unavailable (nothing is cached then). */
  private async tryGetDescription(imageId: string, base64: string, mimeType: string): Promise<string | null> {
    try {
      return await this.getOrCreateDescription(imageId, base64, mimeType);
    } catch (error) {
      this.logger.warn(`Product analysis for image ${imageId} failed – generating from the fallback prompts`, error);
      return null;
    }
  }

  /** AC-GEN-031: the optimised custom/rework prompt, or a fixed English wrapper of the user's text. */
  private async customPrompt(description: string | null, userPrompt: string, isRework: boolean): Promise<string> {
    if (description !== null) {
      try {
        return isRework
          ? await this.geminiService.generateReworkPrompt(description, userPrompt)
          : await this.geminiService.generateCustomPrompt(description, userPrompt);
      } catch (error) {
        this.logger.warn('Custom prompt optimisation failed – using the fallback prompt', error);
      }
    }
    return isRework ? fallbackReworkPrompt(userPrompt) : fallbackCustomPrompt(userPrompt);
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
