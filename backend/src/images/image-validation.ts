import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export const ALLOWED_IMAGE_FORMATS = ['jpeg', 'png', 'webp'] as const;
export type AllowedImageFormat = (typeof ALLOWED_IMAGE_FORMATS)[number];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_IMAGE_PIXELS = 40_000_000; // ~6300x6300 – protects against decompression bombs

export interface ValidatedImage {
  format: AllowedImageFormat;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
}

/**
 * Validates an uploaded image by decoding its header with sharp instead of
 * trusting the client-supplied MIME type / file extension.
 */
export async function validateImageBuffer(buffer: Buffer): Promise<ValidatedImage> {
  if (!buffer || buffer.length === 0) {
    throw new BadRequestException('Plik jest pusty');
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new BadRequestException('Plik jest zbyt duży (maksymalnie 10 MB)');
  }

  let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    meta = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
  } catch {
    throw new BadRequestException('Plik nie jest prawidłowym obrazem (dozwolone: JPG, PNG, WebP)');
  }

  const format = meta.format as string;
  if (!ALLOWED_IMAGE_FORMATS.includes(format as AllowedImageFormat)) {
    throw new BadRequestException('Nieobsługiwany format obrazu (dozwolone: JPG, PNG, WebP)');
  }
  if (!meta.width || !meta.height || meta.width < 100 || meta.height < 100) {
    throw new BadRequestException('Obraz jest zbyt mały – minimalny rozmiar to 100×100 px');
  }
  if (meta.width * meta.height > MAX_IMAGE_PIXELS) {
    throw new BadRequestException('Obraz ma zbyt dużą rozdzielczość');
  }

  const typed = format as AllowedImageFormat;
  return {
    format: typed,
    mimeType: `image/${typed}`,
    extension: typed === 'jpeg' ? '.jpg' : `.${typed}`,
    width: meta.width,
    height: meta.height,
  };
}

/** Multer fileFilter – cheap first-pass check on the declared MIME type. */
export function imageMimeFilter(
  _req: unknown,
  file: { mimetype: string },
  cb: (err: Error | null, ok: boolean) => void,
) {
  if (!/^image\/(jpe?g|png|webp)$/.test(file.mimetype)) {
    return cb(new BadRequestException('Dozwolone są tylko pliki JPG, PNG i WebP'), false);
  }
  cb(null, true);
}
