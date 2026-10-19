import { existsSync, readFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { test, expect } from '@playwright/test'
import { blogIndex } from '../src/data/blogIndex'
import { seoPages } from '../src/data/seoPages'
import { PARTNER_OG_IMAGE, PARTNER_PAGE_PATH, PARTNER_PAGE_UPDATED, PARTNER_PROGRAM } from '../src/data/partnerProgram'

/**
 * Spec 24 / spec 10, AC-SEO-027: the partner programme page – a description for partners (not consumer terms) with the
 * same head rules as the landing pages and the numbers of the backend defaults.
 */
const HERE = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(HERE, '../dist')
const SITE = 'https://allgrafika.pl'
const ROUTE = PARTNER_PAGE_PATH

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
const meta = (html: string, attr: string, key: string) => html.match(new RegExp(`<meta[^>]*${attr}="${key}"[^>]*content="([^"]*)"`))?.[1]
const text = (html: string) =>
  decode(
    html
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<!-- -->/g, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()

test.describe('prerendered HTML', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop-chrome', 'prerendered HTML is device-independent')
  })

  test('[AC-SEO-027] head: title, description, canonical, one H1, JSON-LD WebPage + BreadcrumbList and its own OG image', async ({ request }) => {
    const res = await request.get(ROUTE)
    expect(res.status()).toBe(200)
    const html = await res.text()

    const title = decode(html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? '')
    expect(title).toBe('Program partnerski – 20% prowizji | AllGrafika.pl')
    expect(title.length).toBeLessThanOrEqual(60)
    const description = decode(meta(html, 'name', 'description') ?? '')
    expect(description.length, description).toBeGreaterThanOrEqual(120)
    expect(description.length, description).toBeLessThanOrEqual(158)
    expect(html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1]).toBe(`${SITE}${ROUTE}`)
    expect(html).not.toMatch(/<meta[^>]*name="robots"[^>]*noindex/)
    expect([...html.matchAll(/<h1[\s>]/g)]).toHaveLength(1)
    expect(text(html.match(/<h1[^>]*>[\s\S]*?<\/h1>/)![0])).toBe('Program partnerski AllGrafika.pl')

    const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
    const page = blocks.find((b) => b['@type'] === 'WebPage')
    expect(page).toMatchObject({
      '@context': 'https://schema.org',
      '@id': `${SITE}${ROUTE}#webpage`,
      url: `${SITE}${ROUTE}`,
      inLanguage: 'pl-PL',
      dateModified: PARTNER_PAGE_UPDATED,
      isPartOf: { '@id': `${SITE}/#website` },
    })
    const crumbs = blocks.find((b) => b['@type'] === 'BreadcrumbList')
    expect(crumbs.itemListElement.map((i: any) => i.item)).toEqual([`${SITE}/`, `${SITE}${ROUTE}`])
    expect(blocks.some((b) => b['@type'] === 'FAQPage')).toBe(false)

    expect(meta(html, 'property', 'og:image')).toBe(`${SITE}${PARTNER_OG_IMAGE}`)
    const png = readFileSync(join(DIST, PARTNER_OG_IMAGE))
    expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }).toEqual({ width: 1200, height: 630 })
  })

  test('[AC-SEO-027] the copy states the model, the rules and that it is not the consumer terms; CTA is a mailto', async ({ request }) => {
    const html = await (await request.get(ROUTE)).text()
    const body = text(html.match(/<main[\s\S]*<\/main>/)?.[0] ?? '') + ' ' + text(html.match(/<section[\s\S]*?<\/section>/)?.[0] ?? '')
    for (const phrase of [
      '10% rabatu',
      '20% prowizji',
      'przez 12 miesięcy',
      'co miesiąc kalendarzowy',
      'na podstawie Twojej faktury',
      'co najmniej 50 zł',
      'Bez spamu',
      'Bez licytowania marki',
      'nazwą AllGrafika',
      'Bez zakupów własnych',
      'rel="sponsored"',
      'nofollow',
      'wytycznymi Google',
      'Nie jest regulaminem dla klientów',
      'kwoty faktycznie zapłaconej',
    ]) {
      expect(body, phrase).toContain(phrase)
    }
    expect(html).toContain('href="mailto:kontakt@allgrafika.pl?subject=Program%20partnerski%20AllGrafika.pl"')
    expect(html).toContain('href="/regulamin"')
    expect(html).not.toMatch(/allegro/i)
    expect(html).not.toMatch(/tauron/i)
  })

  test('[AC-SEO-027] the numbers equal the backend defaults of a partner and the payout threshold', () => {
    const backend = readFileSync(resolve(HERE, '../../backend/src/partners/commission.ts'), 'utf-8')
    const number = (name: string) => Number(backend.match(new RegExp(`${name}: (\\d+)`))?.[1])
    expect(PARTNER_PROGRAM.customerDiscountPercent).toBe(number('customerDiscountPercent'))
    expect(PARTNER_PROGRAM.commissionPercent).toBe(number('commissionPercent'))
    expect(PARTNER_PROGRAM.commissionMonths).toBe(number('commissionMonths'))
    expect(PARTNER_PROGRAM.minPayoutZl * 100).toBe(Number(backend.match(/MIN_PAYOUT_GROSZE = (\d+)/)?.[1]))
    const spec = readFileSync(resolve(HERE, '../../docs/specs/24-partner-program.md'), 'utf-8')
    expect(spec).toContain('**10% rabatu**')
    expect(spec).toContain('**20% prowizji**')
  })

  test('[AC-SEO-027] the page is in the sitemap and linked from the footer of every kind of page', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()
    const entry = sitemap.match(new RegExp(`<loc>${SITE}${ROUTE}</loc>\\s*<lastmod>([^<]+)</lastmod>`))
    expect(entry?.[1]).toBe(PARTNER_PAGE_UPDATED)
    expect(sitemap.split(`<loc>${SITE}${ROUTE}</loc>`)).toHaveLength(2)
    expect(existsSync(join(DIST, 'program-partnerski', 'index.html'))).toBe(true)

    for (const route of ['/', '/blog', seoPages[0].path, `/blog/${blogIndex[0].slug}`, '/regulamin', '/polityka-prywatnosci', ROUTE, '/nie-ma-takiej-strony']) {
      const html = await (await request.get(route)).text()
      const footer = html.match(/<footer[\s\S]*<\/footer>/)?.[0] ?? ''
      expect(footer, route).toMatch(new RegExp(`<a[^>]*href="${ROUTE}"[^>]*>Program partnerski</a>`))
    }
  })
})

test('[AC-SEO-027] hydrates without React errors, keeps one H1 and fits the screen', async ({ page }) => {
  const problems: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(msg.text())
  })
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  const res = await page.goto(ROUTE)
  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'Program partnerski AllGrafika.pl' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(problems.filter((p) => /hydrat|did not match|Minified React error #4(18|23|25)|Warning:/i.test(p))).toEqual([])
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page).toHaveTitle('Program partnerski – 20% prowizji | AllGrafika.pl')
  const cta = page.getByRole('link', { name: 'Zgłoś się: kontakt@allgrafika.pl' })
  await expect(cta).toHaveAttribute('href', /^mailto:kontakt@allgrafika\.pl/)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  // client-side navigation from the footer of another page reaches the same page
  await page.goto('/blog')
  await page.locator('footer').getByRole('link', { name: 'Program partnerski' }).click()
  await expect(page).toHaveURL(new RegExp(`${ROUTE}$`))
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Program partnerski AllGrafika.pl')
})
