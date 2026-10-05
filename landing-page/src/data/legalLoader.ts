import type { ComponentType } from 'react'

/**
 * Lazy access to the legal documents (spec 17, AC-PERF-002).
 *
 * The full text stays in the prerendered HTML (entry-server.tsx primes the cache eagerly), but the
 * browser fetches the ~50 KB chunk only on /regulamin and /polityka-prywatnosci – main.tsx preloads it
 * before hydrating those routes so the hydrated tree equals the static HTML.
 */
export type LegalDoc = 'regulamin' | 'polityka'

const loaders: Record<LegalDoc, () => Promise<{ default: ComponentType }>> = {
  regulamin: () => import('../legal/RegulaminContent'),
  polityka: () => import('../legal/PolitykaContent'),
}
const cache = new Map<LegalDoc, ComponentType>()

export const LEGAL_PATHS: Record<string, LegalDoc> = {
  '/regulamin': 'regulamin',
  '/polityka-prywatnosci': 'polityka',
}

export function getCachedLegal(doc: LegalDoc): ComponentType | undefined {
  return cache.get(doc)
}

export function primeLegalCache(docs: Partial<Record<LegalDoc, ComponentType>>) {
  for (const [doc, component] of Object.entries(docs) as Array<[LegalDoc, ComponentType]>) cache.set(doc, component)
}

export async function loadLegal(doc: LegalDoc): Promise<ComponentType> {
  const cached = cache.get(doc)
  if (cached) return cached
  const mod = await loaders[doc]()
  cache.set(doc, mod.default)
  return mod.default
}
