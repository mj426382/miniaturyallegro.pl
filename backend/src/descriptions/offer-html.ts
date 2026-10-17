import { DEFAULT_PLATFORM, getPlatformPreset, MAX_PLATFORM_TITLE_LENGTH } from '../generation/platform-presets';

/**
 * Offer descriptions use a small, safe HTML subset (h2, p, ul, ol, li, b) without attributes – it pastes
 * cleanly into shop and eBay editors and converts to plain text for OLX/Vinted. Everything we store or
 * return is reduced to that subset, which also removes any script/style/event-handler content.
 */
export const OFFER_ALLOWED_TAGS = ['h2', 'p', 'ul', 'ol', 'li', 'b'] as const;
const ALLOWED = new Set<string>(OFFER_ALLOWED_TAGS);
const ALLOWED_PATTERN = OFFER_ALLOWED_TAGS.join('|');

/** Tags the model may use outside the subset – mapped to the closest allowed one. */
const ALIASES: Record<string, string> = { strong: 'b', h1: 'h2', h3: 'h2', h4: 'h2', h5: 'h2', h6: 'h2' };

/** Default (generic) title limit; each platform has its own (spec 08). */
export const MAX_TITLE_LENGTH = getPlatformPreset(DEFAULT_PLATFORM).titleMaxLength;
/** The longest title any platform accepts (DTO limit). */
export const MAX_ANY_TITLE_LENGTH = MAX_PLATFORM_TITLE_LENGTH;
export const MAX_BODY_LENGTH = 20000;
export const MAX_KEYWORDS = 20;
export const MAX_KEYWORD_LENGTH = 60;

export function sanitizeOfferHtml(input: string): string {
  let html = String(input ?? '');
  html = html.replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  // Every tag: keep allowed names without attributes, drop the rest (their text content stays).
  html = html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_m, slash: string, name: string) => {
    const lower = name.toLowerCase();
    const tag = ALIASES[lower] ?? lower;
    if (lower === 'br') return ' ';
    if (!ALLOWED.has(tag)) return '';
    return `<${slash}${tag}>`;
  });
  // Any "<" left over is literal text, not markup.
  html = html.replace(new RegExp(`<(?!\\/?(?:${ALLOWED_PATTERN})>)`, 'g'), '&lt;');
  return html.replace(/\n{3,}/g, '\n\n').trim();
}

/** Readable text version (for the clipboard / plain-text fallback). */
export function offerHtmlToText(html: string): string {
  return sanitizeOfferHtml(html)
    .replace(/<\/(h2|p|li)>/g, '\n')
    .replace(/<li>/g, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Fits the title into `max` characters (the platform limit), cut at a word boundary. */
export function clampTitle(title: string, max: number = MAX_TITLE_LENGTH): string {
  const clean = String(title ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trim();
}

export function normalizeKeywords(keywords: unknown): string[] {
  if (!Array.isArray(keywords)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of keywords) {
    if (typeof raw !== 'string') continue;
    const k = raw
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .slice(0, MAX_KEYWORD_LENGTH);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}
