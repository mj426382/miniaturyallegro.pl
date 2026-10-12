import { test, expect, Page, Request } from '@playwright/test'

/**
 * Spec 22: Google Analytics 4 next to Google Ads in ONE Google tag, consent per category
 * (the build uses the test IDs G-TEST and AW-TEST). Google is never contacted: requests are recorded
 * and answered with an empty script, so only what the page pushes into dataLayer is checked.
 */
test.use({ storageState: { cookies: [], origins: [] } })

const GOOGLE = /googletagmanager\.com|googleadservices\.com|doubleclick\.net|google-analytics\.com|analytics\.google\.com/
const ALL_DENIED = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }
const GA_CONFIG = ['config', 'G-TEST', { send_page_view: false, cookie_expires: 400 * 24 * 60 * 60 }]

async function recordGoogle(page: Page) {
  const requests: string[] = []
  await page.route(GOOGLE, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
  page.on('request', (r: Request) => {
    if (GOOGLE.test(r.url())) requests.push(r.url())
  })
  return requests
}

const tagRequests = (requests: string[]) => requests.filter((u) => u.includes('googletagmanager.com/gtag/js'))

/** dataLayer entries are `arguments` objects – turned into arrays. */
async function layer(page: Page): Promise<unknown[][]> {
  return page.evaluate(() => (((window as any).dataLayer as unknown[]) ?? []).map((e) => Array.from(e as ArrayLike<unknown>)))
}

const events = (entries: unknown[][], name: string) => entries.filter((e) => e[0] === 'event' && e[1] === name)

async function storedDecision(page: Page, value: string) {
  await page.context().addCookies([{ name: 'ag_consent', value, domain: 'localhost', path: '/' }])
}

async function consentCookie(page: Page) {
  return (await page.context().cookies()).find((c) => c.name === 'ag_consent')?.value
}

const banner = (page: Page) => page.getByRole('region', { name: 'Zgoda na pliki cookies' })

test('[AC-GA-001] the banner offers necessary, analytics and marketing categories, nothing pre-ticked and nothing sent', async ({ page }) => {
  const google = await recordGoogle(page)
  await page.goto('/')
  await expect(banner(page)).toContainText('Google Analytics')
  await expect(banner(page)).toContainText('Google Ads')
  await banner(page).getByRole('button', { name: 'Dostosuj' }).click()

  const necessary = banner(page).getByRole('checkbox', { name: /Niezbędne/ })
  await expect(necessary).toBeChecked()
  await expect(necessary).toBeDisabled()
  await expect(banner(page).getByRole('checkbox', { name: /Analityczne/ })).not.toBeChecked()
  await expect(banner(page).getByRole('checkbox', { name: /Marketingowe/ })).not.toBeChecked()
  for (const name of ['Odrzucam', 'Zapisz wybór', 'Akceptuję']) await expect(banner(page).getByRole('button', { name })).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(google).toEqual([])
})

test('[AC-GA-002] refusing everything never loads gtag.js, also after navigation and reload', async ({ page }) => {
  const google = await recordGoogle(page)
  await page.goto('/')
  await banner(page).getByRole('button', { name: 'Odrzucam' }).click()
  expect(await consentCookie(page)).toBe('ads=0&analytics=0&v=2')

  await page.locator('footer').getByRole('link', { name: 'Blog', exact: true }).click()
  await expect(page).toHaveURL(/\/blog$/)
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(banner(page)).toHaveCount(0)
  expect(google).toEqual([])
  expect(await layer(page)).toEqual([])
})

test('[AC-GA-003] analytics-only consent configures GA4 while Ads stays denied and unconfigured', async ({ page }) => {
  const google = await recordGoogle(page)
  await page.goto('/')
  await banner(page).getByRole('button', { name: 'Dostosuj' }).click()
  await banner(page)
    .getByRole('checkbox', { name: /Analityczne/ })
    .check()
  await banner(page).getByRole('button', { name: 'Zapisz wybór' }).click()
  expect(await consentCookie(page)).toBe('ads=0&analytics=1&v=2')

  await expect.poll(() => tagRequests(google)).toHaveLength(1)
  expect(tagRequests(google)[0]).toContain('gtag/js?id=G-TEST')
  const entries = await layer(page)
  const consent = entries.filter((e) => e[0] === 'consent')
  expect(consent[0]).toEqual(['consent', 'default', ALL_DENIED])
  expect(consent[1]).toEqual(['consent', 'update', { ...ALL_DENIED, analytics_storage: 'granted' }])
  expect(entries).toContainEqual(GA_CONFIG)
  expect(entries.some((e) => e[0] === 'config' && e[1] === 'AW-TEST')).toBe(false)
  await expect.poll(async () => events(await layer(page), 'page_view')).toHaveLength(1)
  expect(google.some((u) => /googleadservices|doubleclick/.test(u))).toBe(false)
})

test('[AC-GA-004] full consent loads gtag.js once with both GA4 and Ads configured', async ({ page }) => {
  const google = await recordGoogle(page)
  await page.goto('/')
  await banner(page).getByRole('button', { name: 'Akceptuję' }).click()
  expect(await consentCookie(page)).toBe('ads=1&analytics=1&v=2')

  await expect.poll(() => tagRequests(google)).toHaveLength(1)
  expect(await page.locator('script[src*="googletagmanager.com/gtag/js"]').count()).toBe(1)
  const entries = await layer(page)
  expect(entries.filter((e) => e[0] === 'consent')[1]).toEqual(['consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' }])
  expect(entries).toContainEqual(GA_CONFIG)
  expect(entries).toContainEqual(['config', 'AW-TEST'])
  // A GA4 page view goes only to GA4, so Google Ads does not count it twice.
  expect(events(entries, 'page_view').map((e) => (e[2] as { send_to: string }).send_to)).toEqual(['G-TEST'])
})

test('[AC-GA-005] a stored v1 "ads=1" keeps Google Ads running and asks again only about analytics', async ({ page }) => {
  const google = await recordGoogle(page)
  await storedDecision(page, 'ads=1')
  await page.goto('/')
  await expect.poll(() => tagRequests(google)).toHaveLength(1)
  expect(tagRequests(google)[0]).toContain('gtag/js?id=AW-TEST')
  const consent = (await layer(page)).filter((e) => e[0] === 'consent')
  expect(consent[1]).toEqual(['consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'denied' }])

  await expect(banner(page)).toContainText('Dodaliśmy nową kategorię')
  await banner(page).getByRole('button', { name: 'Dostosuj' }).click()
  await expect(banner(page).getByRole('checkbox', { name: /Marketingowe/ })).toBeChecked()
  await banner(page)
    .getByRole('checkbox', { name: /Analityczne/ })
    .check()
  await banner(page).getByRole('button', { name: 'Zapisz wybór' }).click()
  expect(await consentCookie(page)).toBe('ads=1&analytics=1&v=2')
  expect(await layer(page)).toContainEqual(GA_CONFIG)
  expect(tagRequests(google)).toHaveLength(1)
})

test('[AC-GA-005] a stored v1 "ads=0" loads nothing and asks again', async ({ page }) => {
  const google = await recordGoogle(page)
  await storedDecision(page, 'ads=0')
  await page.goto('/')
  await expect(banner(page)).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(google).toEqual([])
})

test('[AC-GA-006] page_view on load and on client-side route changes, with a URL stripped of non-campaign parameters', async ({ page }) => {
  await recordGoogle(page)
  await storedDecision(page, 'ads=0&analytics=1&v=2')
  await page.goto('/?utm_source=google&utm_campaign=jesien&gclid=abc123&token=secret-token&email=jan%40example.com#cennik')
  await expect.poll(async () => events(await layer(page), 'page_view')).toHaveLength(1)
  expect(events(await layer(page), 'page_view')[0][2]).toMatchObject({ send_to: 'G-TEST', page_location: 'http://localhost:4174/?utm_source=google&utm_campaign=jesien&gclid=abc123' })

  await page.locator('footer').getByRole('link', { name: 'Blog', exact: true }).click()
  await expect.poll(async () => events(await layer(page), 'page_view')).toHaveLength(2)
  const blogView = events(await layer(page), 'page_view')[1][2] as { page_location: string; page_title: string }
  expect(blogView.page_location).toBe('http://localhost:4174/blog')
  expect(blogView.page_title).toBe(await page.title())
  expect(JSON.stringify(await layer(page))).not.toMatch(/secret-token|example\.com/)
})

test('[AC-GA-007] a CTA click is a GA4 cta_click with its location, never an Ads conversion', async ({ page }) => {
  await recordGoogle(page)
  await storedDecision(page, 'ads=1&analytics=1&v=2')
  await page.goto('/')
  // Stay on the page: the link leads to the app.
  await page.evaluate(() => document.addEventListener('click', (e) => e.preventDefault(), true))
  await page.getByRole('link', { name: 'Załóż konto – 5 grafik gratis' }).first().click()
  const entries = await layer(page)
  expect(events(entries, 'cta_click')).toEqual([['event', 'cta_click', { location: 'hero', destination: 'register', send_to: 'G-TEST' }]])
  expect(events(entries, 'conversion')).toEqual([])
})

test('[AC-GA-007] without analytics consent a CTA click sends no GA4 event', async ({ page }) => {
  await recordGoogle(page)
  await storedDecision(page, 'ads=1&analytics=0&v=2')
  await page.goto('/')
  await page.evaluate(() => document.addEventListener('click', (e) => e.preventDefault(), true))
  await page.getByRole('link', { name: 'Załóż konto – 5 grafik gratis' }).first().click()
  const entries = await layer(page)
  expect(events(entries, 'cta_click')).toEqual([])
  expect(entries.some((e) => e[0] === 'config' && e[1] === 'G-TEST')).toBe(false)
})

test('[AC-GA-007] the demo form is a GA4 generate_lead without the e-mail address', async ({ page }) => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64')
  const API = 'https://server.allgrafika.pl/api'
  await recordGoogle(page)
  await page.route(`${API}/demo`, (route) => route.fulfill({ status: 201, json: { id: 'demo-1' } }))
  await page.route(`${API}/demo/demo-1`, (route) => route.fulfill({ json: { id: 'demo-1', status: 'PROCESSING', originalUrl: '', resultUrl: null, registerUrl: '' } }))
  await storedDecision(page, 'ads=0&analytics=1&v=2')
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('#demo input[type="file"]').setInputFiles({ name: 'produkt.png', mimeType: 'image/png', buffer: PNG })
  await page.getByPlaceholder('twoj@sklep.pl').fill('sprzedawca@example.com')
  await page.locator('#demo label').filter({ hasText: 'Akceptuję' }).locator('input[type="checkbox"]').check()
  await page.getByRole('button', { name: 'Wygeneruj darmową grafikę' }).click()

  await expect.poll(async () => events(await layer(page), 'generate_lead')).toEqual([['event', 'generate_lead', { lead_source: 'demo', send_to: 'G-TEST' }]])
  expect(JSON.stringify(await layer(page))).not.toContain('sprzedawca@example.com')
})

test('[AC-GA-008] withdrawing analytics consent stops GA4 and deletes the _ga cookies, Ads keeps its consent', async ({ page }) => {
  await recordGoogle(page)
  await storedDecision(page, 'ads=1&analytics=1&v=2')
  await page.context().addCookies([
    { name: '_ga', value: 'GA1.1.123.456', domain: 'localhost', path: '/' },
    { name: '_ga_TEST', value: 'GS1.1.1.1', domain: 'localhost', path: '/' },
  ])
  await page.goto('/')
  await page.locator('footer').getByRole('button', { name: 'Ustawienia cookies' }).click()
  const analytics = banner(page).getByRole('checkbox', { name: /Analityczne/ })
  await expect(analytics).toBeChecked()
  await analytics.uncheck()
  await banner(page).getByRole('button', { name: 'Zapisz wybór' }).click()

  expect(await consentCookie(page)).toBe('ads=1&analytics=0&v=2')
  expect((await page.context().cookies()).some((c) => c.name.startsWith('_ga'))).toBe(false)
  expect((await layer(page)).slice(-1)[0]).toEqual(['consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'denied' }])
  expect(await page.evaluate(() => (window as any)['ga-disable-G-TEST'])).toBe(true)
})
