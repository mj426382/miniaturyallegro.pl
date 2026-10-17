// Server-only: imported by entry-server.tsx so the prerender has every landing page's copy synchronously.
// Never import this from client code – it would pull all landing page copy into the shared bundle (AC-SEO-021).
import type { SeoContent } from './seoContentLoader'

const modules = import.meta.glob<{ default: SeoContent }>('./seoContent/*.ts', { eager: true })

export const allSeoContent: Array<[string, SeoContent]> = Object.entries(modules).map(([file, m]) => [file.replace('./seoContent/', '').replace(/\.ts$/, ''), m.default])
