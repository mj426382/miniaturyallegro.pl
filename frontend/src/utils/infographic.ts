/** Limits mirrored from the API (spec 14). */
export const MAX_FEATURES = 6
export const MAX_FEATURE_TEXT = 48
export const MAX_TITLE = 40
const PREFILL_COUNT = 5

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' }

function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e)
    .replace(/\s+/g, ' ')
    .trim()
}

function clamp(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).replace(/[\s.,;:–-]+$/, '') + '…'
}

/**
 * Spec 14: prefill infographic features from the offer copy – the bullet list under
 * "Najważniejsze cechy", or the first list when that heading is missing.
 */
export function featuresFromDescription(html: string | null | undefined): string[] {
  if (!html) return []
  const section = html.match(/<h2>\s*Najważniejsze cechy\s*<\/h2>\s*<ul>([\s\S]*?)<\/ul>/i) ?? html.match(/<ul>([\s\S]*?)<\/ul>/i)
  if (!section) return []
  return [...section[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)]
    .map((m) => clamp(plain(m[1]), MAX_FEATURE_TEXT))
    .filter(Boolean)
    .slice(0, PREFILL_COUNT)
}

/** Accepts "12,5" and "12.5"; returns undefined for empty input and NaN for garbage. */
export function parseMeasure(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return /^\d+([.,]\d+)?$/.test(trimmed) ? Number(trimmed.replace(',', '.')) : NaN
}
