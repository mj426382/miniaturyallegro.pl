import { test, expect, Page, Request } from '@playwright/test'

/** Spec 21: cookie consent for Google Ads on the landing page (the build uses the test ID AW-TEST). */
test.use({ storageState: { cookies: [], origins: [] } })

const GOOGLE = /googletagmanager\.com|googleadservices\.com|doubleclick\.net|google-analytics\.com/

/** Google is never really contacted from tests: requests are recorded and answered with an empty script. */
async function recordGoogle(page: Page) {
  const requests: string[] = []
  await page.route(GOOGLE, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
  page.on('request', (r: Request) => {
    if (GOOGLE.test(r.url())) requests.push(r.url())
  })
  return requests
}

async function consentCookie(page: Page) {
  return (await page.context().cookies()).find((c) => c.name === 'ag_consent')?.value
}

test('[AC-ADS-001] first visit shows the banner with equal choices and contacts no Google domain', async ({ page, request }) => {
  const html = await (await request.get('/')).text()
  expect(html).not.toContain('Zgoda na pliki cookies')

  const google = await recordGoogle(page)
  await page.goto('/')
  const banner = page.getByRole('region', { name: 'Zgoda na pliki cookies' })
  await expect(banner).toBeVisible()
  const accept = banner.getByRole('button', { name: 'Akceptuję' })
  const refuse = banner.getByRole('button', { name: 'Odrzucam' })
  const [a, r] = [await accept.boundingBox(), await refuse.boundingBox()]
  expect(Math.abs((a?.height ?? 0) - (r?.height ?? 0))).toBeLessThanOrEqual(1)
  expect(Math.abs((a?.width ?? 0) - (r?.width ?? 0))).toBeLessThanOrEqual(4)
  await expect(banner.getByRole('link', { name: 'Polityka prywatności' })).toHaveAttribute('href', 'https://allgrafika.pl/polityka-prywatnosci')
  await page.waitForLoadState('networkidle')
  expect(google).toEqual([])
})

test('[AC-ADS-002] refusing hides the banner for good and Google is never loaded', async ({ page }) => {
  const google = await recordGoogle(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Odrzucam' }).click()
  await expect(page.getByRole('region', { name: 'Zgoda na pliki cookies' })).toHaveCount(0)
  expect(await consentCookie(page)).toBe('ads=0')

  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('region', { name: 'Zgoda na pliki cookies' })).toHaveCount(0)
  expect(google).toEqual([])
})

test('[AC-ADS-003] accepting loads gtag with Consent Mode v2 (default denied, then granted)', async ({ page }) => {
  const google = await recordGoogle(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Akceptuję' }).click()
  expect(await consentCookie(page)).toBe('ads=1')
  await expect.poll(() => google.some((u) => u.includes('googletagmanager.com/gtag/js?id=AW-TEST'))).toBe(true)

  const consent = await page.evaluate(() => (((window as any).dataLayer as unknown[]) ?? []).map((e) => Array.from(e as ArrayLike<unknown>)).filter((e) => e[0] === 'consent'))
  expect(consent[0]).toEqual(['consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }])
  expect(consent[1]).toEqual(['consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'denied' }])

  // The decision is remembered: the next page loads the tag without asking again.
  await page.goto('/blog')
  await expect(page.getByRole('region', { name: 'Zgoda na pliki cookies' })).toHaveCount(0)
})

test('[AC-ADS-004] "Ustawienia cookies" in the footer lets the visitor withdraw consent', async ({ page }) => {
  await recordGoogle(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Akceptuję' }).click()
  await page.context().addCookies([{ name: '_gcl_aw', value: 'GCL.1.test', domain: 'localhost', path: '/' }])

  await page.locator('footer').getByRole('button', { name: 'Ustawienia cookies' }).click()
  await page.getByRole('region', { name: 'Zgoda na pliki cookies' }).getByRole('button', { name: 'Odrzucam' }).click()
  expect(await consentCookie(page)).toBe('ads=0')
  expect((await page.context().cookies()).some((c) => c.name.startsWith('_gcl_'))).toBe(false)
  const last = await page.evaluate(() => Array.from((((window as any).dataLayer as unknown[]) ?? []).slice(-1)[0] as ArrayLike<unknown>))
  expect(last).toEqual(['consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }])
})
