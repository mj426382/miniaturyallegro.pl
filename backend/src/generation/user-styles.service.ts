import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../images/storage.service';
import { prepareForAi } from '../images/image-prep';
import { extensionFor } from './generation.service';
import { MAX_USER_STYLES } from './user-styles.dto';

/** Spec 27: storage folder of the saved styles' reference photos. */
export const USER_STYLE_FOLDER = 'user-styles';

export interface UserStyleView {
  id: string;
  name: string;
  prompt: string;
  referenceUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type StyleRow = {
  id: string;
  name: string;
  prompt: string;
  referenceKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type Reference = { buffer: Buffer; mimeType: string };

const sameName = (a: string, b: string) => a.toLocaleLowerCase('pl-PL') === b.toLocaleLowerCase('pl-PL');

/** Saved user styles (spec 27): CRUD + their reference photos; generating from one lives in GenerationService. */
@Injectable()
export class UserStylesService {
  private readonly logger = new Logger(UserStylesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(userId: string): Promise<UserStyleView[]> {
    const rows = await this.prisma.userStyle.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return Promise.all(rows.map((r) => this.view(r)));
  }

  async create(userId: string, input: { name: string; prompt: string }, reference?: Reference): Promise<UserStyleView> {
    const existing = await this.prisma.userStyle.findMany({ where: { userId }, select: { name: true } });
    // AC-UST-003: checked before any file is stored.
    if (existing.length >= MAX_USER_STYLES) {
      throw new ConflictException(`Możesz mieć najwyżej ${MAX_USER_STYLES} stylów – usuń któryś, aby dodać nowy.`);
    }
    if (existing.some((s) => sameName(s.name, input.name))) throw new ConflictException('Masz już styl o tej nazwie.');

    const referenceKey = reference ? await this.storeReference(reference) : null;
    try {
      const row = await this.prisma.userStyle.create({
        data: { userId, name: input.name, prompt: input.prompt, referenceKey },
      });
      return this.view(row);
    } catch (err) {
      if (referenceKey) await this.deleteQuietly(referenceKey);
      throw err;
    }
  }

  async update(
    userId: string,
    id: string,
    input: { name?: string; prompt?: string; removeReference?: boolean },
    reference?: Reference,
  ): Promise<UserStyleView> {
    const style = await this.owned(userId, id);
    if (input.name !== undefined) {
      const others = await this.prisma.userStyle.findMany({ where: { userId, NOT: { id } }, select: { name: true } });
      if (others.some((s) => sameName(s.name, input.name!))) throw new ConflictException('Masz już styl o tej nazwie.');
    }

    let referenceKey = style.referenceKey;
    if (reference) referenceKey = await this.storeReference(reference);
    else if (input.removeReference) referenceKey = null;

    let row: StyleRow;
    try {
      row = await this.prisma.userStyle.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.prompt !== undefined ? { prompt: input.prompt } : {}),
          referenceKey,
        },
      });
    } catch (err) {
      if (reference && referenceKey) await this.deleteQuietly(referenceKey);
      throw err;
    }
    // AC-UST-004: the replaced or removed photo leaves the storage.
    if (style.referenceKey && style.referenceKey !== referenceKey) await this.deleteQuietly(style.referenceKey);
    return this.view(row);
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    const style = await this.owned(userId, id);
    await this.prisma.userStyle.delete({ where: { id } });
    if (style.referenceKey) await this.deleteQuietly(style.referenceKey);
    return { ok: true };
  }

  private async owned(userId: string, id: string): Promise<StyleRow> {
    const style = await this.prisma.userStyle.findFirst({ where: { id, userId } });
    if (!style) throw new NotFoundException('Nie znaleziono stylu');
    return style;
  }

  private async storeReference(reference: Reference): Promise<string> {
    const compressed = await prepareForAi(reference.buffer, reference.mimeType);
    const stored = await this.storage.uploadFile(
      compressed.buffer,
      `style${extensionFor(compressed.mimeType)}`,
      compressed.mimeType,
      USER_STYLE_FOLDER,
    );
    return stored.url;
  }

  private async view(row: StyleRow): Promise<UserStyleView> {
    return {
      id: row.id,
      name: row.name,
      prompt: row.prompt,
      referenceUrl: row.referenceKey ? await this.storage.getSignedUrl(row.referenceKey) : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async deleteQuietly(key: string) {
    await this.storage
      .deleteFile(key)
      .catch((err) => this.logger.error(`Could not delete a style reference: ${err?.message}`));
  }
}
