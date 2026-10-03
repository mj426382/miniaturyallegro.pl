import { Logger } from '@nestjs/common';
import sharp from 'sharp';

/** Max dimension for images sent to the AI APIs (saves tokens & cost). */
export const MAX_AI_IMAGE_DIM = 1024;
const logger = new Logger('ImagePrep');

/**
 * Compress and resize an image before sending it to the AI providers.
 * Smaller base64 = fewer input tokens = lower cost; EXIF orientation is applied.
 */
export async function prepareForAi(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const image = sharp(buffer, { limitInputPixels: 40_000_000 }).rotate();
    const meta = await image.metadata();
    const needsResize =
      (meta.width && meta.width > MAX_AI_IMAGE_DIM) || (meta.height && meta.height > MAX_AI_IMAGE_DIM);

    let pipeline = needsResize
      ? image.resize(MAX_AI_IMAGE_DIM, MAX_AI_IMAGE_DIM, { fit: 'inside', withoutEnlargement: true })
      : image;

    const keepPng = mimeType === 'image/png' && meta.hasAlpha;
    pipeline = keepPng ? pipeline.png({ compressionLevel: 9 }) : pipeline.jpeg({ quality: 85 });

    const compressed = await pipeline.toBuffer();
    if (compressed.length >= buffer.length && !needsResize) {
      return { buffer, mimeType };
    }
    return { buffer: compressed, mimeType: keepPng ? 'image/png' : 'image/jpeg' };
  } catch (err) {
    logger.warn('Image compression failed, using original', err);
    return { buffer, mimeType };
  }
}

export function detectMimeTypeFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url, 'http://localhost');
    const ext = pathname.split('.').pop()?.toLowerCase();
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'gif') return 'image/gif';
  } catch {
    // fall through
  }
  return 'image/jpeg';
}
