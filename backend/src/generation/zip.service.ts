import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as path from 'path';
import type { Writable } from 'stream';
import { ZipFile } from 'yazl';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../images/storage.service';
import { allegroHtmlToText } from '../descriptions/allegro-html';

/** Spec 15: one package per request. */
export const MAX_ZIP_IMAGES = 50;
export const MAX_ZIP_FILES = 300;

export type ZipEntry =
  { kind: 'file'; name: string; storageKey: string } | { kind: 'text'; name: string; content: string };

export interface ZipPlan {
  entries: ZipEntry[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Builds the ZIP of finished graphics + offer descriptions (spec 15).
 * `plan` does every check (ownership, limits) before the response starts; `stream` then fetches the
 * files one by one so memory stays flat regardless of the package size.
 */
@Injectable()
export class ZipService {
  private readonly logger = new Logger(ZipService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async plan(userId: string, imageIds: string[]): Promise<ZipPlan> {
    if (!imageIds.length) throw new BadRequestException('Zaznacz co najmniej jedno zdjęcie');
    if (imageIds.length > MAX_ZIP_IMAGES) {
      throw new BadRequestException(`Jedna paczka może zawierać maksymalnie ${MAX_ZIP_IMAGES} zdjęć`);
    }
    if (new Set(imageIds).size !== imageIds.length) {
      throw new BadRequestException('Zdjęcia w paczce nie mogą się powtarzać');
    }

    const images = await this.prisma.image.findMany({
      where: { id: { in: imageIds }, userId },
      include: {
        generations: {
          where: { status: 'COMPLETED', url: { not: null } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
        offerDescription: true,
      },
    });
    // Someone else's photo is indistinguishable from a missing one – never confirm it exists.
    if (images.length !== imageIds.length) throw new NotFoundException('Nie znaleziono zdjęcia');
    const byId = new Map(images.map((img) => [img.id, img]));

    const entries: ZipEntry[] = [];
    imageIds.forEach((id, index) => {
      const image = byId.get(id)!;
      const folder = `${pad(index + 1)}-${image.id.slice(-8)}`;
      image.generations.forEach((gen, n) => {
        const ext = (path.extname(gen.url!.split('?')[0]) || '.png').toLowerCase();
        const style = (gen.style || 'custom').replace(/[^a-z0-9-]/gi, '');
        entries.push({ kind: 'file', name: `${folder}/${pad(n + 1)}-${style}${ext}`, storageKey: gen.url! });
      });
      const description = image.offerDescription;
      if (description) {
        entries.push({ kind: 'text', name: `${folder}/opis.html`, content: description.body });
        entries.push({
          kind: 'text',
          name: `${folder}/opis.txt`,
          content: [
            `Tytuł: ${description.title}`,
            `Frazy: ${description.keywords.join(', ')}`,
            '',
            allegroHtmlToText(description.body),
            '',
          ].join('\n'),
        });
      }
    });

    if (!entries.length) throw new NotFoundException('Zaznaczone zdjęcia nie mają jeszcze gotowych grafik ani opisów');
    if (entries.length > MAX_ZIP_FILES) {
      throw new BadRequestException(
        `Za dużo plików w jednej paczce (maksymalnie ${MAX_ZIP_FILES}). Zaznacz mniej zdjęć.`,
      );
    }
    return { entries };
  }

  /** Streams the archive into `out`; a file missing in storage is listed in BLEDY.txt instead. */
  async stream(plan: ZipPlan, out: Writable): Promise<void> {
    const zip = new ZipFile();
    const finished = new Promise<void>((resolve, reject) => {
      zip.outputStream.on('error', reject);
      out.on('error', reject);
      out.on('finish', resolve);
      out.on('close', resolve);
    });
    zip.outputStream.pipe(out);

    const failed: string[] = [];
    for (const entry of plan.entries) {
      if ((out as Writable & { destroyed?: boolean }).destroyed) break; // client went away
      if (entry.kind === 'text') {
        zip.addBuffer(Buffer.from(entry.content, 'utf8'), entry.name);
        continue;
      }
      try {
        const { buffer } = await this.storage.getFileBuffer(entry.storageKey);
        zip.addBuffer(buffer, entry.name, { compress: false }); // images are already compressed
      } catch (err: any) {
        this.logger.warn(`ZIP: could not read ${entry.storageKey}: ${err?.message}`);
        failed.push(entry.name);
      }
    }
    if (failed.length) {
      zip.addBuffer(
        Buffer.from(
          ['Tych plików nie udało się pobrać z magazynu. Pobierz je pojedynczo z generatora:', '', ...failed, ''].join(
            '\n',
          ),
          'utf8',
        ),
        'BLEDY.txt',
      );
    }
    zip.end();
    await finished;
  }
}
