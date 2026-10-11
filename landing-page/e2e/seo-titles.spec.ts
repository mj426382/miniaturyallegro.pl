import { readFileSync } from 'fs'
import { test, expect } from '@playwright/test'
import { blogIndex } from '../src/data/blogIndex'
import { seoPages } from '../src/data/seoPages'
import { BRAND_SUFFIX, MAX_TITLE_LENGTH, pageTitle } from '../src/utils/pageTitle'

/** Spec 10: title length rule (AC-SEO-009) and consolidated blog posts (AC-SEO-010). */

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop-chrome', 'prerendered HTML is device-independent')
})

function decode(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function headTitle(html: string) {
  return decode(html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? '')
}

test('[AC-SEO-009] the brand suffix is added only when the whole title fits in 60 characters', async ({ request }) => {
  const fits = 'x'.repeat(MAX_TITLE_LENGTH - BRAND_SUFFIX.length)
  expect(pageTitle(fits)).toBe(`${fits}${BRAND_SUFFIX}`)
  expect(pageTitle(`${fits}y`)).toBe(`${fits}y`)

  for (const post of blogIndex) {
    expect(post.title.length, `${post.slug}: ${post.title}`).toBeLessThanOrEqual(MAX_TITLE_LENGTH)
    expect(post.excerpt.length, `${post.slug}: meta description`).toBeLessThanOrEqual(160)
  }

  const routes = ['/blog', '/regulamin', '/polityka-prywatnosci', ...seoPages.map((p) => p.path), ...blogIndex.map((p) => `/blog/${p.slug}`)]
  for (const route of routes) {
    const res = await request.get(route)
    expect(res.status(), route).toBe(200)
    const title = headTitle(await res.text())
    expect(title.length, `${route}: ${title}`).toBeGreaterThan(0)
    expect(title.length, `${route}: ${title}`).toBeLessThanOrEqual(MAX_TITLE_LENGTH)
  }

  for (const post of blogIndex) {
    const title = headTitle(await (await request.get(`/blog/${post.slug}`)).text())
    expect(title, post.slug).toBe(pageTitle(post.title))
  }
})

test('[AC-SEO-010] merged blog posts are 301s, gone from the index and the sitemap', async ({ page, request }) => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf-8')) as {
    redirects: { source: string; destination: string; statusCode?: number }[]
  }
  const blogRedirects = vercel.redirects.filter((r) => r.source.startsWith('/blog/'))
  const slugs = new Set(blogIndex.map((p) => p.slug))
  const sitemap = await (await request.get('/sitemap.xml')).text()

  for (const merged of ['jak-stworzyc-miniaturke-allegro-dom-i-ogrod', 'jak-stworzyc-miniaturki-allegro-dla-kategorii-komputery']) {
    expect(blogRedirects.find((r) => r.source === `/blog/${merged}`)?.destination).toBe('/blog/miniaturki-allegro-dla-kategorii-poradnik')
  }
  for (const r of blogRedirects) {
    expect(r.statusCode, r.source).toBe(301)
    const from = r.source.replace('/blog/', '')
    const to = r.destination.replace('/blog/', '')
    expect(slugs.has(from), `${from} is still a post`).toBe(false)
    expect(slugs.has(to), `${r.source} → missing ${to}`).toBe(true)
    expect(sitemap, `${from} still in sitemap`).not.toContain(`/blog/${from}<`)
  }

  await page.goto('/blog/miniaturki-allegro-dla-kategorii-poradnik')
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('h1')).toContainText('Miniaturki Allegro dla kategorii')
})
