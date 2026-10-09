/**
 * SSG prerender for AllGrafika.pl
 *
 * Runs after `vite build` (client) and `vite build --ssr` (server bundle) and
 * writes a fully rendered HTML file for every route:
 *   dist/index.html, dist/blog/index.html, dist/blog/<slug>/index.html,
 *   dist/regulamin/index.html, dist/polityka-prywatnosci/index.html, dist/404.html
 *
 * The rendered page contains the real content (not an empty <div id="root">)
 * plus the per-route <head> produced by react-helmet-async (title, description,
 * canonical, Open Graph, JSON-LD). Crawlers index the page without executing
 * JavaScript and users see content before the bundle loads; the client then
 * hydrates. Vercel serves these static files before applying the SPA rewrite.
 *
 * Run: node scripts/prerender.js  (automatically called by npm run build)
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(__dirname, '../dist')
const ssrDir = resolve(__dirname, '../dist-ssr')
const blogDir = resolve(__dirname, '../src/data/blogPosts')

function extractField(content, field) {
  const sq = content.match(new RegExp(`(?:^|[\\s,{])${field}:\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'm'))
  if (sq) return sq[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\')
  const dq = content.match(new RegExp(`(?:^|[\\s,{])${field}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'm'))
  if (dq) return dq[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  return null
}

/** Removes the generic SEO tags from index.html – every route provides its own via Helmet. */
function stripVariableHeadTags(html) {
  return html
    .replace(/<title>[^<]*<\/title>\s*/i, '')
    .replace(/<meta\s+name="(description|keywords|robots|googlebot)"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/i, '')
    .replace(/<meta\s+property="(og|article):[^"]*"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, '')
}

function buildPage(template, { html, head }) {
  let out = stripVariableHeadTags(template)
  out = out.replace('</head>', `${head}\n  </head>`)
  out = out.replace('<div id="root"></div>', `<div id="root">${html}</div>`)
  return out
}

function writeRoute(routePath, html) {
  const dir = resolve(distDir, ...routePath.split('/').filter(Boolean))
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'index.html'), html, 'utf-8')
}

async function main() {
  const entry = resolve(ssrDir, 'entry-server.js')
  if (!existsSync(entry)) {
    throw new Error(`SSR bundle not found at ${entry}. Run "vite build --ssr src/entry-server.tsx --outDir dist-ssr" first.`)
  }
  const { render } = await import(pathToFileURL(entry).href)
  const template = readFileSync(resolve(distDir, 'index.html'), 'utf-8')

  const slugs = readdirSync(blogDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => extractField(readFileSync(resolve(blogDir, f), 'utf-8'), 'slug'))
    .filter(Boolean)

  const seoPaths = [...readFileSync(resolve(__dirname, '../src/data/seoPages.ts'), 'utf-8').matchAll(/^\s*path: '(\/[a-z0-9-]+)',$/gm)].map((m) => m[1])
  if (seoPaths.length === 0) throw new Error('No SEO landing pages found in src/data/seoPages.ts')

  const routes = ['/', '/blog', '/regulamin', '/polityka-prywatnosci', ...seoPaths, ...slugs.map((s) => `/blog/${s}`)]
  console.log(`\n🔄 Prerendering ${routes.length} routes…`)

  for (const route of routes) {
    const rendered = render(route)
    if (!rendered.html || rendered.html.length < 500) {
      throw new Error(`Route ${route} rendered suspiciously little HTML (${rendered.html.length} chars)`)
    }
    writeRoute(route, buildPage(template, rendered))
  }

  // Static 404 page: vercel.json has no SPA catch-all, so Vercel serves this with a real 404 status.
  writeFileSync(resolve(distDir, '404.html'), buildPage(template, render('/this-page-does-not-exist')), 'utf-8')

  rmSync(ssrDir, { recursive: true, force: true })
  console.log(`✅ Prerendering complete — ${routes.length} routes + 404.html\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
