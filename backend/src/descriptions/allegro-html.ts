/**
 * Allegro accepts only a handful of HTML tags in offer descriptions (p, h1, h2, ul, ol, li, b)
 * and no attributes. Everything we store or return is reduced to that subset, which also
 * removes any script/style/event-handler content the model or a user could sneak in.
 */
export const ALLEGRO_ALLOWED_TAGS = ['h2', 'p', 'ul', 'ol', 'li', 'b'] as const;
const ALLOWED = new Set<string>(ALLEGRO_ALLOWED_TAGS);
const ALLOWED_PATTERN = ALLEGRO_ALLOWED_TAGS.join('|');

/** Tags the model may use that Allegro does not – mapped to the closest allowed one. */
const ALIASES: Record<string, string> = { strong: 'b', h1: 'h2', h3: 'h2', h4: 'h2', h5: 'h2', h6: 'h2' };

export const MAX_TITLE_LENGTH = 75;
export const MAX_BODY_LENGTH = 20000;
export const MAX_KEYWORDS = 20;
export const MAX_KEYWORD_LENGTH = 60;

export function sanitizeAllegroHtml(input: string): string {
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
export function allegroHtmlToText(html: string): string {
  return sanitizeAllegroHtml(html)
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

/** Allegro's title limit, cut at a word boundary. */
export function clampTitle(title: string): string {
  const clean = String(title ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= MAX_TITLE_LENGTH) return clean;
  const cut = clean.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim();
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
