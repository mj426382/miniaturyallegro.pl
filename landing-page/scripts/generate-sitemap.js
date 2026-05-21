/**
 * Dynamic sitemap generator for AllGrafika.pl
 * Reads blog post slugs + publishedAt dates from the blogPosts directory
 * and generates public/sitemap.xml with correct per-post lastmod dates.
 * Run: node scripts/generate-sitemap.js
 */

import { writeFileSync, readdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_URL = 'https://allgrafika.pl';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract a single-quoted or double-quoted TS string field value. */
function extractField(content, field) {
  const sq = content.match(new RegExp(`(?:^|[\\s,{])${field}:\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'm'));
  if (sq) return sq[1].replace(/\\'/g, "'");
  const dq = content.match(new RegExp(`(?:^|[\\s,{])${field}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'm'));
  if (dq) return dq[1].replace(/\\"/g, '"');
  return null;
}

// ── Read blog posts ───────────────────────────────────────────────────────────

const blogPostsDir = resolve(__dirname, '../src/data/blogPosts');
const blogPosts = readdirSync(blogPostsDir)
  .filter(f => f.endsWith('.ts'))
  .map(f => {
    const content = readFileSync(resolve(blogPostsDir, f), 'utf-8');
    const slug = extractField(content, 'slug') ?? f.replace('.ts', '');
    const publishedAt = extractField(content, 'publishedAt');
    const modifiedAt = extractField(content, 'modifiedAt');
    // Use modifiedAt if available, otherwise publishedAt, otherwise today
    const lastmod = modifiedAt ?? publishedAt ?? new Date().toISOString().split('T')[0];
    return { slug, lastmod };
  })
  .filter(p => p.slug);

// Most recent blog post date for the /blog listing page
const mostRecentPostDate = blogPosts
  .map(p => p.lastmod)
  .sort()
  .reverse()[0] ?? new Date().toISOString().split('T')[0];

// ── Static pages ──────────────────────────────────────────────────────────────

const staticPages = [
  { path: '/',                     lastmod: mostRecentPostDate, priority: '1.0', changefreq: 'weekly'  },
  { path: '/blog',                 lastmod: mostRecentPostDate, priority: '0.9', changefreq: 'weekly'  },
  { path: '/regulamin',            lastmod: '2026-01-01',       priority: '0.3', changefreq: 'yearly'  },
  { path: '/polityka-prywatnosci', lastmod: '2026-01-01',       priority: '0.3', changefreq: 'yearly'  },
];

// ── Build ─────────────────────────────────────────────────────────────────────

function buildUrlEntry(loc, lastmod, changefreq, priority) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function generateSitemap() {
  const entries = [];

  for (const page of staticPages) {
    entries.push(buildUrlEntry(`${SITE_URL}${page.path}`, page.lastmod, page.changefreq, page.priority));
  }

  for (const post of blogPosts) {
    entries.push(buildUrlEntry(`${SITE_URL}/blog/${post.slug}`, post.lastmod, 'monthly', '0.7'));
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

  const outputPath = resolve(__dirname, '../public/sitemap.xml');
  writeFileSync(outputPath, sitemap, 'utf-8');

  console.log(`✅ Sitemap generated with ${entries.length} URLs → public/sitemap.xml`);
  console.log(`   Static pages: ${staticPages.length}`);
  console.log(`   Blog posts:   ${blogPosts.length}`);
}

generateSitemap();
