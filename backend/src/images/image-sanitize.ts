import sharp from 'sharp';
import { AllowedImageFormat, MAX_IMAGE_PIXELS } from './image-validation';

/** JPEG/WebP quality of re-encoded originals – visually lossless; the AI only ever sees ≤ 1024 px anyway. */
export const SANITIZED_QUALITY = 95;

export interface ImageMetadataSummary {
  exif: boolean;
  xmp: boolean;
  iptc: boolean;
  comments: boolean;
  /** EXIF orientation other than 1 (the pixels are not stored upright). */
  rotated: boolean;
}

/** What privacy-relevant metadata a file carries (used by the upload path, the maintenance script and tests). */
export async function describeMetadata(buffer: Buffer): Promise<ImageMetadataSummary> {
  const meta = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
  return {
    exif: Boolean(meta.exif?.length),
    xmp: Boolean(meta.xmp?.length),
    iptc: Boolean(meta.iptc?.length),
    comments: Boolean(meta.comments?.length),
    rotated: Boolean(meta.orientation && meta.orientation !== 1),
  };
}

export function hasPrivateMetadata(summary: ImageMetadataSummary): boolean {
  return summary.exif || summary.xmp || summary.iptc || summary.comments || summary.rotated;
}

/**
 * Spec 04, AC-UPL-019: the stored original carries no EXIF (GPS, camera, owner), XMP, IPTC or text
 * comments. The EXIF orientation is applied to the pixels first, so the photo stays upright without the
 * tag; the ICC colour profile is kept (except CMYK, which is converted to sRGB like before). The format
 * stays the same, so the stored file name and MIME type do not change.
 */
export async function stripImageMetadata(buffer: Buffer, format: AllowedImageFormat): Promise<Buffer> {
  const meta = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
  // `rotate()` without an angle = auto-orient from EXIF; output never contains EXIF/XMP/IPTC unless asked.
  let pipeline = sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).rotate();
  if (meta.icc?.length && meta.space !== 'cmyk') pipeline = pipeline.keepIccProfile();

  if (format === 'png') pipeline = pipeline.png({ compressionLevel: 6 });
  else if (format === 'webp') pipeline = pipeline.webp({ quality: SANITIZED_QUALITY });
  else pipeline = pipeline.jpeg({ quality: SANITIZED_QUALITY });

  return pipeline.toBuffer();
}
