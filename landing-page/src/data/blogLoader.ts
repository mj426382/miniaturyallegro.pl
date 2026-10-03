import type { BlogPostData } from './blogPosts'

/**
 * Lazy access to article bodies.
 *
 * - Browser: each post is its own chunk, fetched only when its page is opened. Before
 *   hydrating a prerendered article the client preloads that one post (see main.tsx) so
 *   the markup matches the server's.
 * - Prerender (SSR): entry-server.tsx fills the cache eagerly from a server-only module.
 */
const cache = new Map<string, BlogPostData>()
const loaders = import.meta.glob<{ default: BlogPostData }>('./blogPosts/*.ts')

export function getCachedPost(slug: string): BlogPostData | undefined {
  return cache.get(slug)
}

export function primePostCache(posts: Iterable<BlogPostData>) {
  for (const post of posts) cache.set(post.slug, post)
}

export async function loadPost(slug: string): Promise<BlogPostData | null> {
  const cached = cache.get(slug)
  if (cached) return cached
  const loader = loaders[`./blogPosts/${slug}.ts`]
  if (!loader) return null
  const mod = await loader()
  cache.set(slug, mod.default)
  return mod.default
}

export function postExists(slug: string): boolean {
  return `./blogPosts/${slug}.ts` in loaders
}
