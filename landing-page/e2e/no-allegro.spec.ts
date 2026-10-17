import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { blogIndex } from '../src/data/blogIndex'
import { seoPages } from '../src/data/seoPages'

/**
 * Spec 10 (owner decision 2026-10-17): the tool no longer supports Allegro. The site, the blog, the blog bot and the
 * legal texts must not mention it, and every old Allegro URL must keep working through a 301 (AC-SEO-011..013).
 */
const landing = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const UNSUPPORTED = /allegro/i

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop-chrome', 'prerendered HTML and scripts are device-independent')
})

test('[AC-SEO-011] no page, post or sitemap entry mentions Allegro and old Allegro URLs are 301s', async ({ page, request }) => {
  const routes = ['/', '/blog', '/regulamin', '/polityka-prywatnosci', '/nie-ma-takiej-strony', ...seoPages.map((p) => p.path), ...blogIndex.map((p) => `/blog/${p.slug}`)]
  for (const route of routes) {
    const html = await (await request.get(route)).text()
    expect(html.match(UNSUPPORTED)?.[0], route).toBeUndefined()
  }
  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).not.toMatch(UNSUPPORTED)
  for (const post of blogIndex) expect(`${post.slug} ${post.title} ${post.excerpt}`).not.toMatch(UNSUPPORTED)

  // The hydrated home page (client render) is clean too, and the footer carries a neutral trademark note.
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(await page.locator('body').innerText()).not.toMatch(UNSUPPORTED)
  await expect(page.locator('footer')).toContainText('są znakami towarowymi ich właścicieli')

  // Every old URL still resolves: a post or a single permanent redirect to an existing page.
  const vercel = JSON.parse(readFileSync(resolve(landing, 'vercel.json'), 'utf-8')) as { redirects: { source: string; destination: string; statusCode?: number }[] }
  const target = new Map(vercel.redirects.map((r) => [r.source, r]))
  const slugs = new Set(blogIndex.map((p) => p.slug))
  const retired = JSON.parse(readFileSync(resolve(landing, 'src/data/retired-slugs.json'), 'utf-8')) as string[]
  for (const slug of retired.filter((s) => UNSUPPORTED.test(s))) {
    const r = target.get(`/blog/${slug}`)
    expect(r?.statusCode, slug).toBe(301)
    const to = r!.destination.replace('/blog/', '')
    expect(slugs.has(to), `${slug} → ${to}`).toBe(true)
    expect(to).not.toMatch(UNSUPPORTED)
  }
  expect(target.get('/blog/wymiary-zdjec-allegro-rozmiary-piksele-waga-bledy')?.destination).toBe('/blog/wymiary-zdjec-olx-vinted-ebay-amazon')
  expect(target.get('/blog/zasady-zdjec-na-allegro')?.destination).toBe('/blog/zdjecie-glowne-oferty-wymagania-platform')
  expect(target.get('/zdjecia-ai-allegro')).toMatchObject({ destination: '/zdjecia-ai-do-ofert', statusCode: 301 })
  expect(seoPages.map((p) => p.path)).toContain('/zdjecia-ai-do-ofert')
})

test('[AC-SEO-012] the blog bot targets other platforms and rejects an article about Allegro', () => {
  const plan = readFileSync(resolve(landing, 'scripts/blog-keywords.json'), 'utf-8')
  expect(plan).not.toMatch(UNSUPPORTED)
  expect(readFileSync(resolve(landing, 'scripts/blog-keywords-used.json'), 'utf-8')).not.toMatch(UNSUPPORTED)
  const script = resolve(landing, 'scripts/generate-blog-post.py')
  expect(readFileSync(script, 'utf-8')).toContain('dla sprzedawców na OLX, Vinted, eBay, Amazon i we własnych sklepach internetowych')

  const sample = JSON.parse(readFileSync(resolve(landing, 'scripts/fixtures/blog-post.sample.json'), 'utf-8'))
  expect(JSON.stringify(sample)).not.toMatch(UNSUPPORTED)
  const fixture = resolve(landing, 'test-results/unsupported-platform-article.json')
  const slug = 'zdjecia-oferty-na-nowy-sezon-poradnik'
  writeFileSync(fixture, JSON.stringify({ ...sample, slug, title: 'Zdjęcia oferty na nowy sezon', content: `${sample.content}\n\nTe same zdjęcia wstawisz też na Allegro.` }), 'utf-8')
  const sitemap = resolve(landing, 'public/sitemap.xml')
  const sitemapBefore = readFileSync(sitemap, 'utf-8')
  let output = ''
  try {
    execFileSync('python3', [script], { env: { ...process.env, BLOG_DRY_RUN: '1', BLOG_FIXTURE: fixture, PYTHONIOENCODING: 'utf-8' }, encoding: 'utf-8' })
  } catch (err: unknown) {
    output = String((err as { stdout?: string }).stdout)
  } finally {
    writeFileSync(sitemap, sitemapBefore, 'utf-8')
    unlinkSync(fixture)
  }
  expect(output).toContain('artykuł wspomina Allegro')
  expect(existsSync(resolve(landing, `src/data/blogPosts/${slug}.ts`))).toBe(false)
})

test('[AC-SEO-013] the legal texts drop the marketplace integration and match the app copies', async ({ request }) => {
  for (const file of ['RegulaminContent.tsx', 'PolitykaContent.tsx', 'entity.ts']) {
    const site = readFileSync(resolve(landing, 'src/legal', file), 'utf-8')
    const app = readFileSync(resolve(landing, '../frontend/src/legal', file), 'utf-8')
    expect(app, `frontend/src/legal/${file} differs – run node frontend/scripts/sync-legal.js`).toBe(site)
  }
  const terms = await (await request.get('/regulamin')).text()
  const privacy = await (await request.get('/polityka-prywatnosci')).text()
  for (const html of [terms, privacy]) {
    expect(html).not.toMatch(UNSUPPORTED)
    expect(html).not.toMatch(/OAuth|tokeny dostępu|połącz(yć|enie) Konto/i)
  }
  // React separates text and interpolations with <!-- --> in the prerendered HTML.
  const text = (html: string) => html.replace(/<!-- -->/g, '')
  expect(text(terms)).toContain('Zmiana z 17 października 2026 r.')
  expect(text(privacy)).toContain('ostatnia zmiana: 17 października 2026 r.')
})
