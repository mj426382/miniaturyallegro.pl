/**
 * Allegro offer descriptions allow only h2/p/ul/ol/li/b without attributes. The API already
 * stores sanitized HTML; this mirror of the server rule guards the live preview and the
 * clipboard output when the user edits the HTML by hand.
 */
export const ALLEGRO_ALLOWED_TAGS = ['h2', 'p', 'ul', 'ol', 'li', 'b'] as const
const ALLOWED = new Set<string>(ALLEGRO_ALLOWED_TAGS)
const ALIASES: Record<string, string> = { strong: 'b', h1: 'h2', h3: 'h2', h4: 'h2', h5: 'h2', h6: 'h2' }
const STRAY_LT = new RegExp(`<(?!\\/?(?:${ALLEGRO_ALLOWED_TAGS.join('|')})>)`, 'g')

export const MAX_TITLE_LENGTH = 75

export function sanitizeAllegroHtml(input: string): string {
  let html = String(input ?? '')
  html = html.replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  html = html.replace(/<!--[\s\S]*?-->/g, '')
  html = html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (_m, slash: string, name: string) => {
    const lower = name.toLowerCase()
    const tag = ALIASES[lower] ?? lower
    if (lower === 'br') return ' '
    if (!ALLOWED.has(tag)) return ''
    return `<${slash}${tag}>`
  })
  html = html.replace(STRAY_LT, '&lt;')
  return html.replace(/\n{3,}/g, '\n\n').trim()
}

/** Sanitized HTML without the whitespace that formatting adds between tags – what gets saved and compared. */
export function compactAllegroHtml(html: string): string {
  return sanitizeAllegroHtml(html).replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim()
}

/** Plain-text rendering for sellers who paste into a text-only field. */
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
    .trim()
}

/** Pretty-prints the compact HTML the API returns so it is editable in a textarea. */
export function formatAllegroHtml(html: string): string {
  return sanitizeAllegroHtml(html)
    .replace(/<(h2|p|ul|ol)>/g, '\n<$1>')
    .replace(/<\/(ul|ol)>/g, '\n</$1>')
    .replace(/<li>/g, '\n  <li>')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

export function splitKeywords(text: string): string[] {
  const seen = new Set<string>()
  return text
    .split(/[,\n;]+/)
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k && !seen.has(k) && seen.add(k))
    .slice(0, 20)
}
