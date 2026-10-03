import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const BASE_URL = 'https://allgrafika.pl'

interface PostMeta {
  slug: string
  lastmod: string
}

function extractField(content: string, field: string): string | null {
  const sq = content.match(new RegExp(`(?:^|[\\s,{])${field}:\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'm'))
  if (sq) return sq[1].replace(/\\'/g, "'")
  const dq = content.match(new RegExp(`(?:^|[\\s,{])${field}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'm'))
  if (dq) return dq[1].replace(/\\"/g, '"')
  return null
}

function getBlogPosts(): PostMeta[] {
  const blogDir = path.resolve(__dirname, 'src/data/blogPosts')
  if (!fs.existsSync(blogDir)) return []
  return fs
    .readdirSync(blogDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => {
      const content = fs.readFileSync(path.join(blogDir, f), 'utf-8')
      const slug = extractField(content, 'slug') ?? f.replace('.ts', '')
      const publishedAt = extractField(content, 'publishedAt')
      const modifiedAt = extractField(content, 'modifiedAt')
      const lastmod = modifiedAt ?? publishedAt ?? new Date().toISOString().split('T')[0]
      return { slug, lastmod }
    })
    .filter((p): p is PostMeta => Boolean(p.slug))
}

function buildSitemapXml(): string {
  const posts = getBlogPosts()
  const mostRecent =
    posts
      .map((p) => p.lastmod)
      .sort()
      .reverse()[0] ?? new Date().toISOString().split('T')[0]

  const staticPages = [
    { loc: BASE_URL, lastmod: new Date().toISOString().split('T')[0], priority: '1.0', changefreq: 'weekly' },
    { loc: `${BASE_URL}/blog`, lastmod: mostRecent, priority: '0.9', changefreq: 'weekly' },
  ]

  const allUrls = [
    ...staticPages,
    ...posts.map((p) => ({
      loc: `${BASE_URL}/blog/${p.slug}`,
      lastmod: p.lastmod,
      priority: '0.7',
      changefreq: 'monthly',
    })),
  ]

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...allUrls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`),
    '</urlset>',
  ].join('\n')
}

function sitemapPlugin(): Plugin {
  return {
    name: 'vite-plugin-sitemap',
    closeBundle() {
      const xml = buildSitemapXml()
      const outDir = path.resolve(__dirname, 'dist')
      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), xml, 'utf-8')
      console.log(`✅ sitemap.xml generated (${xml.match(/<url>/g)?.length ?? 0} URLs)`)
    },
    configureServer(server) {
      server.middlewares.use('/sitemap.xml', (_req, res) => {
        res.setHeader('Content-Type', 'application/xml; charset=utf-8')
        res.end(buildSitemapXml())
      })
    },
  }
}

/**
 * `vite preview` falls back to dist/index.html for every extension-less URL (SPA mode),
 * which would serve the prerendered home page for /blog or /regulamin and break hydration.
 * Vercel serves dist/<route>/index.html for those URLs, so the preview server does the same –
 * the Playwright hydration tests and Lighthouse then measure what production really serves.
 */
function prerenderedRoutesPlugin(): Plugin {
  return {
    name: 'vite-plugin-prerendered-routes',
    configurePreviewServer(server) {
      const outDir = path.resolve(__dirname, 'dist')
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '/').split('?')[0]
        if (url === '/' || path.extname(url)) return next()
        const clean = url.replace(/\/+$/, '')
        const file = path.join(outDir, clean, 'index.html')
        if (fs.existsSync(file)) {
          req.url = `${clean}/index.html`
          return next()
        }
        const notFound = path.join(outDir, '404.html')
        if (fs.existsSync(notFound)) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(fs.readFileSync(notFound))
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), sitemapPlugin(), prerenderedRoutesPlugin()],
  server: {
    port: 5174,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  ssr: {
    // CommonJS packages must be bundled into the SSR entry so scripts/prerender.js can import it as ESM.
    noExternal: ['react-helmet-async'],
  },
})
