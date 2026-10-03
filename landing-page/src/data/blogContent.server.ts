// Server-only: imported by entry-server.tsx so the prerender has every article body
// synchronously. Never import this from client code – it would pull all posts into the bundle.
import type { BlogPostData } from './blogPosts'

const modules = import.meta.glob<{ default: BlogPostData }>('./blogPosts/*.ts', { eager: true })

export const allPosts: BlogPostData[] = Object.values(modules).map((m) => m.default)
