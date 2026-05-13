/**
 * Dynamic sitemap generator for AllGrafika.pl
 * Reads blog post slugs from the blogPosts directory and generates sitemap.xml
 * Run: node scripts/generate-sitemap.js
 */

import { writeFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_URL = 'https://allgrafika.pl';
const today = new Date().toISOString().split('T')[0];

// Read blog post slugs from the blogPosts directory
const blogPostsDir = resolve(__dirname, '../src/data/blogPosts');
const blogSlugs = readdirSync(blogPostsDir)
  .filter(f => f.endsWith('.ts'))
  .map(f => f.replace('.ts', ''));

// Static pages with priorities and change frequencies
const staticPages = [
  { path: '/',                    priority: '1.0', changefreq: 'weekly' },
  { path: '/blog',                priority: '0.9', changefreq: 'weekly' },
  { path: '/regulamin',           priority: '0.3', changefreq: 'yearly' },
  { path: '/polityka-prywatnosci', priority: '0.3', changefreq: 'yearly' },
];

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

  // Static pages
  for (const page of staticPages) {
    entries.push(buildUrlEntry(
      `${SITE_URL}${page.path}`,
      today,
      page.changefreq,
      page.priority
    ));
  }

  // Blog posts
  for (const slug of blogSlugs) {
    entries.push(buildUrlEntry(
      `${SITE_URL}/blog/${slug}`,
      today,
      'monthly',
      '0.7'
    ));
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
  console.log(`   Blog posts:   ${blogSlugs.length}`);
  blogSlugs.forEach(s => console.log(`     /blog/${s}`));
}

generateSitemap();
