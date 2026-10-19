import type { ComponentType } from 'react'

/**
 * Lazy access to the photo checker page (spec 25, AC-TOOL-008): the page and the analysis code are one chunk that only
 * the tool's route fetches. The prerender primes the cache eagerly (entry-server.tsx) and main.tsx preloads the chunk
 * before hydrating the tool's URL, so the hydrated tree equals the static HTML.
 */
let cached: ComponentType | undefined

export function getCachedPhotoChecker(): ComponentType | undefined {
  return cached
}

export function primePhotoChecker(page: ComponentType) {
  cached = page
}

export async function loadPhotoChecker(): Promise<ComponentType> {
  if (cached) return cached
  const mod = await import('../pages/PhotoCheckerPage')
  cached = mod.default
  return cached
}
