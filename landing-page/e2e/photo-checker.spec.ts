import { existsSync, readFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { test, expect, type Page } from '@playwright/test'
import sharp from 'sharp'
import { blogIndex } from '../src/data/blogIndex'
import { seoPages } from '../src/data/seoPages'
import { PHOTO_CHECKER_LINKED_FROM, PHOTO_CHECKER_OG_IMAGE, PHOTO_CHECKER_PATH, PHOTO_CHECKER_UPDATED } from '../src/data/photoChecker'
import { PLATFORMS } from '../src/tools/photoCheck/requirements'

/**
 * Spec 25: the free photo checker page – prerendered SEO content (AC-TOOL-006), internal links (AC-TOOL-007) and the
 * interactive tool on every landing device profile (AC-TOOL-004), without sending the photo anywhere (AC-TOOL-005).
 */
const HERE = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(HERE, '../dist')
const SITE = 'https://allgrafika.pl'
const ROUTE = PHOTO_CHECKER_PATH
const TITLE = 'Sprawdź zdjęcie produktu – darmowe narzędzie | AllGrafika.pl'
const H1 = 'Sprawdź zdjęcie produktu za darmo, bez wysyłania pliku'

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
const jsonLd = (html: string) => [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))

test.describe('prerendered HTML', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop-chrome', 'prerendered HTML is device-independent')
  })

  test('[AC-TOOL-006] head: title, description, canonical, one H1, WebApplication + BreadcrumbList + FAQPage and its own OG image', async ({ request }) => {
    const res = await request.get(ROUTE)
    expect(res.status()).toBe(200)
    const html = await res.text()
    const title = decode(html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? '')
    expect(title).toBe(TITLE)
    expect(title.length).toBeLessThanOrEqual(60)
    const description = decode(meta(html, 'name', 'description') ?? '')
    expect(description.length, description).toBeGreaterThanOrEqual(120)
    expect(description.length, description).toBeLessThanOrEqual(158)
    expect(html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1]).toBe(`${SITE}${ROUTE}`)
    expect(html).not.toMatch(/<meta[^>]*name="robots"[^>]*noindex/)
    expect([...html.matchAll(/<h1[\s>]/g)]).toHaveLength(1)
    expect(text(html.match(/<h1[^>]*>[\s\S]*?<\/h1>/)![0])).toBe(H1)

    const blocks = jsonLd(html)
    for (const b of blocks) expect(b['@context']).toBe('https://schema.org')
    const app = blocks.find((b) => b['@type'] === 'WebApplication')
    expect(app).toMatchObject({
      '@id': `${SITE}${ROUTE}#app`,
      url: `${SITE}${ROUTE}`,
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' },
      dateModified: PHOTO_CHECKER_UPDATED,
      publisher: { '@id': `${SITE}/#organization` },
    })
    expect(html).not.toMatch(/aggregateRating|"review"/)
    const crumbs = blocks.find((b) => b['@type'] === 'BreadcrumbList')
    expect(crumbs.itemListElement.map((i: any) => i.item)).toEqual([`${SITE}/`, `${SITE}${ROUTE}`])

    // FAQ in JSON-LD = the questions visible on the page
    const faq = blocks.find((b) => b['@type'] === 'FAQPage')
    const visible = [...html.replace(/<!-- -->/g, '').matchAll(/<summary[^>]*>([\s\S]*?)<span/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, '')).trim())
    expect(visible.length).toBeGreaterThanOrEqual(5)
    expect(faq.mainEntity.map((q: any) => q.name)).toEqual(visible)

    expect(meta(html, 'property', 'og:image')).toBe(`${SITE}${PHOTO_CHECKER_OG_IMAGE}`)
    const png = readFileSync(join(DIST, PHOTO_CHECKER_OG_IMAGE))
    expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }).toEqual({ width: 1200, height: 630 })
    expect(existsSync(join(DIST, 'narzedzia', 'sprawdz-zdjecie-produktu', 'index.html'))).toBe(true)
  })

  test('[AC-TOOL-006] the explanatory copy, the sourced requirement table and the link snippet are in the static HTML', async ({ request }) => {
    const html = (await (await request.get(ROUTE)).text()).replace(/<!-- -->/g, '')
    const body = text(html)
    for (const phrase of [
      'Prywatnie: zdjęcia są analizowane w Twojej przeglądarce i nie są nigdzie wysyłane.',
      'Zdjęcia nie opuszczają Twojego urządzenia.',
      'Co sprawdza narzędzie',
      'Wymagania platform i źródła',
      'Białe tło (szacunek)',
      'brak oficjalnej wartości',
      'Jak umieścić to narzędzie u siebie',
      'Najczęstsze pytania',
      'Popraw zdjęcie w AllGrafika',
    ]) {
      expect(body, phrase).toContain(phrase)
    }
    // every source of every platform is cited with the date it was checked
    const table = html.match(/<section id="wymagania"[\s\S]*?<\/section>/)?.[0] ?? ''
    for (const p of PLATFORMS) {
      expect(table, p.name).toContain(`>${p.name}</h3>`)
      for (const s of p.sources) expect(table, s.url).toContain(`href="${s.url.replace(/&/g, '&amp;')}"`)
    }
    expect(text(table).match(/sprawdzono 19 października 2026/g)?.length ?? 0).toBeGreaterThanOrEqual(PLATFORMS.length)
    expect(text(table)).toContain('Akceptowane formaty plików: brak oficjalnej wartości')

    const snippet = text(html.match(/<pre[^>]*data-testid="embed-snippet"[\s\S]*?<\/pre>/)?.[0] ?? '')
    expect(snippet).toBe(`<a href="${SITE}${ROUTE}">Sprawdź zdjęcie produktu – darmowe narzędzie AllGrafika.pl</a>`)
    expect(html).not.toMatch(/<iframe/i)
    expect(html).not.toMatch(/allegro/i)
    expect(html).not.toMatch(/tauron/i)
    // the file input is in the HTML (labelled), enabled after hydration
    expect(html).toMatch(/<label[^>]*for="photo-checker-files"[^>]*>Wybierz zdjęcia produktu<\/label>/)
    expect(html).toMatch(/<input[^>]*id="photo-checker-files"[^>]*disabled/)
  })

  test('[AC-TOOL-006] the page is in the sitemap exactly once with its content date', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text()
    expect(sitemap.match(new RegExp(`<loc>${SITE}${ROUTE}</loc>\\s*<lastmod>([^<]+)</lastmod>`))?.[1]).toBe(PHOTO_CHECKER_UPDATED)
    expect(sitemap.split(`<loc>${SITE}${ROUTE}</loc>`)).toHaveLength(2)
  })

  test('[AC-TOOL-007] the footer, the home page and the platform landing pages link the tool; the tool links back', async ({ request }) => {
    for (const route of ['/', '/blog', `/blog/${blogIndex[0].slug}`, '/regulamin', '/program-partnerski', ROUTE, '/nie-ma-takiej-strony', ...seoPages.map((p) => p.path)]) {
      const html = await (await request.get(route)).text()
      const footer = html.match(/<footer[\s\S]*<\/footer>/)?.[0] ?? ''
      expect(footer, route).toMatch(new RegExp(`<a[^>]*href="${ROUTE}"[^>]*>Sprawdź zdjęcie produktu</a>`))
    }
    const home = (await (await request.get('/')).text()).replace(/<!-- -->/g, '')
    expect(home.replace(/<footer[\s\S]*<\/footer>/, '')).toContain(`href="${ROUTE}"`)
    for (const path of PHOTO_CHECKER_LINKED_FROM) {
      const html = (await (await request.get(path)).text()).replace(/<!-- -->/g, '')
      const box = html.match(/<p[^>]*data-photo-checker-link[\s\S]*?<\/p>/)?.[0] ?? ''
      expect(box, path).toContain(`href="${ROUTE}"`)
    }
    expect(PHOTO_CHECKER_LINKED_FROM.every((p) => seoPages.some((s) => s.path === p))).toBe(true)

    const tool = (await (await request.get(ROUTE)).text()).replace(/<!-- -->/g, '')
    const main = tool.match(/<main[\s\S]*<\/main>/)?.[0] ?? ''
    for (const path of PHOTO_CHECKER_LINKED_FROM) expect(main, path).toContain(`href="${path}"`)
    const posts = blogIndex.filter((p) => main.includes(`href="/blog/${p.slug}"`))
    expect(posts.length).toBeGreaterThanOrEqual(2)
    expect(tool).toContain('href="https://app.allgrafika.pl/register?utm_source=landing&amp;utm_medium=tool&amp;utm_content=photo-checker"')
    // every internal link of the page is a known route
    const known = new Set(['/', '/blog', '/regulamin', '/polityka-prywatnosci', '/program-partnerski', ROUTE, ...seoPages.map((p) => p.path), ...blogIndex.map((p) => `/blog/${p.slug}`)])
    for (const [, href] of tool.matchAll(/<a[^>]*href="(\/[^"#?]*)/g)) expect(known.has(href), href).toBe(true)
  })
})

// ── interactive tool on every device profile ─────────────────────────────────

async function fixtures() {
  const svg = (bg: string, w: number, h: number) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 4}" fill="#8a3b12"/></svg>`,
    )
  const white = await sharp(svg('#ffffff', 1600, 1600))
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88 })
    .toBuffer()
  const cutout = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><circle cx="450" cy="300" r="200" fill="#2255aa"/></svg>')).png().toBuffer()
  const ftyp = [0, 0, 0, 24, ...Buffer.from('ftypheic'), 0, 0, 0, 0, ...Buffer.from('mif1heic')]
  const ispe = [0, 0, 0, 20, ...Buffer.from('ispe'), 0, 0, 0, 0, 0, 0, 0x0f, 0xc0, 0, 0, 0x0b, 0xd0] // 4032 × 3024
  const heic = Buffer.from([...ftyp, 0, 0, 0, 40, ...Buffer.from('meta'), 0, 0, 0, 0, 0, 0, 0, 28, ...Buffer.from('iprp'), ...ispe])
  const broken = Buffer.concat([white.subarray(0, 40), Buffer.from('zepsuty plik')])
  return [
    { name: 'produkt-biale-tlo.jpg', mimeType: 'image/jpeg', buffer: white },
    { name: 'wyciety-produkt.png', mimeType: 'image/png', buffer: cutout },
    { name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer: heic },
    { name: 'uszkodzony.jpg', mimeType: 'image/jpeg', buffer: broken },
  ]
}

/** Every network request the page makes, plus console problems (hydration). */
function watch(page: Page) {
  const requests: Array<{ url: string; method: string; body: Buffer | null }> = []
  const problems: string[] = []
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method(), body: r.postDataBuffer() }))
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(msg.text())
  })
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  return { requests, problems }
}

async function openTool(page: Page) {
  const res = await page.goto(ROUTE)
  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(H1)
  const input = page.getByLabel('Wybierz zdjęcia produktu')
  await expect(input).toBeEnabled() // enabled = hydrated
  return input
}

test('[AC-TOOL-004, AC-TOOL-005, AC-TOOL-006] checks several photos locally, announces the result and sends nothing', async ({ page }) => {
  const { requests, problems } = watch(page)
  const input = await openTool(page)
  await page.waitForLoadState('networkidle')
  expect(problems.filter((p) => /hydrat|did not match|Minified React error #4(18|23|25)|Warning:/i.test(p))).toEqual([])
  const before = requests.length

  const files = await fixtures()
  await input.setInputFiles(files)
  const cards = page.getByTestId('photo-result')
  await expect(cards).toHaveCount(4)
  const status = page.getByRole('status').filter({ hasText: 'Sprawdzono' })
  await expect(status).toHaveText(/^Sprawdzono 4 zdjęcia\. produkt-biale-tlo\.jpg: zgodne \d+, uwagi \d+, niezgodne \d+; .*uszkodzony\.jpg: nie udało się odczytać pliku\.$/)
  await expect(page.getByRole('status').filter({ hasText: 'Sprawdzono' })).toHaveAttribute('aria-live', 'polite')

  // 1. white JPEG 1600 × 1600
  const white = cards.nth(0)
  await expect(white.getByRole('heading', { level: 3 })).toHaveText('produkt-biale-tlo.jpg')
  await expect(white).toContainText('Format:JPEG')
  await expect(white).toContainText('1600 × 1600 px')
  await expect(white).toContainText('Proporcje:1:1')
  await expect(white).toContainText('kwadrat')
  await expect(white).toContainText('czysta biel przy krawędziach')
  await expect(white.locator('tr[data-platform="amazon"]')).toHaveAttribute('data-status', 'pass')
  await expect(white.locator('tr[data-platform="ebay"]')).toHaveAttribute('data-status', 'pass')
  await expect(white.locator('tr[data-platform="vinted"]')).toHaveAttribute('data-status', 'info')
  await expect(white.locator('tr[data-platform="amazon"]')).toContainText('Zgodne')
  await expect(white.locator('tr[data-platform="amazon"] a[href="/zdjecia-produktowe-amazon"]')).toBeVisible()
  await expect(white.locator('tr[data-platform="amazon"] a', { hasText: 'źródło' }).first()).toHaveAttribute('href', /^https:\/\/sellercentral\.amazon\.com\//)

  // 2. transparent PNG cut-out
  const cutout = cards.nth(1)
  await expect(cutout).toContainText('Przezroczystość:tak')
  await expect(cutout).toContainText('przezroczyste')
  await expect(cutout.locator('tr[data-platform="amazon"]')).toHaveAttribute('data-status', 'warn')
  await expect(cutout).toContainText('wypełnij tło białym kolorem')

  // 3. HEIC from an iPhone – size from the header, not accepted by Amazon / Google
  const heic = cards.nth(2)
  await expect(heic).toContainText('Format:HEIC')
  await expect(heic).toContainText('4032 × 3024 px')
  await expect(heic.locator('tr[data-platform="amazon"]')).toHaveAttribute('data-status', 'fail')
  await expect(heic.locator('tr[data-platform="google"]')).toHaveAttribute('data-status', 'fail')
  await expect(heic).toContainText('Najbardziej zgodne')

  // 4. a corrupted file – a message, no platform table, the page keeps working
  const broken = cards.nth(3)
  await expect(broken).toContainText('uszkodzony lub niepełny')
  await expect(broken.locator('table')).toHaveCount(0)

  // CTA with UTM
  await expect(page.getByRole('link', { name: 'Popraw zdjęcie w AllGrafika →' })).toHaveAttribute(
    'href',
    'https://app.allgrafika.pl/register?utm_source=landing&utm_medium=tool&utm_content=photo-checker',
  )

  // AC-TOOL-005: nothing but GETs of the site's own assets, no body, no file name, no image bytes
  await page.waitForTimeout(500)
  const during = requests.slice(before).filter((r) => r.url.startsWith('http'))
  for (const r of requests.filter((x) => x.url.startsWith('http'))) {
    expect(r.method, r.url).toBe('GET')
    expect(r.body, r.url).toBeNull()
    expect(new URL(r.url).hostname, r.url).toBe('localhost')
    for (const f of files) expect(r.url, r.url).not.toContain(encodeURIComponent(f.name).slice(0, 12))
  }
  expect(
    during.filter((r) => !/\.(js|css|png|webp|svg|ico|woff2?)(\?|$)/.test(r.url)),
    'only static assets while checking',
  ).toEqual([])

  // AC-TOOL-004: 320 px – no horizontal scroll with the results on screen
  await page.setViewportSize({ width: 320, height: 700 })
  await page.waitForTimeout(200)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(problems.filter((p) => /hydrat|did not match|Minified React error|Warning:|pageerror/i.test(p))).toEqual([])
})

test('[AC-TOOL-004] keyboard: the file input is reachable with Tab and "Wyczyść wyniki" works with Enter', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Safari moves focus with Tab only to form fields when the "Press Tab to highlight" setting is on')
  const input = await openTool(page)
  let focused = false
  for (let i = 0; i < 80 && !focused; i++) {
    await page.keyboard.press('Tab')
    focused = await input.evaluate((el) => el === document.activeElement)
  }
  expect(focused, 'Tab reaches the file input').toBe(true)
  await expect(input).toHaveAccessibleName('Wybierz zdjęcia produktu')

  await input.setInputFiles((await fixtures()).slice(0, 1))
  await expect(page.getByTestId('photo-result')).toHaveCount(1)
  const clear = page.getByRole('button', { name: 'Wyczyść wyniki' })
  await clear.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('photo-result')).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Wyniki wyczyszczone.' })).toBeVisible()
})

test('[AC-TOOL-004] drag & drop of a photo onto the drop zone', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop-chrome', 'drag & drop is a desktop gesture')
  await openTool(page)
  const [white] = await fixtures()
  const dataTransfer = await page.evaluateHandle(
    ([bytes, name]) => {
      const dt = new DataTransfer()
      dt.items.add(new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' }))
      return dt
    },
    [[...white.buffer], white.name] as const,
  )
  const zone = page.getByTestId('photo-dropzone')
  await zone.dispatchEvent('dragover', { dataTransfer })
  await zone.dispatchEvent('drop', { dataTransfer })
  await expect(page.getByTestId('photo-result')).toHaveCount(1)
  await expect(page.getByTestId('photo-result')).toContainText('1600 × 1600 px')
})

test('[AC-TOOL-006] client-side navigation from the footer loads the tool chunk and renders the page', async ({ page }) => {
  const { problems } = watch(page)
  await page.goto('/blog')
  await page.locator('footer').getByRole('link', { name: 'Sprawdź zdjęcie produktu' }).click()
  await expect(page).toHaveURL(new RegExp(`${ROUTE}$`))
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(H1)
  await expect(page).toHaveTitle(TITLE)
  await expect(page.getByLabel('Wybierz zdjęcia produktu')).toBeEnabled()
  expect(problems.filter((p) => /Minified React error|Warning:|pageerror/i.test(p))).toEqual([])
})
