/**
 * Copy of the SEO landing pages (spec 10, AC-SEO-014/021), one module per page in ./seoContent/<slug>.ts.
 *
 * Text fields support inline links written as [label](/internal-path) or [label](https://external.url) – rendered by
 * components/RichText.tsx (internal links stay in the same tab, external ones open in a new tab).
 *
 * Like blog posts, each page is its own chunk: the browser preloads the current page's content before hydrating
 * (main.tsx) and fetches it on client-side navigation; the prerender fills the cache eagerly (entry-server.tsx).
 */
export interface SeoTable {
  caption: string
  head: string[]
  rows: string[][]
}

export interface SeoSection {
  heading: string
  paragraphs: string[]
  bullets?: string[]
  /** Ordered steps rendered as <ol>. */
  steps?: string[]
  table?: SeoTable
}

export interface SeoSource {
  label: string
  url: string
}

export interface SeoContent {
  lead: string
  sections: SeoSection[]
  faq: Array<{ q: string; a: string }>
  /** Official pages that back every platform fact on the page (AC-SEO-014). */
  sources: SeoSource[]
}

const cache = new Map<string, SeoContent>()
const loaders = import.meta.glob<{ default: SeoContent }>('./seoContent/*.ts')

export function getCachedSeoContent(slug: string): SeoContent | undefined {
  return cache.get(slug)
}

export function primeSeoContentCache(entries: Iterable<[string, SeoContent]>) {
  for (const [slug, content] of entries) cache.set(slug, content)
}

export async function loadSeoContent(slug: string): Promise<SeoContent | null> {
  const cached = cache.get(slug)
  if (cached) return cached
  const loader = loaders[`./seoContent/${slug}.ts`]
  if (!loader) return null
  const mod = await loader()
  cache.set(slug, mod.default)
  return mod.default
}
