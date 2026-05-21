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
    { loc: BASE_URL,            lastmod: mostRecent,    priority: '1.0', changefreq: 'weekly'  },
    { loc: `${BASE_URL}/blog`,  lastmod: mostRecent,    priority: '0.9', changefreq: 'weekly'  },
    { loc: `${BASE_URL}/regulamin`,           lastmod: '2026-01-01', priority: '0.3', changefreq: 'yearly' },
    { loc: `${BASE_URL}/polityka-prywatnosci`, lastmod: '2026-01-01', priority: '0.3', changefreq: 'yearly' },
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
    ...allUrls.map(
      (u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
    ),
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

export default defineConfig({
  plugins: [react(), sitemapPlugin()],
  server: {
    port: 5174,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
