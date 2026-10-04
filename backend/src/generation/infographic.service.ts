import { BadRequestException, Injectable } from '@nestjs/common';
import sharp, { OverlayOptions } from 'sharp';
import { BADGE_COLORS, BadgeColor } from './export.service';

/**
 * Infographics for additional offer photos (spec 14): the seller's graphic plus features with icons,
 * or plus dimension arrows. Rendered deterministically with sharp + SVG (DejaVu Sans covers Polish),
 * so the text is always correct and there is no AI cost.
 */

export const INFOGRAPHIC_SIZE = 1600;
export const MAX_FEATURES = 6;
export const MAX_FEATURE_TEXT = 48;
export const MAX_TITLE = 40;
export const MAX_DIMENSION = 100_000;

export const INFOGRAPHIC_TEMPLATES = ['features', 'dimensions'] as const;
export type InfographicTemplate = (typeof INFOGRAPHIC_TEMPLATES)[number];
export const INFOGRAPHIC_THEMES = ['light', 'dark'] as const;
export type InfographicTheme = (typeof INFOGRAPHIC_THEMES)[number];
export const LENGTH_UNITS = ['mm', 'cm', 'm'] as const;
export type LengthUnit = (typeof LENGTH_UNITS)[number];
export const WEIGHT_UNITS = ['g', 'kg'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

/** 24×24 stroke icons (white on the accent circle). Markup is static – never built from user input. */
export const INFOGRAPHIC_ICONS: Record<string, { name: string; svg: string }> = {
  check: { name: 'Zaleta', svg: '<path d="M5 12.5l4.5 4.5L19 7.5"/>' },
  shield: {
    name: 'Gwarancja',
    svg: '<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  },
  truck: {
    name: 'Dostawa',
    svg: '<path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  },
  battery: {
    name: 'Bateria',
    svg: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10v4M7 10v4M10.5 10v4M14 10v4"/>',
  },
  water: { name: 'Wodoodporność', svg: '<path d="M12 3c3.5 4.5 6 7.7 6 11a6 6 0 0 1-12 0c0-3.3 2.5-6.5 6-11z"/>' },
  leaf: { name: 'Ekologia', svg: '<path d="M5 19C5 11 10 5 20 5c0 10-6 15-14 15"/><path d="M5 19l8-8"/>' },
  star: { name: 'Jakość', svg: '<path d="M12 3l2.8 6 6.2.6-4.8 4.2 1.4 6.2L12 16.8 6.4 20l1.4-6.2L3 9.6 9.2 9z"/>' },
  ruler: { name: 'Rozmiar', svg: '<path d="M3 16L16 3l5 5L8 21z"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2"/>' },
  weight: { name: 'Waga', svg: '<circle cx="12" cy="5" r="2"/><path d="M7 8h10l3 12H4z"/>' },
  clock: { name: 'Czas', svg: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
  bolt: { name: 'Moc', svg: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>' },
  heart: { name: 'Komfort', svg: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>' },
  gift: {
    name: 'Prezent',
    svg: '<path d="M3 9h18v4H3zM5 13h14v8H5zM12 9v12"/><path d="M12 9c-2-4-6-4-6-1.5S10 9 12 9c2 0 6 0 6-1.5S14 5 12 9"/>',
  },
  recycle: {
    name: 'Recykling',
    svg: '<path d="M7 7a7 7 0 0 1 11 2M18 9h-4M18 9V5M17 17A7 7 0 0 1 6 15M6 15h4M6 15v4"/>',
  },
  thermometer: { name: 'Temperatura', svg: '<path d="M10 4a2 2 0 0 1 4 0v10a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>' },
  wireless: {
    name: 'Bezprzewodowy',
    svg: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1.2" fill="#fff"/>',
  },
  thumb: {
    name: 'Ergonomia',
    svg: '<path d="M7 11v9H4v-9z"/><path d="M7 11l4-8c1.5 0 2.5 1 2.5 2.5V9h5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7"/>',
  },
  sparkles: {
    name: 'Nowość',
    svg: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  },
  box: { name: 'Zestaw', svg: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>' },
  lock: {
    name: 'Bezpieczeństwo',
    svg: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  },
};
export const INFOGRAPHIC_ICON_IDS = Object.keys(INFOGRAPHIC_ICONS);

export interface InfographicFeature {
  icon: string;
  text: string;
}

export interface InfographicDimensions {
  width?: number;
  height?: number;
  depth?: number;
  unit: LengthUnit;
  weight?: number;
  weightUnit?: WeightUnit;
}

export interface InfographicOptions {
  template: InfographicTemplate;
  title?: string;
  features?: InfographicFeature[];
  dimensions?: InfographicDimensions;
  theme?: InfographicTheme;
  accent?: BadgeColor;
  format?: 'png' | 'jpeg';
}

const FONT = 'DejaVu Sans, Verdana, Arial, sans-serif';
const PAD = 80;
const THEMES = {
  light: { bg: '#ffffff', text: '#111827', muted: '#4b5563', panel: '#f3f4f6' },
  dark: { bg: '#111827', text: '#f9fafb', muted: '#d1d5db', panel: '#1f2937' },
} as const;

export function escapeXml(text: string): string {
  return text.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );
}

/** Greedy word wrap by an average glyph width; long words are hard-split; overflow ends with "…". */
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  const push = () => {
    if (current) lines.push(current);
    current = '';
  };
  for (let word of words) {
    while (word.length > maxChars) {
      push();
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
    }
    if (!current) current = word;
    else if (current.length + 1 + word.length <= maxChars) current += ` ${word}`;
    else {
      push();
      current = word;
    }
  }
  push();
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] = (last.length >= maxChars ? last.slice(0, maxChars - 1) : last).replace(/[\s.,;:]+$/, '') + '…';
  return kept;
}

const numberFormat = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
export function formatMeasure(value: number, unit: string): string {
  return `${numberFormat.format(value)} ${unit}`;
}

@Injectable()
export class InfographicService {
  async render(
    source: Buffer,
    options: InfographicOptions,
  ): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
    const normalized = this.validate(options);
    const theme = THEMES[normalized.theme];
    const accent = BADGE_COLORS[normalized.accent];
    const title = normalized.title;
    const contentTop = title ? 250 : PAD;

    const layers: OverlayOptions[] = [];
    let svgBody = '';

    if (title) {
      svgBody += `<text x="${PAD}" y="165" font-family="${FONT}" font-size="64" font-weight="bold" fill="${theme.text}">${escapeXml(title)}</text>`;
      svgBody += `<rect x="${PAD}" y="195" width="140" height="10" rx="5" fill="${accent}"/>`;
    }

    if (normalized.template === 'features') {
      const features = normalized.features!;
      const available = INFOGRAPHIC_SIZE - PAD - contentTop;
      const productHeight = Math.min(available, 1100);
      const box = { left: PAD, top: contentTop + (available - productHeight) / 2, width: 720, height: productHeight };
      const placed = await this.placeProduct(source, box, { isolate: true, padding: 0.06 });
      layers.push(placed.layer);

      const colLeft = 880;
      const rowHeight = Math.min(230, box.height / features.length);
      const blockTop = box.top + (box.height - rowHeight * features.length) / 2;
      features.forEach((feature, i) => {
        const cy = blockTop + rowHeight * i + rowHeight / 2;
        const cx = colLeft + 44;
        svgBody += `<circle cx="${cx}" cy="${cy}" r="44" fill="${accent}"/>`;
        svgBody +=
          `<g transform="translate(${cx - 24} ${cy - 24}) scale(2)" fill="none" stroke="#fff" stroke-width="2" ` +
          `stroke-linecap="round" stroke-linejoin="round">${INFOGRAPHIC_ICONS[feature.icon].svg}</g>`;
        const lines = wrapText(feature.text, 23, 2);
        const lineHeight = 50;
        const firstY = cy - ((lines.length - 1) * lineHeight) / 2 + 14;
        lines.forEach((line, li) => {
          svgBody += `<text x="${colLeft + 120}" y="${firstY + li * lineHeight}" font-family="${FONT}" font-size="40" fill="${theme.text}">${escapeXml(line)}</text>`;
        });
      });
    } else {
      const dims = normalized.dimensions!;
      const box = { left: 160, top: contentTop + 20, width: 1000, height: 1180 - contentTop };
      const placed = await this.placeProduct(source, box, { isolate: true, padding: 0 });
      layers.push(placed.layer);
      const r = placed.rect;

      if (dims.width !== undefined) {
        const y = r.top + r.height + 60;
        svgBody += this.arrow(r.left, y, r.left + r.width, y, accent);
        svgBody += `<text x="${r.left + r.width / 2}" y="${y + 70}" text-anchor="middle" font-family="${FONT}" font-size="48" font-weight="bold" fill="${theme.text}">${escapeXml(formatMeasure(dims.width, dims.unit))}</text>`;
        svgBody += `<text x="${r.left + r.width / 2}" y="${y + 112}" text-anchor="middle" font-family="${FONT}" font-size="30" fill="${theme.muted}">szerokość</text>`;
      }
      if (dims.height !== undefined) {
        const x = r.left + r.width + 60;
        svgBody += this.arrow(x, r.top, x, r.top + r.height, accent);
        const cy = r.top + r.height / 2;
        svgBody += `<text x="${x + 36}" y="${cy + 6}" font-family="${FONT}" font-size="48" font-weight="bold" fill="${theme.text}">${escapeXml(formatMeasure(dims.height, dims.unit))}</text>`;
        svgBody += `<text x="${x + 36}" y="${cy + 48}" font-family="${FONT}" font-size="30" fill="${theme.muted}">wysokość</text>`;
      }

      const chips: string[] = [];
      if (dims.depth !== undefined) chips.push(`Głębokość: ${formatMeasure(dims.depth, dims.unit)}`);
      if (dims.weight !== undefined) chips.push(`Waga: ${formatMeasure(dims.weight, dims.weightUnit ?? 'kg')}`);
      let chipX = PAD;
      const chipY = INFOGRAPHIC_SIZE - PAD - 80;
      for (const chip of chips) {
        const width = Math.round(chip.length * 22 + 70);
        svgBody += `<rect x="${chipX}" y="${chipY}" width="${width}" height="80" rx="40" fill="${theme.panel}" stroke="${accent}" stroke-width="4"/>`;
        svgBody += `<text x="${chipX + 35}" y="${chipY + 52}" font-family="${FONT}" font-size="38" fill="${theme.text}">${escapeXml(chip)}</text>`;
        chipX += width + 30;
      }
    }

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${INFOGRAPHIC_SIZE}" height="${INFOGRAPHIC_SIZE}">` +
      `${svgBody}</svg>`;

    let image = sharp({
      create: { width: INFOGRAPHIC_SIZE, height: INFOGRAPHIC_SIZE, channels: 4, background: theme.bg },
    }).composite([...layers, { input: Buffer.from(svg), top: 0, left: 0 }]);

    if (normalized.format === 'jpeg') {
      const buffer = await image.flatten({ background: theme.bg }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      return { buffer, contentType: 'image/jpeg', extension: 'jpg' };
    }
    image = image.png({ compressionLevel: 9 });
    return { buffer: await image.toBuffer(), contentType: 'image/png', extension: 'png' };
  }

  /** Validates business rules the DTO cannot express (template-dependent fields). */
  validate(
    options: InfographicOptions,
  ): Required<Pick<InfographicOptions, 'template' | 'theme' | 'accent' | 'format'>> & InfographicOptions {
    if (!INFOGRAPHIC_TEMPLATES.includes(options.template))
      throw new BadRequestException('Nieznany szablon infografiki');
    const title = options.title?.trim() || undefined;
    if (title && title.length > MAX_TITLE)
      throw new BadRequestException(`Tytuł może mieć maksymalnie ${MAX_TITLE} znaków`);

    let features: InfographicFeature[] | undefined;
    let dimensions: InfographicDimensions | undefined;
    if (options.template === 'features') {
      features = (options.features ?? []).map((f) => ({ icon: f.icon, text: (f.text ?? '').trim() }));
      if (features.length < 1 || features.length > MAX_FEATURES) {
        throw new BadRequestException(`Dodaj od 1 do ${MAX_FEATURES} cech`);
      }
      for (const f of features) {
        if (!INFOGRAPHIC_ICONS[f.icon]) throw new BadRequestException('Nieznana ikona');
        if (!f.text) throw new BadRequestException('Każda cecha musi mieć opis');
        if (f.text.length > MAX_FEATURE_TEXT) {
          throw new BadRequestException(`Opis cechy może mieć maksymalnie ${MAX_FEATURE_TEXT} znaków`);
        }
      }
    } else {
      const d = options.dimensions;
      if (!d || !LENGTH_UNITS.includes(d.unit))
        throw new BadRequestException('Podaj jednostkę wymiarów (mm, cm albo m)');
      if (d.width === undefined && d.height === undefined) {
        throw new BadRequestException('Podaj co najmniej szerokość albo wysokość');
      }
      for (const [label, value] of [
        ['Szerokość', d.width],
        ['Wysokość', d.height],
        ['Głębokość', d.depth],
        ['Waga', d.weight],
      ] as const) {
        if (value !== undefined && !(Number.isFinite(value) && value > 0 && value <= MAX_DIMENSION)) {
          throw new BadRequestException(`${label} musi być liczbą większą od zera`);
        }
      }
      if (d.weightUnit !== undefined && !WEIGHT_UNITS.includes(d.weightUnit)) {
        throw new BadRequestException('Jednostka wagi to g albo kg');
      }
      dimensions = d;
    }

    return {
      ...options,
      title,
      features,
      dimensions,
      theme: options.theme && INFOGRAPHIC_THEMES.includes(options.theme) ? options.theme : 'light',
      accent: options.accent && options.accent in BADGE_COLORS ? options.accent : 'blue',
      format: options.format === 'jpeg' ? 'jpeg' : 'png',
    };
  }

  /**
   * Fits the graphic into `box`. With `isolate`, a uniform background is trimmed first so the product
   * fills the space and dimension arrows hug it; `padding` (fraction) then adds an even margin in the
   * original background colour. Scenes without a uniform background keep the full frame and get
   * rounded corners. A tightly trimmed product is never rounded (that would clip it).
   */
  private async placeProduct(
    source: Buffer,
    box: { left: number; top: number; width: number; height: number },
    options: { isolate: boolean; padding: number },
  ): Promise<{ layer: OverlayOptions; rect: { left: number; top: number; width: number; height: number } }> {
    let input: Buffer = await sharp(source).rotate().png().toBuffer();
    let trimmed = false;
    if (options.isolate) {
      const result = await this.isolateProduct(input);
      trimmed = result.trimmed;
      input = result.buffer;
      if (trimmed && options.padding > 0) {
        const meta = await sharp(input).metadata();
        const margin = Math.round(Math.max(meta.width ?? 0, meta.height ?? 0) * options.padding);
        input = await sharp(input)
          .extend({ top: margin, bottom: margin, left: margin, right: margin, background: result.background })
          .png()
          .toBuffer();
      }
    }
    const resized = await sharp(input)
      .resize({ width: Math.round(box.width), height: Math.round(box.height), fit: 'inside' })
      .png()
      .toBuffer({ resolveWithObject: true });
    const { width, height } = resized.info;
    let layerInput = resized.data;
    if (!trimmed || options.padding > 0) {
      const radius = 32;
      const mask = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" ry="${radius}"/></svg>`,
      );
      layerInput = await sharp(resized.data)
        .ensureAlpha()
        .composite([{ input: mask, blend: 'dest-in' }])
        .png()
        .toBuffer();
    }
    const left = Math.round(box.left + (box.width - width) / 2);
    const top = Math.round(box.top + (box.height - height) / 2);
    return { layer: { input: layerInput, left, top }, rect: { left, top, width, height } };
  }

  /** Exposed for tests: the trimmed product when it sits on a uniform background, else the input. */
  async trimUniformBackground(input: Buffer): Promise<Buffer> {
    return (await this.isolateProduct(input)).buffer;
  }

  private async isolateProduct(
    input: Buffer,
  ): Promise<{ buffer: Buffer; trimmed: boolean; background: { r: number; g: number; b: number } }> {
    const meta = await sharp(input).metadata();
    const corner = await sharp(input).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    const background = { r: corner[0], g: corner[1], b: corner[2] };
    try {
      const result = await sharp(input).trim({ threshold: 18 }).png().toBuffer({ resolveWithObject: true });
      const { width, height } = result.info;
      const shrank = width < (meta.width ?? 0) * 0.97 || height < (meta.height ?? 0) * 0.97;
      // A trim to a sliver means the "background" was the scene itself – keep the whole frame.
      const tooSmall = width < (meta.width ?? 0) * 0.08 || height < (meta.height ?? 0) * 0.08;
      if (shrank && !tooSmall) return { buffer: result.data, trimmed: true, background };
    } catch {
      // sharp throws when the whole image is one colour
    }
    return { buffer: input, trimmed: false, background };
  }

  private arrow(x1: number, y1: number, x2: number, y2: number, color: string): string {
    const horizontal = y1 === y2;
    const head = 22;
    const tick = 26;
    const ends = horizontal
      ? `<path d="M${x1} ${y1}l${head} ${-head / 2}v${head}z M${x2} ${y2}l${-head} ${-head / 2}v${head}z" fill="${color}"/>` +
        `<path d="M${x1} ${y1 - tick}v${tick * 2}M${x2} ${y2 - tick}v${tick * 2}" stroke="${color}" stroke-width="5"/>`
      : `<path d="M${x1} ${y1}l${-head / 2} ${head}h${head}z M${x2} ${y2}l${-head / 2} ${-head}h${head}z" fill="${color}"/>` +
        `<path d="M${x1 - tick} ${y1}h${tick * 2}M${x2 - tick} ${y2}h${tick * 2}" stroke="${color}" stroke-width="5"/>`;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="6"/>${ends}`;
  }
}
