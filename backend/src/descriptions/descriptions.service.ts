import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from '../generation/credits.service';
import { GeminiService, OfferCopy } from '../generation/gemini.service';
import { clampTitle, normalizeKeywords, sanitizeAllegroHtml } from './allegro-html';
import { CreateDescriptionDto, RefineDescriptionDto, UpdateDescriptionDto } from './descriptions.dto';

/**
 * Pricing: the first description of a photo is a free bonus to its graphics. Every AI call on it
 * (rewrite by prompt, "write again") spends one prompt edit; FREE_PROMPT_EDITS come with the photo,
 * further packs of EDIT_PACK_SIZE cost EDIT_PACK_CREDITS. Manual edits are unlimited.
 */
export const DEFAULT_FREE_PROMPT_EDITS = 5;
export const EDIT_PACK_SIZE = 15;
export const EDIT_PACK_CREDITS = 1;

export interface DescriptionView {
  description: {
    title: string;
    body: string;
    keywords: string[];
    sellerNotes: string | null;
    promptEditsUsed: number;
    updatedAt: Date;
  } | null;
  /** Free edits + purchased packs. */
  promptEditsLimit: number;
  promptEditsLeft: number;
  /** A description can be written only for a photo that already has a finished graphic. */
  canCreate: boolean;
  /** Credits charged for the first description (0 – it is a bonus). */
  creditCost: number;
  editPackSize: number;
  editPackCredits: number;
}

@Injectable()
export class DescriptionsService {
  private readonly logger = new Logger(DescriptionsService.name);
  readonly freePromptEdits: number;

  constructor(
    private prisma: PrismaService,
    private credits: CreditsService,
    private gemini: GeminiService,
    config: ConfigService,
  ) {
    const configured = Number(config.get<string>('DESCRIPTION_PROMPT_EDITS'));
    this.freePromptEdits = Number.isInteger(configured) && configured >= 0 ? configured : DEFAULT_FREE_PROMPT_EDITS;
  }

  async get(imageId: string, userId: string): Promise<DescriptionView> {
    const image = await this.getOwnedImage(imageId, userId);
    return this.view(image.id, await this.hasCompletedGeneration(image.id));
  }

  async create(imageId: string, userId: string, dto: CreateDescriptionDto): Promise<DescriptionView> {
    const image = await this.getOwnedImage(imageId, userId);
    if (!(await this.hasCompletedGeneration(image.id))) {
      throw new ConflictException(
        'Najpierw wygeneruj co najmniej jedną grafikę dla tego zdjęcia – opis powstaje na jej podstawie.',
      );
    }
    const notes = dto.notes?.trim() || null;
    const existing = await this.prisma.offerDescription.findUnique({ where: { imageId: image.id } });

    // Writing again from scratch is an AI call like any other rewrite – it spends one prompt edit.
    if (existing) await this.reserveEdit(image.id);

    let copy: OfferCopy;
    try {
      copy = await this.gemini.generateOfferCopy({ productAnalysis: image.description, sellerNotes: notes });
    } catch (error) {
      this.logger.error(`Offer copy generation failed for image ${image.id}`, error);
      if (existing) await this.releaseEdit(image.id);
      throw new ServiceUnavailableException('Nie udało się wygenerować opisu. Spróbuj ponownie za chwilę.');
    }

    const data = this.clean(copy);
    await this.prisma.offerDescription.upsert({
      where: { imageId: image.id },
      create: { imageId: image.id, ...data, sellerNotes: notes },
      update: { ...data, sellerNotes: notes },
    });
    return this.view(image.id, true);
  }

  async update(imageId: string, userId: string, dto: UpdateDescriptionDto): Promise<DescriptionView> {
    const image = await this.getOwnedImage(imageId, userId);
    const existing = await this.prisma.offerDescription.findUnique({ where: { imageId: image.id } });
    if (!existing) throw new NotFoundException('Ten obrazek nie ma jeszcze opisu');

    const body = sanitizeAllegroHtml(dto.body);
    if (body.replace(/<[^>]+>/g, '').trim().length < 20) {
      throw new HttpException('Opis jest za krótki', HttpStatus.BAD_REQUEST);
    }
    await this.prisma.offerDescription.update({
      where: { imageId: image.id },
      data: {
        title: clampTitle(dto.title),
        body,
        ...(dto.keywords ? { keywords: normalizeKeywords(dto.keywords) } : {}),
      },
    });
    return this.view(image.id, true);
  }

  async refine(imageId: string, userId: string, dto: RefineDescriptionDto): Promise<DescriptionView> {
    const image = await this.getOwnedImage(imageId, userId);
    const existing = await this.prisma.offerDescription.findUnique({ where: { imageId: image.id } });
    if (!existing) throw new NotFoundException('Ten obrazek nie ma jeszcze opisu');

    await this.reserveEdit(image.id);

    let copy: OfferCopy;
    try {
      copy = await this.gemini.generateOfferCopy({
        productAnalysis: image.description,
        sellerNotes: existing.sellerNotes,
        current: { title: existing.title, body: existing.body, keywords: existing.keywords },
        instruction: dto.instruction,
      });
    } catch (error) {
      this.logger.error(`Offer copy refinement failed for image ${image.id}`, error);
      await this.releaseEdit(image.id);
      throw new ServiceUnavailableException(
        'Nie udało się poprawić opisu. Poprawka nie została policzona – spróbuj ponownie.',
      );
    }

    await this.prisma.offerDescription.update({ where: { imageId: image.id }, data: this.clean(copy) });
    return this.view(image.id, true);
  }

  /** Buys one pack of prompt edits for this photo – charged like a graphic, inside the credit transaction. */
  async buyEditPack(imageId: string, userId: string): Promise<DescriptionView> {
    const image = await this.getOwnedImage(imageId, userId);
    const existing = await this.prisma.offerDescription.findUnique({ where: { imageId: image.id } });
    if (!existing) throw new NotFoundException('Ten obrazek nie ma jeszcze opisu');

    await this.credits.deduct(userId, EDIT_PACK_CREDITS, {
      within: (tx) =>
        tx.offerDescription.update({
          where: { imageId: image.id },
          data: { promptEditsPurchased: { increment: EDIT_PACK_SIZE } },
        }),
    });
    return this.view(image.id, true);
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  /** Atomically takes one prompt edit; concurrent clicks cannot exceed free + purchased. */
  private async reserveEdit(imageId: string): Promise<void> {
    const count = await this.prisma.$executeRaw`
      UPDATE "offer_descriptions"
      SET "promptEditsUsed" = "promptEditsUsed" + 1
      WHERE "imageId" = ${imageId} AND "promptEditsUsed" < ${this.freePromptEdits} + "promptEditsPurchased"`;
    if (count !== 1) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          error: 'Payment Required',
          message: `Wykorzystano wszystkie poprawki promptem dla tego zdjęcia. Dokup pakiet ${EDIT_PACK_SIZE} poprawek za ${EDIT_PACK_CREDITS} kredyt albo edytuj opis ręcznie.`,
          code: 'EDIT_PACK_REQUIRED',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  private async releaseEdit(imageId: string): Promise<void> {
    await this.prisma.offerDescription.updateMany({
      where: { imageId, promptEditsUsed: { gt: 0 } },
      data: { promptEditsUsed: { decrement: 1 } },
    });
  }

  private clean(copy: OfferCopy) {
    const body = sanitizeAllegroHtml(copy.body);
    const title = clampTitle(copy.title);
    if (!title || body.replace(/<[^>]+>/g, '').trim().length < 20) {
      throw new Error('Model returned an empty or malformed offer copy');
    }
    return { title, body, keywords: normalizeKeywords(copy.keywords) };
  }

  private async view(imageId: string, canCreate: boolean): Promise<DescriptionView> {
    const row = await this.prisma.offerDescription.findUnique({ where: { imageId } });
    const used = row?.promptEditsUsed ?? 0;
    const limit = this.freePromptEdits + (row?.promptEditsPurchased ?? 0);
    return {
      description: row
        ? {
            title: row.title,
            body: row.body,
            keywords: row.keywords,
            sellerNotes: row.sellerNotes,
            promptEditsUsed: used,
            updatedAt: row.updatedAt,
          }
        : null,
      promptEditsLimit: limit,
      promptEditsLeft: Math.max(0, limit - used),
      canCreate,
      creditCost: 0,
      editPackSize: EDIT_PACK_SIZE,
      editPackCredits: EDIT_PACK_CREDITS,
    };
  }

  private async hasCompletedGeneration(imageId: string): Promise<boolean> {
    const count = await this.prisma.generation.count({ where: { imageId, status: 'COMPLETED' } });
    return count > 0;
  }

  private async getOwnedImage(imageId: string, userId: string) {
    const image = await this.prisma.image.findUnique({ where: { id: imageId } });
    if (!image) throw new NotFoundException('Image not found');
    if (image.userId !== userId) throw new ForbiddenException('Access denied');
    return image;
  }
}
