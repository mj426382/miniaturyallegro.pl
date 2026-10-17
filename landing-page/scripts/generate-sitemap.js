/**
 * Sitemap generator for AllGrafika.pl – the only source of sitemap.xml (spec 10, AC-SEO-018).
 * Reads blog post slugs + dates from the blogPosts directory and the landing pages from src/data/seoPages.ts and
 * writes public/sitemap.xml (Vite copies it into dist/). Every <lastmod> is the date the content changed – never the
 * build date: posts use modifiedAt/publishedAt, landing pages SEO_PAGES_UPDATED, the home page the newer of
 * HOME_UPDATED (src/data/site.ts) and the newest post (the home page lists the latest posts).
 * Run: node scripts/generate-sitemap.js
 */

import { writeFileSync, readdirSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_URL = 'https://allgrafika.pl'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract a single-quoted or double-quoted TS string field value. */
function extractField(content, field) {
  const sq = content.match(new RegExp(`(?:^|[\\s,{])${field}:\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'm'))
  if (sq) return sq[1].replace(/\\'/g, "'")
  const dq = content.match(new RegExp(`(?:^|[\\s,{])${field}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'm'))
  if (dq) return dq[1].replace(/\\"/g, '"')
  return null
}

// ── Read blog posts ───────────────────────────────────────────────────────────

const blogPostsDir = resolve(__dirname, '../src/data/blogPosts')
const blogPosts = readdirSync(blogPostsDir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => {
    const content = readFileSync(resolve(blogPostsDir, f), 'utf-8')
    const slug = extractField(content, 'slug') ?? f.replace('.ts', '')
    const publishedAt = extractField(content, 'publishedAt')
    const modifiedAt = extractField(content, 'modifiedAt')
    // Use modifiedAt if available, otherwise publishedAt
    if (!publishedAt) throw new Error(`${f}: missing publishedAt`)
    const lastmod = modifiedAt ?? publishedAt
    return { slug, lastmod, publishedAt }
  })
  .filter((p) => p.slug)

// Newest post date: /blog lists every post with its date.
const newestPublished = blogPosts
  .map((p) => p.publishedAt)
  .sort()
  .reverse()[0]
const mostRecentPostDate = blogPosts
  .map((p) => p.lastmod)
  .sort()
  .reverse()[0]
if (!mostRecentPostDate) throw new Error('No blog posts found')

const siteSource = readFileSync(resolve(__dirname, '../src/data/site.ts'), 'utf-8')
const homeUpdated = siteSource.match(/HOME_UPDATED = '(\d{4}-\d{2}-\d{2})'/)?.[1]
if (!homeUpdated) throw new Error('HOME_UPDATED not found in src/data/site.ts')
const homeLastmod = [homeUpdated, newestPublished].filter(Boolean).sort().reverse()[0]

// ── Static pages ──────────────────────────────────────────────────────────────

const seoSource = readFileSync(resolve(__dirname, '../src/data/seoPages.ts'), 'utf-8')

const staticPages = [
  { path: '/', lastmod: homeLastmod, priority: '1.0', changefreq: 'weekly' },
  { path: '/blog', lastmod: mostRecentPostDate, priority: '0.9', changefreq: 'weekly' },
  // SEO landing pages (spec 10, AC-SEO-007) – one `path:` line per page in src/data/seoPages.ts
  ...[...seoSource.matchAll(/^\s*path: '(\/[a-z0-9-]+)',$/gm)].map((m) => ({
    path: m[1],
    lastmod: seoSource.match(/SEO_PAGES_UPDATED = '([\d-]+)'/)[1],
    priority: '0.9',
    changefreq: 'monthly',
  })),
]

// ── Build ─────────────────────────────────────────────────────────────────────

function buildUrlEntry(loc, lastmod, changefreq, priority) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

function generateSitemap() {
  const entries = []

  for (const page of staticPages) {
    entries.push(buildUrlEntry(`${SITE_URL}${page.path}`, page.lastmod, page.changefreq, page.priority))
  }

  for (const post of blogPosts) {
    entries.push(buildUrlEntry(`${SITE_URL}/blog/${post.slug}`, post.lastmod, 'monthly', '0.7'))
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`

  const outputPath = resolve(__dirname, '../public/sitemap.xml')
  writeFileSync(outputPath, sitemap, 'utf-8')

  console.log(`✅ Sitemap generated with ${entries.length} URLs → public/sitemap.xml`)
  console.log(`   Static pages: ${staticPages.length}`)
  console.log(`   Blog posts:   ${blogPosts.length}`)
}

generateSitemap()
