/**
 * SSG Prerender script for AllGrafika.pl
 *
 * Runs after `vite build` and generates per-route static HTML files with
 * correct canonical, title, meta description, OG tags, Twitter card,
 * and JSON-LD Article schema baked into the HTML <head>.
 *
 * Vercel serves static files before applying the SPA rewrite, so each
 * generated dist/blog/<slug>/index.html is served directly to crawlers
 * without needing JavaScript execution — fixing the "Alternate page with
 * proper canonical tag" problem in Google Search Console.
 *
 * Run: node scripts/prerender.js  (automatically called by npm run build)
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SITE_URL = 'https://allgrafika.pl'
const distDir = resolve(__dirname, '../dist')
const blogDir = resolve(__dirname, '../src/data/blogPosts')

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Extract a single-quoted or double-quoted TS string field value. */
function extractField(content, field) {
  const sq = content.match(new RegExp(`(?:^|[\\s,{])${field}:\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'm'))
  if (sq) return sq[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\')
  const dq = content.match(new RegExp(`(?:^|[\\s,{])${field}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'm'))
  if (dq) return dq[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  return null
}

/** Read SEO-relevant metadata from a blog post TS source file. */
function readPostMeta(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  return {
    slug: extractField(content, 'slug'),
    title: extractField(content, 'title'),
    excerpt: extractField(content, 'excerpt'),
    publishedAt: extractField(content, 'publishedAt'),
    modifiedAt: extractField(content, 'modifiedAt'),
    category: extractField(content, 'category'),
    readTime: content.match(/readTime:\s*(\d+)/)?.[1] ?? '5',
  }
}

/**
 * Build the full <head> block for a page.
 * All page-specific SEO tags come from `page`; static tags (charset, viewport,
 * fonts, favicon) are preserved from the base index.html.
 */
function buildHeadTags(page) {
  const lines = []
  lines.push(`  <title>${esc(page.title)}</title>`)
  lines.push(`  <meta name="description" content="${esc(page.description)}" />`)
  lines.push(`  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />`)
  lines.push(`  <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />`)
  lines.push(`  <link rel="canonical" href="${esc(page.canonical)}" />`)

  // Open Graph
  lines.push(`  <meta property="og:type" content="${page.ogType ?? 'website'}" />`)
  lines.push(`  <meta property="og:title" content="${esc(page.title)}" />`)
  lines.push(`  <meta property="og:description" content="${esc(page.description)}" />`)
  lines.push(`  <meta property="og:url" content="${esc(page.canonical)}" />`)
  lines.push(`  <meta property="og:site_name" content="AllGrafika.pl" />`)
  lines.push(`  <meta property="og:locale" content="pl_PL" />`)
  lines.push(`  <meta property="og:image" content="${SITE_URL}/logo.webp" />`)
  lines.push(`  <meta property="og:image:width" content="1200" />`)
  lines.push(`  <meta property="og:image:height" content="630" />`)

  // Twitter card
  lines.push(`  <meta name="twitter:card" content="summary_large_image" />`)
  lines.push(`  <meta name="twitter:title" content="${esc(page.title)}" />`)
  lines.push(`  <meta name="twitter:description" content="${esc(page.description)}" />`)
  lines.push(`  <meta name="twitter:image" content="${SITE_URL}/logo.webp" />`)

  // Article-specific
  if (page.publishedAt) {
    lines.push(`  <meta property="article:published_time" content="${page.publishedAt}" />`)
  }
  if (page.modifiedAt) {
    lines.push(`  <meta property="article:modified_time" content="${page.modifiedAt}" />`)
  }

  // JSON-LD
  if (page.schema) {
    lines.push(`  <script type="application/ld+json">${JSON.stringify(page.schema)}</script>`)
  }

  return lines.join('\n')
}

/**
 * Inject page-specific head tags into the base HTML.
 *
 * Strategy: strip the SEO tags from index.html that vary per page (title,
 * description, keywords, robots, googlebot, canonical) then inject the
 * correct ones just before </head>.
 */
function buildPageHtml(baseHtml, headTags) {
  let html = baseHtml
  // Remove variable tags that will be replaced
  html = html.replace(/<title>[^<]*<\/title>\s*/i, '')
  html = html.replace(/<meta\s+name="description"[^>]*>\s*/i, '')
  html = html.replace(/<meta\s+name="keywords"[^>]*>\s*/i, '')
  html = html.replace(/<meta\s+name="robots"[^>]*>\s*/i, '')
  html = html.replace(/<meta\s+name="googlebot"[^>]*>\s*/i, '')
  html = html.replace(/<link\s+rel="canonical"[^>]*>\s*/i, '')
  // Remove any existing OG/Twitter meta tags from index.html (blog pages set their own)
  html = html.replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, '')
  html = html.replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, '')
  // Inject new tags before </head>
  html = html.replace('</head>', headTags + '\n</head>')
  return html
}

function writeRoute(routePath, html) {
  const dir = resolve(distDir, ...routePath.split('/').filter(Boolean))
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'index.html'), html, 'utf-8')
}

// ── Main ──────────────────────────────────────────────────────────────────────

const baseHtml = readFileSync(resolve(distDir, 'index.html'), 'utf-8')

// Read all blog posts
const posts = readdirSync(blogDir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => readPostMeta(resolve(blogDir, f)))
  .filter((p) => p.slug && p.title)

console.log(`\n🔄 Prerendering ${posts.length} blog posts + static routes…`)

// ── Blog posts ────────────────────────────────────────────────────────────────
for (const post of posts) {
  const url = `${SITE_URL}/blog/${post.slug}`
  const datePublished = post.publishedAt ?? new Date().toISOString().split('T')[0]
  const dateModified = post.modifiedAt ?? datePublished

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt ?? '',
    datePublished,
    dateModified,
    author: {
      '@type': 'Organization',
      name: 'AllGrafika.pl',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'AllGrafika.pl',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.webp`,
      },
    },
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    articleSection: post.category ?? 'Blog',
    image: `${SITE_URL}/logo.webp`,
  }

  const page = {
    title: `${post.title} | AllGrafika.pl`,
    description: post.excerpt ?? '',
    canonical: url,
    ogType: 'article',
    publishedAt: datePublished,
    modifiedAt: dateModified,
    schema,
  }

  writeRoute(`blog/${post.slug}`, buildPageHtml(baseHtml, buildHeadTags(page)))
  console.log(`  ✓ /blog/${post.slug}`)
}

// ── /blog ─────────────────────────────────────────────────────────────────────
const blogMostRecentDate = posts
  .map((p) => p.publishedAt ?? '')
  .sort()
  .reverse()[0] ?? new Date().toISOString().split('T')[0]

const blogBreadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Strona główna', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
  ],
}

writeRoute(
  'blog',
  buildPageHtml(
    baseHtml,
    buildHeadTags({
      title: 'Blog – Grafiki produktowe, Zdjęcia Allegro | AllGrafika.pl',
      description:
        'Porady dotyczące grafik produktowych Allegro, zdjęć produktowych i sprzedaży online. Dowiedz się jak zwiększyć sprzedaż na Allegro.',
      canonical: `${SITE_URL}/blog`,
      ogType: 'website',
      schema: blogBreadcrumbSchema,
    }),
  ),
)
console.log('  ✓ /blog')

// ── /regulamin ────────────────────────────────────────────────────────────────
writeRoute(
  'regulamin',
  buildPageHtml(
    baseHtml,
    buildHeadTags({
      title: 'Regulamin | AllGrafika.pl',
      description:
        'Regulamin korzystania z serwisu AllGrafika.pl – profesjonalne grafiki produktowe AI dla sprzedawców Allegro.',
      canonical: `${SITE_URL}/regulamin`,
      ogType: 'website',
    }),
  ),
)
console.log('  ✓ /regulamin')

// ── /polityka-prywatnosci ─────────────────────────────────────────────────────
writeRoute(
  'polityka-prywatnosci',
  buildPageHtml(
    baseHtml,
    buildHeadTags({
      title: 'Polityka Prywatności | AllGrafika.pl',
      description: 'Polityka prywatności AllGrafika.pl – jak chronimy Twoje dane osobowe.',
      canonical: `${SITE_URL}/polityka-prywatnosci`,
      ogType: 'website',
    }),
  ),
)
console.log('  ✓ /polityka-prywatnosci')

console.log(`\n✅ Prerendering complete — ${posts.length + 3} routes generated\n`)
