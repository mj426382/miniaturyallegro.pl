import { existsSync, readFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { test, expect, type Page } from '@playwright/test'
import { blogIndex } from '../src/data/blogIndex'
import { FREE_GRAPHICS, packages, plans } from '../src/data/pricing'
import { seoOgImage, seoPages } from '../src/data/seoPages'
import { HOME_UPDATED } from '../src/data/site'
import { topicClusters } from '../src/data/topicClusters'

/**
 * Spec 10 (audit docs/seo/2026-10-ecommerce-seo-audit.md): structured data, prices, topic clusters and internal links,
 * sitemap, Open Graph and heading structure, titles and descriptions, inlined CSS and lazy landing copy.
 * The prerendered HTML is device-independent, so these run once.
 */
const HERE = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(HERE, '../dist')
const SITE = 'https://allgrafika.pl'

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop-chrome', 'prerendered HTML is device-independent')
})

const landingPaths = seoPages.map((p) => p.path)
const postPaths = blogIndex.map((p) => `/blog/${p.slug}`)
const INDEXABLE = ['/', '/blog', ...landingPaths, ...postPaths]
const KNOWN_ROUTES = new Set([...INDEXABLE, '/regulamin', '/polityka-prywatnosci'])

function jsonLd(html: string): Array<Record<string, any>> {
  return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
}
const meta = (html: string, attr: string, key: string) => html.match(new RegExp(`<meta[^>]*${attr}="${key}"[^>]*content="([^"]*)"`))?.[1]
const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

/** Runs a DOM check on prerendered HTML in the browser without navigating (fast for 60 routes). */
async function inDom<T>(page: Page, html: string, fn: string): Promise<T> {
  return page.evaluate(
    ([source, body]) => {
      const doc = new DOMParser().parseFromString(body, 'text/html')
      return new Function('doc', source)(doc)
    },
    [fn, html] as const,
  )
}

test('[AC-SEO-015] every indexable page has valid JSON-LD of the right types and no ratings', async ({ request }) => {
  for (const route of INDEXABLE) {
    const html = await (await request.get(route)).text()
    const blocks = jsonLd(html)
    expect(blocks.length, route).toBeGreaterThan(0)
    for (const b of blocks) expect(b['@context'], route).toBe('https://schema.org')
    expect(html, route).not.toMatch(/aggregateRating|"review"/)
    const types = blocks.map((b) => b['@type'])

    if (route === '/') {
      for (const t of ['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage']) expect(types).toContain(t)
      const app = blocks.find((b) => b['@type'] === 'SoftwareApplication')!
      expect(app.offers['@type']).toBe('AggregateOffer')
      expect(app.offers.lowPrice).toBe('0')
      const prices = app.offers.offers.map((o: { price: string }) => Number(o.price))
      expect(Number(app.offers.highPrice)).toBe(Math.max(...prices))
      expect(app.offers.offerCount).toBe(app.offers.offers.length)
    } else if (route === '/blog') {
      expect(types).toEqual(expect.arrayContaining(['Blog', 'BreadcrumbList']))
      const blog = blocks.find((b) => b['@type'] === 'Blog')!
      expect(blog.blogPost.length).toBe(blogIndex.length)
    } else if (route.startsWith('/blog/')) {
      expect(types).toEqual(expect.arrayContaining(['BlogPosting', 'BreadcrumbList']))
      const article = blocks.find((b) => b['@type'] === 'BlogPosting')!
      const post = blogIndex.find((p) => `/blog/${p.slug}` === route)!
      expect(article.datePublished, route).toBe(post.publishedAt)
      expect(article.dateModified, route).toBe(post.modifiedAt ?? post.publishedAt)
      expect(article.image.url, route).toBe(`${SITE}/og/blog.png`)
      // A "Najczęstsze pytania" section with ### questions becomes FAQPage with exactly those questions.
      const section = html.replace(/<!-- -->/g, '').match(/<h2[^>]*>Najczęstsze pytania[^<]*<\/h2>([\s\S]*?)(?:<h2|<\/article>)/)?.[1]
      const questions = section ? [...section.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, '')).trim()) : []
      const faq = blocks.find((b) => b['@type'] === 'FAQPage')
      if (questions.length)
        expect(
          faq?.mainEntity.map((q: { name: string }) => q.name),
          route,
        ).toEqual(questions)
      else expect(faq, route).toBeUndefined()
    } else {
      expect(types).toEqual(expect.arrayContaining(['WebPage', 'BreadcrumbList', 'FAQPage']))
    }
  }
})

test('[AC-SEO-016] prices on the page and in JSON-LD match the backend catalogue', async ({ request }) => {
  const plansTs = readFileSync(resolve(HERE, '../../backend/src/payments/plans.ts'), 'utf-8')
  const section = (start: string, end: string) => plansTs.slice(plansTs.indexOf(start), plansTs.indexOf(end, plansTs.indexOf(start)))
  const parse = (src: string) => [...src.matchAll(/credits: (\d+),\s*priceGrosze: (\d+)/g)].map((m) => ({ credits: Number(m[1]), price: Number(m[2]) / 100 }))
  const backendPackages = parse(section('export const CREDIT_PACKAGES', '];'))
  const backendPlans = parse(section('export const SUBSCRIPTION_PLANS', '];'))
  expect(backendPackages.length).toBeGreaterThan(0)
  expect(packages.map((p) => ({ credits: p.credits, price: p.price }))).toEqual(backendPackages)
  expect(plans.map((p) => ({ credits: p.credits, price: p.price }))).toEqual(backendPlans)
  const pricingSpec = readFileSync(resolve(HERE, '../../docs/specs/02-pricing.md'), 'utf-8')
  expect(pricingSpec).toMatch(new RegExp(`\\| Darmowe kredyty \\| ${FREE_GRAPHICS} na nowe konto`))

  const html = (await (await request.get('/')).text()).replace(/<!-- -->/g, '')
  const offers = jsonLd(html)
    .find((b) => b['@type'] === 'SoftwareApplication')!
    .offers.offers.map((o: { price: string }) => Number(o.price))
  for (const p of [...packages, ...plans]) {
    expect(html).toContain(`${p.price} zł`)
    expect(offers).toContain(p.price)
  }
  expect(html).toContain(`Pierwsze ${FREE_GRAPHICS} grafik za darmo`)
})

test('[AC-SEO-025] related posts rotate inside the cluster – every post is linked from at least 3 others', async ({ request }) => {
  const inbound = new Map<string, Set<string>>(blogIndex.map((p) => [p.slug, new Set<string>()]))
  for (const post of blogIndex) {
    const html = await (await request.get(`/blog/${post.slug}`)).text()
    const section = html.match(/<section[^>]*data-related-posts[^>]*>[\s\S]*?<\/section>/)?.[0] ?? ''
    expect(section, `/blog/${post.slug} has a related-posts section`).not.toBe('')
    const targets = [...section.matchAll(/href="\/blog\/([a-z0-9-]+)"/g)].map((m) => m[1])
    expect(new Set(targets).size, `/blog/${post.slug} shows 3 different related posts`).toBe(3)
    expect(targets, `/blog/${post.slug} does not link itself`).not.toContain(post.slug)
    for (const t of targets) inbound.get(t)?.add(post.slug)

    // Neighbours in the cluster come first: the next post of the cluster list is always among them.
    const cluster = topicClusters.find((c) => c.posts.includes(post.slug))
    if (cluster && cluster.posts.length > 1) {
      const i = cluster.posts.indexOf(post.slug)
      expect(targets, `/blog/${post.slug} links its next cluster neighbour`).toContain(cluster.posts[(i + 1) % cluster.posts.length])
    }
  }
  const weak = [...inbound].filter(([, from]) => from.size < 3).map(([slug, from]) => `${slug} (${from.size})`)
  expect(weak, 'posts linked from fewer than 3 related sections').toEqual([])
})

test('[AC-SEO-017] /blog hubs, cluster links and same-tab internal links in posts', async ({ page, request }) => {
  const slugs = new Set(blogIndex.map((p) => p.slug))
  const membership = new Map<string, string>()
  for (const c of topicClusters) {
    for (const p of c.pillars) expect(landingPaths, `${c.id} pillar ${p}`).toContain(p)
    for (const s of c.posts) {
      expect(slugs.has(s), `${c.id}: unknown post ${s}`).toBe(true)
      expect(membership.get(s), `${s} is in two clusters`).toBeUndefined()
      membership.set(s, c.id)
    }
  }

  const blog = (await (await request.get('/blog')).text()).replace(/<!-- -->/g, '')
  for (const c of topicClusters) {
    const hub = blog.match(new RegExp(`<section[^>]*id="${c.id}"[\\s\\S]*?</section>`))?.[0] ?? ''
    expect(hub, `hub ${c.id}`).toContain(c.intro)
    for (const p of c.pillars) expect(hub, `hub ${c.id} → ${p}`).toContain(`href="${p}"`)
    for (const s of c.posts) expect(hub, `hub ${c.id} → ${s}`).toContain(`href="/blog/${s}"`)
  }
  for (const s of slugs) expect(blog, `/blog links ${s}`).toContain(`href="/blog/${s}"`)

  for (const post of blogIndex) {
    const route = `/blog/${post.slug}`
    const html = await (await request.get(route)).text()
    const cluster = topicClusters.find((c) => c.posts.includes(post.slug))
    if (cluster) {
      expect(html, `${route} → pillar`).toContain(`href="${cluster.pillars[0]}"`)
      const siblings = cluster.posts.filter((s) => s !== post.slug && html.includes(`href="/blog/${s}"`))
      expect(siblings.length, `${route} links posts of ${cluster.id}`).toBeGreaterThanOrEqual(2)
    }
    const result = await inDom<{ bad: string[]; blank: string[]; looseLi: number }>(
      page,
      html,
      `const links = [...doc.querySelectorAll('a[href]')].map((a) => ({ href: a.getAttribute('href'), target: a.getAttribute('target') }))
       const internal = links.filter((l) => l.href.startsWith('/') || l.href.startsWith('${SITE}'))
       return {
         bad: internal.map((l) => l.href.replace('${SITE}', '').split('#')[0].split('?')[0] || '/'),
         blank: internal.filter((l) => l.target === '_blank').map((l) => l.href),
         looseLi: [...doc.querySelectorAll('li')].filter((li) => !['UL', 'OL'].includes(li.parentElement.tagName)).length,
       }`,
    )
    for (const href of result.bad) expect(KNOWN_ROUTES.has(href), `${route} links unknown ${href}`).toBe(true)
    expect(result.blank, `${route}: internal links in a new tab`).toEqual([])
    expect(result.looseLi, `${route}: <li> outside a list`).toBe(0)
  }
})

test('[AC-SEO-018] the sitemap lists every indexable route once with content dates', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text()
  const entries = [...sitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => ({ path: m[1].replace(SITE, '') || '/', lastmod: m[2] }))
  expect(entries.map((e) => e.path).sort()).toEqual([...INDEXABLE].sort())
  const lastmod = new Map(entries.map((e) => [e.path, e.lastmod]))

  const newestPublished = blogIndex
    .map((p) => p.publishedAt)
    .sort()
    .reverse()[0]
  expect(lastmod.get('/')).toBe([HOME_UPDATED, newestPublished].sort().reverse()[0])
  for (const p of blogIndex) expect(lastmod.get(`/blog/${p.slug}`), p.slug).toBe(p.modifiedAt ?? p.publishedAt)

  for (const e of entries) {
    const res = await request.get(e.path, { maxRedirects: 0 })
    expect(res.status(), e.path).toBe(200)
    expect(await res.text(), e.path).not.toMatch(/<meta[^>]*name="robots"[^>]*noindex/)
  }
  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`)
  const missing = await request.get('/to-nie-istnieje-404')
  expect(missing.status()).toBe(404)
  expect(await missing.text()).toMatch(/<meta[^>]*name="robots"[^>]*noindex/)
})

test('[AC-SEO-019] Open Graph images, one H1, heading order and alt texts', async ({ page, request }) => {
  const pngSize = (file: string) => {
    const b = readFileSync(file)
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
  }
  for (const route of INDEXABLE) {
    const html = await (await request.get(route)).text()
    const og = meta(html, 'property', 'og:image')
    expect(og, route).toMatch(new RegExp(`^${SITE}/.+\\.png$`))
    expect(meta(html, 'name', 'twitter:image'), route).toBe(og)
    expect(meta(html, 'property', 'og:image:width'), route).toBe('1200')
    expect(meta(html, 'property', 'og:image:height'), route).toBe('630')
    expect(meta(html, 'property', 'og:image:alt')?.length ?? 0, route).toBeGreaterThan(0)
    const file = join(DIST, og!.replace(SITE, ''))
    expect(existsSync(file), `${route}: ${file}`).toBe(true)
    expect(pngSize(file), route).toEqual({ width: 1200, height: 630 })
    const landing = seoPages.find((p) => p.path === route)
    if (landing) expect(og).toBe(`${SITE}${seoOgImage(landing)}`)
    if (route === '/blog') expect(og).toBe(`${SITE}/og/blog.png`)

    const result = await inDom<{ h1: number; skips: string[]; noAlt: number }>(
      page,
      html,
      `doc.querySelectorAll('footer').forEach((f) => f.remove())
       const levels = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => ({ level: Number(h.tagName[1]), text: h.textContent.trim().slice(0, 60) }))
       const skips = []
       levels.forEach((h, i) => { if (i > 0 && h.level > levels[i - 1].level + 1) skips.push(levels[i - 1].text + ' → ' + h.text) })
       return { h1: levels.filter((h) => h.level === 1).length, skips, noAlt: [...doc.querySelectorAll('img')].filter((i) => !(i.getAttribute('alt') || '').trim()).length }`,
    )
    expect(result.h1, route).toBe(1)
    expect(result.skips, route).toEqual([])
    expect(result.noAlt, route).toBe(0)
  }
})

test('[AC-SEO-020] post titles and descriptions are unique, short and free of the old wording', async ({ request }) => {
  const titles = blogIndex.map((p) => p.title)
  expect(new Set(titles).size).toBe(titles.length)
  for (const p of blogIndex) {
    expect(p.title.length, p.slug).toBeLessThanOrEqual(60)
    expect(p.title, p.slug).not.toMatch(/miniaturk/i)
    expect(p.excerpt.length, `${p.slug}: ${p.excerpt.length}`).toBeGreaterThanOrEqual(70)
    expect(p.excerpt.length, `${p.slug}: ${p.excerpt.length}`).toBeLessThanOrEqual(158)
  }
  const descriptions: string[] = []
  for (const route of INDEXABLE) descriptions.push(decode(meta(await (await request.get(route)).text(), 'name', 'description') ?? ''))
  const dupes = descriptions.filter((d, i) => descriptions.indexOf(d) !== i)
  expect(dupes).toEqual([])
})

test('[AC-SEO-021] CSS is inlined and landing page copy stays out of the shared bundle', async ({ request }) => {
  const home = readFileSync(join(DIST, 'index.html'), 'utf-8')
  const main = home.match(/<script[^>]*type="module"[^>]*src="(\/assets\/[^"]+\.js)"/)?.[1]
  expect(main).toBeTruthy()
  const bundle = readFileSync(join(DIST, main!), 'utf-8')
  for (const route of ['/', '/blog', ...landingPaths, postPaths[0]]) {
    const html = await (await request.get(route)).text()
    expect(html, route).toContain('<style>')
    expect(html, route).not.toMatch(/<link[^>]*rel="stylesheet"[^>]*href="\/assets\//)
    expect(html, route).not.toMatch(/fonts\.(googleapis|gstatic)\.com/)
  }
  for (const marker of ['Rodzaje ujęć packshotowych', 'Rozmiary zdjęć w Shopify, WooCommerce, Shoper i PrestaShop', 'Studio, zdjęcia DIY czy AI – porównanie']) {
    expect(bundle.includes(marker), `"${marker}" in ${main}`).toBe(false)
  }
})
