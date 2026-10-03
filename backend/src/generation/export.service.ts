import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

/**
 * Deterministic post-processing of generated graphics (no AI involved):
 * marketplace-ready aspect ratios, sizes and optional promo badge overlay.
 */
export const EXPORT_RATIOS = {
  '1:1': [1, 1],
  '4:3': [4, 3],
  '3:4': [3, 4],
  '16:9': [16, 9],
} as const;
export type ExportRatio = keyof typeof EXPORT_RATIOS;

export const BADGE_COLORS = {
  red: '#dc2626',
  orange: '#ea580c',
  green: '#16a34a',
  blue: '#2563eb',
  black: '#111827',
} as const;
export type BadgeColor = keyof typeof BADGE_COLORS;

export const BADGE_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
export type BadgePosition = (typeof BADGE_POSITIONS)[number];

export const EXPORT_FORMATS = ['jpeg', 'png', 'webp'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Region of the source image to keep, as fractions of its width/height (0–1). */
export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const EXPORT_ROTATIONS = [0, 90, 180, 270] as const;
export type ExportRotation = (typeof EXPORT_ROTATIONS)[number];

/** Simple tone corrections; 1 = unchanged. Mirrors the CSS filters used for the live preview. */
export interface ImageAdjustments {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  sharpen?: boolean;
}
export const ADJUST_LIMITS = {
  brightness: { min: 0.5, max: 1.5 },
  contrast: { min: 0.5, max: 1.5 },
  saturation: { min: 0, max: 2 },
} as const;

export interface ExportOptions {
  ratio?: ExportRatio;
  /** Clockwise rotation applied before framing. */
  rotate?: ExportRotation;
  adjust?: ImageAdjustments;
  /** When set, this part of the graphic fills the canvas (user-chosen framing) instead of padding with white. */
  crop?: CropRect;
  /** Long edge in pixels (default 1600, Allegro recommends ≥ 1000). */
  size?: number;
  format?: ExportFormat;
  badgeText?: string;
  badgeColor?: BadgeColor;
  badgePosition?: BadgePosition;
}

export const MAX_EXPORT_SIZE = 2560;
export const MIN_EXPORT_SIZE = 500;
export const MAX_BADGE_TEXT = 24;
/** A crop may not be narrower/shorter than this fraction of the source – prevents absurd upscaling. */
export const MIN_CROP_FRACTION = 0.1;

function escapeXml(text: string): string {
  return text.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );
}

@Injectable()
export class ExportService {
  async exportImage(
    input: Buffer,
    options: ExportOptions,
  ): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
    const ratio = options.ratio ?? '1:1';
    if (!(ratio in EXPORT_RATIOS)) throw new BadRequestException('Nieobsługiwane proporcje');
    const size = Math.min(MAX_EXPORT_SIZE, Math.max(MIN_EXPORT_SIZE, Math.round(options.size ?? 1600)));
    const format: ExportFormat = options.format ?? 'jpeg';
    if (!EXPORT_FORMATS.includes(format)) throw new BadRequestException('Nieobsługiwany format');

    const [rw, rh] = EXPORT_RATIOS[ratio];
    const width = rw >= rh ? size : Math.round((size * rw) / rh);
    const height = rw >= rh ? Math.round((size * rh) / rw) : size;

    const rotate = options.rotate ?? 0;
    if (!EXPORT_ROTATIONS.includes(rotate)) throw new BadRequestException('Nieobsługiwany obrót');
    const adjust = this.validateAdjustments(options.adjust);

    let pipeline = sharp(input, { limitInputPixels: 40_000_000 });
    // sharp applies a 90°-multiple rotation before a subsequent extract(), so crop fractions
    // refer to the rotated image – exactly what the crop editor reports.
    if (rotate) pipeline = pipeline.rotate(rotate);
    if (options.crop) {
      // The user picked the framing: cut that region out and scale it to the canvas.
      pipeline = pipeline
        .extract(await this.resolveCrop(input, options.crop, rotate))
        .resize(width, height, { fit: 'cover' });
    } else {
      // Default: fit the whole (square) graphic into the canvas on a white background – never lose the product.
      pipeline = pipeline.resize(width, height, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      });
    }

    if (adjust) {
      if (adjust.brightness !== 1 || adjust.saturation !== 1) {
        pipeline = pipeline.modulate({ brightness: adjust.brightness, saturation: adjust.saturation });
      }
      // Same formula as CSS contrast(): scale around mid grey.
      if (adjust.contrast !== 1) pipeline = pipeline.linear(adjust.contrast, 128 * (1 - adjust.contrast));
      if (adjust.sharpen) pipeline = pipeline.sharpen({ sigma: 1 });
    }

    const badgeText = options.badgeText?.trim();
    if (badgeText) {
      if (badgeText.length > MAX_BADGE_TEXT)
        throw new BadRequestException(`Tekst plakietki może mieć maksymalnie ${MAX_BADGE_TEXT} znaki`);
      const color = BADGE_COLORS[options.badgeColor ?? 'red'];
      if (!color) throw new BadRequestException('Nieobsługiwany kolor plakietki');
      const position = options.badgePosition ?? 'top-left';
      if (!BADGE_POSITIONS.includes(position)) throw new BadRequestException('Nieobsługiwana pozycja plakietki');
      pipeline = pipeline.composite([this.buildBadge(badgeText, color, position, width, height)]);
    }

    if (format === 'png') pipeline = pipeline.png({ compressionLevel: 8 });
    else if (format === 'webp') pipeline = pipeline.webp({ quality: 90 });
    else pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 92, mozjpeg: true });

    const buffer = await pipeline.toBuffer();
    return {
      buffer,
      contentType: `image/${format}`,
      extension: format === 'jpeg' ? 'jpg' : format,
    };
  }

  private validateAdjustments(adjust?: ImageAdjustments): Required<ImageAdjustments> | null {
    if (!adjust) return null;
    const pick = (key: 'brightness' | 'contrast' | 'saturation') => {
      const value = adjust[key] ?? 1;
      const { min, max } = ADJUST_LIMITS[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        throw new BadRequestException(`Nieprawidłowa wartość korekty (${key})`);
      }
      return value;
    };
    const result = {
      brightness: pick('brightness'),
      contrast: pick('contrast'),
      saturation: pick('saturation'),
      sharpen: Boolean(adjust.sharpen),
    };
    const noop = result.brightness === 1 && result.contrast === 1 && result.saturation === 1 && !result.sharpen;
    return noop ? null : result;
  }

  /** Converts a fractional crop into a pixel region that lies fully inside the (rotated) source image. */
  private async resolveCrop(
    input: Buffer,
    crop: CropRect,
    rotate: ExportRotation = 0,
  ): Promise<{ left: number; top: number; width: number; height: number }> {
    const values = [crop.left, crop.top, crop.width, crop.height];
    if (values.some((v) => typeof v !== 'number' || !Number.isFinite(v)))
      throw new BadRequestException('Nieprawidłowy kadr');
    if (crop.width < MIN_CROP_FRACTION || crop.height < MIN_CROP_FRACTION)
      throw new BadRequestException('Kadr jest za mały');
    if (crop.left < 0 || crop.top < 0 || crop.left + crop.width > 1.001 || crop.top + crop.height > 1.001) {
      throw new BadRequestException('Kadr wykracza poza grafikę');
    }
    const meta = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
    const swap = rotate === 90 || rotate === 270;
    const srcW = (swap ? meta.height : meta.width) ?? 0;
    const srcH = (swap ? meta.width : meta.height) ?? 0;
    if (!srcW || !srcH) throw new BadRequestException('Nie udało się odczytać grafiki');
    const left = Math.min(srcW - 1, Math.max(0, Math.round(crop.left * srcW)));
    const top = Math.min(srcH - 1, Math.max(0, Math.round(crop.top * srcH)));
    const width = Math.max(1, Math.min(srcW - left, Math.round(crop.width * srcW)));
    const height = Math.max(1, Math.min(srcH - top, Math.round(crop.height * srcH)));
    return { left, top, width, height };
  }

  private buildBadge(text: string, color: string, position: BadgePosition, width: number, height: number) {
    const base = Math.min(width, height);
    const fontSize = Math.round(base * 0.065);
    const paddingX = Math.round(fontSize * 0.9);
    const paddingY = Math.round(fontSize * 0.45);
    const badgeWidth = Math.round(text.length * fontSize * 0.62 + paddingX * 2);
    const badgeHeight = Math.round(fontSize + paddingY * 2);
    const radius = Math.round(badgeHeight / 2);
    const margin = Math.round(base * 0.04);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${badgeWidth}" height="${badgeHeight}">
  <rect x="0" y="0" width="${badgeWidth}" height="${badgeHeight}" rx="${radius}" ry="${radius}" fill="${color}"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-weight="700" font-size="${fontSize}" fill="#ffffff">${escapeXml(text)}</text>
</svg>`;

    const left = position.endsWith('left') ? margin : width - badgeWidth - margin;
    const top = position.startsWith('top') ? margin : height - badgeHeight - margin;
    return { input: Buffer.from(svg), left: Math.max(0, left), top: Math.max(0, top) };
  }
}
