import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const BASE_URL = 'https://allgrafika.pl'

function getBlogSlugs(): string[] {
  const blogDir = path.resolve(__dirname, 'src/data/blogPosts')
  if (!fs.existsSync(blogDir)) return []
  return fs
    .readdirSync(blogDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => {
      const content = fs.readFileSync(path.join(blogDir, f), 'utf-8')
      const match = content.match(/slug:\s*['"]([^'"]+)['"]/)
      return match ? match[1] : null
    })
    .filter(Boolean) as string[]
}

function buildSitemapXml(): string {
  const slugs = getBlogSlugs()
  const now = new Date().toISOString().split('T')[0]

  const urls = [
    { loc: BASE_URL, priority: '1.0', changefreq: 'weekly' },
    { loc: `${BASE_URL}/blog`, priority: '0.8', changefreq: 'weekly' },
    ...slugs.map((slug) => ({
      loc: `${BASE_URL}/blog/${slug}`,
      priority: '0.7',
      changefreq: 'monthly',
    })),
  ]

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      (u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
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
