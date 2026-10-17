import { readdirSync } from 'fs'
import { test, expect } from '@playwright/test'
import { blogIndex } from '../src/data/blogIndex'
import { SEO_PAGES_UPDATED, seoPages, seoSlug } from '../src/data/seoPages'
import type { SeoContent } from '../src/data/seoContentLoader'
import { formatPlDate } from '../src/data/site'
import { plainText } from '../src/utils/richText'
import generator from '../src/data/seoContent/zdjecia-ai-do-ofert'
import photography from '../src/data/seoContent/fotografia-produktowa-ai'
import packshot from '../src/data/seoContent/packshot-online'
import whiteBg from '../src/data/seoContent/biale-tlo-zdjecie-produktu'
import shop from '../src/data/seoContent/zdjecia-produktowe-do-sklepu-internetowego'
import olx from '../src/data/seoContent/zdjecia-produktowe-olx'
import vinted from '../src/data/seoContent/zdjecia-produktowe-vinted'
import ebay from '../src/data/seoContent/zdjecia-produktowe-ebay'
import amazon from '../src/data/seoContent/zdjecia-produktowe-amazon'

/** Spec 10: keyword landing pages (AC-SEO-007, AC-SEO-014) and the home page positioning (AC-SEO-008). */

const LANDING_PATHS = [
  '/zdjecia-ai-do-ofert',
  '/fotografia-produktowa-ai',
  '/packshot-online',
  '/biale-tlo-zdjecie-produktu',
  '/zdjecia-produktowe-do-sklepu-internetowego',
  '/zdjecia-produktowe-olx',
  '/zdjecia-produktowe-vinted',
  '/zdjecia-produktowe-ebay',
  '/zdjecia-produktowe-amazon',
]

const contentDir = new URL('../src/data/seoContent/', import.meta.url)
const CONTENT: Record<string, SeoContent> = {
  'zdjecia-ai-do-ofert': generator,
  'fotografia-produktowa-ai': photography,
  'packshot-online': packshot,
  'biale-tlo-zdjecie-produktu': whiteBg,
  'zdjecia-produktowe-do-sklepu-internetowego': shop,
  'zdjecia-produktowe-olx': olx,
  'zdjecia-produktowe-vinted': vinted,
  'zdjecia-produktowe-ebay': ebay,
  'zdjecia-produktowe-amazon': amazon,
}
async function loadContent(slug: string): Promise<SeoContent> {
  const content = CONTENT[slug]
  expect(content, `no content module imported for ${slug}`).toBeDefined()
  return content
}

function jsonLdTypes(blocks: string[]) {
  return blocks.flatMap((t) => [...t.matchAll(/"@type":"([A-Za-z]+)"/g)].map((m) => m[1]))
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

test('[AC-SEO-007] every landing page has its own SEO head, one keyword H1 and structured data', async ({ page, request }) => {
  test.setTimeout(180_000) // nine pages, each loaded and hydrated
  expect(seoPages.map((p) => p.path)).toEqual(LANDING_PATHS)
  expect(readdirSync(contentDir).sort()).toEqual(seoPages.map((p) => `${seoSlug(p)}.ts`).sort())
  const sitemap = await (await request.get('/sitemap.xml')).text()
  const titles = new Set<string>()

  for (const p of seoPages) {
    const content = await loadContent(seoSlug(p))
    const html = await (await request.get(p.path)).text()
    // Prerendered: crawlers get the copy without JavaScript.
    expect(html, p.path).toContain(content.sections[0].heading)
    expect(html, p.path).toContain(content.faq[0].q)

    await page.goto(p.path)
    const title = await page.title()
    expect(title.length, title).toBeLessThanOrEqual(60)
    expect(titles.has(title), `duplicate title ${title}`).toBe(false)
    titles.add(title)

    const description = (await page.locator('meta[name="description"]').getAttribute('content')) ?? ''
    expect(description.length, description).toBeGreaterThanOrEqual(120)
    expect(description.length, description).toBeLessThanOrEqual(158)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://allgrafika.pl${p.path}`)

    // One H1 whose text keeps a space between the phrase and its accent line (no "ofertz jednego").
    await expect(page.locator('h1')).toHaveCount(1)
    const h1 = decode((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '').replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ''))
    expect(h1.replace(/\s+/g, ' ').trim()).toBe(`${p.h1} ${p.h1Accent}`)

    const types = jsonLdTypes(await page.locator('script[type="application/ld+json"]').allTextContents())
    for (const type of ['WebPage', 'FAQPage', 'BreadcrumbList']) expect(types, p.path).toContain(type)

    expect(sitemap).toContain(`<loc>https://allgrafika.pl${p.path}</loc>`)
    await expect(page.locator('footer').getByRole('link', { name: p.navLabel, exact: true })).toHaveAttribute('href', p.path)

    // The free demo is the conversion point of the page.
    await expect(page.locator('#demo')).toBeVisible()
  }
})

test('[AC-SEO-014] landing pages have unique, sourced, dated copy linked to posts and other landing pages', async ({ request }) => {
  test.skip(test.info().project.name !== 'desktop-chrome', 'prerendered HTML is device-independent')
  const OFFICIAL: Record<string, RegExp> = {
    Amazon: /sellercentral\.amazon\./,
    eBay: /ebay\./,
    Vinted: /vinted\./,
    OLX: /olx\.pl/,
    Google: /support\.google\.com/,
    Shopify: /help\.shopify\.com/,
    WooCommerce: /woocommerce\.com/,
    Shoper: /shoper\.pl/,
    PrestaShop: /prestashop-project\.org/,
  }
  const ALLOWED_SOURCE = [...Object.values(OFFICIAL), /^https:\/\/kb\.pl\//]
  // An attributed platform rule ("według pomocy eBay", "zasady katalogu Vinted", "wytycznych Amazon"…) needs that platform's official source.
  // ("w poradniku wymiary zdjęć OLX" is our own post, so "poradnik" counts only right before the platform name: "Poradnik Vinted".)
  const ATTRIBUTION = new RegExp(`(?:(?:według|wytyczn\\w*|zasad\\w*|polityk\\w*|pomoc\\w*|dokumentacj\\w*)(?:\\s+[\\wąćęłńóśźż]+){0,2}|poradnik\\w*)\\s+(${Object.keys(OFFICIAL).join('|')})`, 'gi')
  const seenParagraphs = new Map<string, string>()
  const seenKeywords = new Map<string, string>()
  const posts = new Set(blogIndex.map((p) => p.slug))

  for (const p of seoPages) {
    const content = await loadContent(seoSlug(p))
    const sectionText = content.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? []), ...(s.steps ?? []), ...(s.table ? [...s.table.head, ...s.table.rows.flat()] : [])])
    const allText = [content.lead, ...sectionText, ...content.faq.flatMap((f) => [f.q, f.a])].map(plainText).join(' ')
    expect(allText.split(/\s+/).filter(Boolean).length, `${p.path} word count`).toBeGreaterThanOrEqual(450)

    for (const para of content.sections.flatMap((s) => s.paragraphs)) {
      expect(seenParagraphs.get(para), `${p.path} repeats a paragraph of ${seenParagraphs.get(para)}`).toBeUndefined()
      seenParagraphs.set(para, p.path)
    }
    for (const kw of p.keywords) {
      expect(seenKeywords.get(kw), `${p.path} shares the keyword "${kw}" with ${seenKeywords.get(kw)}`).toBeUndefined()
      seenKeywords.set(kw, p.path)
    }

    expect(content.sources.length, p.path).toBeGreaterThan(0)
    for (const s of content.sources) expect(ALLOWED_SOURCE.some((re) => re.test(s.url)) && s.url.startsWith('https://'), `${p.path}: ${s.url}`).toBe(true)
    for (const m of allText.matchAll(ATTRIBUTION)) {
      const platform = Object.keys(OFFICIAL).find((k) => k.toLowerCase() === m[1].toLowerCase())!
      expect(
        content.sources.some((s) => OFFICIAL[platform].test(s.url)),
        `${p.path}: "${m[0]}" has no official ${platform} source`,
      ).toBe(true)
    }

    const html = (await (await request.get(p.path)).text()).replace(/<!-- -->/g, '')
    expect(html, p.path).toContain(`Aktualizacja: <time dateTime="${SEO_PAGES_UPDATED}">${formatPlDate(SEO_PAGES_UPDATED)}</time>`)
    for (const s of content.sources) expect(html, `${p.path} lists ${s.url}`).toContain(`href="${s.url.replace(/&/g, '&amp;')}"`)
    const hrefs = new Set([...html.matchAll(/href="([^"#]+)"/g)].map((m) => m[1]))
    const linkedPosts = [...hrefs].filter((h) => h.startsWith('/blog/') && posts.has(h.slice(6)))
    const linkedLandings = [...hrefs].filter((h) => h !== p.path && LANDING_PATHS.includes(h))
    expect(linkedPosts.length, `${p.path} links posts`).toBeGreaterThanOrEqual(2)
    expect(linkedLandings.length, `${p.path} links landing pages`).toBeGreaterThanOrEqual(2)
  }
})

test('[AC-SEO-008] the home page targets e-commerce in general and links every landing page', async ({ page, request }) => {
  const html = await (await request.get('/')).text()
  await page.goto('/')
  const title = await page.title()
  expect(title.length).toBeLessThanOrEqual(60)
  expect(title.startsWith('Zdjęcia produktowe AI')).toBe(true)
  expect(title).toContain('sklep')
  const description = (await page.locator('meta[name="description"]').getAttribute('content')) ?? ''
  expect(description.length).toBeLessThanOrEqual(158)
  expect(description).toContain('sklepu internetowego')
  expect(description).toContain('marketplace')

  await expect(page.locator('h1')).toHaveCount(1)
  expect((await page.locator('h1').innerText()).replace(/\s+/g, ' ').trim()).toBe('Zdjęcia produktowe AI dla sklepów internetowych i marketplace’ów')

  const useCases = page.locator('#zastosowania')
  await expect(useCases.getByRole('heading', { level: 2 })).toContainText('Gdzie wykorzystasz')
  for (const p of seoPages) await expect(useCases.locator(`a[href="${p.path}"]`)).toHaveCount(1)
  for (const p of seoPages) expect(html).toContain(`href="${p.path}"`)

  // Visible FAQ = FAQPage JSON-LD.
  const visible = (await page.locator('#faq summary').allInnerTexts()).map((q) => q.replace(/\+$/, '').trim())
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t))
  const faq = ld.find((b) => b['@type'] === 'FAQPage')
  expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(visible)
})
