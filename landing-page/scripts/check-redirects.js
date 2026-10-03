/**
 * SEO safety net for consolidated blog posts.
 *
 * Every blog URL that ever existed must either still be a post or be a permanent
 * redirect to one. This script fails the build when:
 *   - a redirect points to a slug that no longer exists (would 404 → lost rankings)
 *   - a redirect source still exists as a post (shadowed content / loop risk)
 *   - redirects chain (A → B → C) – Google follows chains but loses signal
 *   - a redirect is not a 301/308 permanent redirect
 *   - a slug listed in retired-slugs.json has neither a post nor a redirect
 *
 * Run: node scripts/check-redirects.js  (part of `npm run build` and CI)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf-8'))
const postsDir = resolve(root, 'src/data/blogPosts')
const retiredFile = resolve(root, 'src/data/retired-slugs.json')

const posts = new Set(
  readdirSync(postsDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => {
      const src = readFileSync(resolve(postsDir, f), 'utf-8')
      const m = src.match(/slug:\s*['"]([^'"]+)['"]/)
      return m ? m[1] : f.replace(/\.ts$/, '')
    }),
)
// Posts are discovered from the directory (blogIndex.ts is generated at build time) – no registry to check.
const redirects = (vercel.redirects ?? []).filter((r) => r.source.startsWith('/blog/'))
const map = new Map(redirects.map((r) => [r.source.replace(/^\/blog\//, ''), r.destination.replace(/^\/blog\//, '')]))

const errors = []
const seenSources = new Set()
for (const r of redirects) {
  if (seenSources.has(r.source)) errors.push(`${r.source}: duplicate redirect source (Vercel uses the first one)`)
  seenSources.add(r.source)
  const target = r.destination.replace(/^\/blog\//, '')
  const from = r.source.replace(/^\/blog\//, '')
  const to = r.destination.replace(/^\/blog\//, '')
  const permanent = r.statusCode === 301 || r.statusCode === 308 || r.permanent === true
  if (!permanent) errors.push(`${r.source}: must be a permanent redirect (statusCode 301)`)
  if (!posts.has(to)) errors.push(`${r.source} → ${r.destination}: target post does not exist`)
  if (posts.has(from)) errors.push(`${r.source}: source still exists as a post (remove the redirect or the file)`)
  if (map.has(to)) errors.push(`${r.source} → ${r.destination}: redirect chain (target is itself redirected to /blog/${map.get(to)})`)
  if (from === to) errors.push(`${r.source}: redirects to itself`)
}

// Keep a ledger of every slug that was ever published so a future cleanup cannot silently drop one.
let retired = []
if (existsSync(retiredFile)) retired = JSON.parse(readFileSync(retiredFile, 'utf-8'))
for (const slug of retired) {
  if (!posts.has(slug) && !map.has(slug)) errors.push(`/blog/${slug} was published before but now has neither a post nor a redirect`)
}
const nextRetired = [...new Set([...retired, ...map.keys()])].sort()
if (JSON.stringify(nextRetired) !== JSON.stringify(retired)) {
  if (process.env.CI || process.env.VERCEL) {
    errors.push(`src/data/retired-slugs.json is out of date – run "npm run check:redirects" locally and commit it`)
  } else {
    writeFileSync(retiredFile, JSON.stringify(nextRetired, null, 2) + '\n', 'utf-8')
  }
}

if (errors.length) {
  console.error('❌ Blog redirect check failed:\n - ' + errors.join('\n - '))
  process.exit(1)
}
console.log(`✅ Blog redirects OK (${redirects.length} permanent redirects, ${posts.size} posts, ${nextRetired.length} retired slugs tracked)`)
