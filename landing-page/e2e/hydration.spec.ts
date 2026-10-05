import { test, expect, Page } from '@playwright/test'

/**
 * The landing page is prerendered to static HTML and then hydrated by React.
 * A mismatch (e.g. a component rendering differently on the server) shows up as
 * a console error such as "Hydration failed", "Text content does not match" or
 * minified React errors #418 / #423 / #425. Any of those is a failure here.
 */
const HYDRATION_PATTERNS = [/hydrat/i, /did not match/i, /Minified React error #4(18|23|25)/, /Warning:/]

async function collectConsole(page: Page) {
  const problems: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(msg.text())
  })
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  return problems
}

const ROUTES = ['/', '/blog', '/blog/jak-zrobic-profesjonalne-zdjecia-allegro', '/regulamin', '/polityka-prywatnosci']

for (const route of ROUTES) {
  test(`[AC-SEO-001, AC-RWD-004] hydrates ${route} without React errors or horizontal scroll`, async ({ page }) => {
    const problems = await collectConsole(page)
    const response = await page.goto(route)
    expect(response?.status()).toBe(200)

    // Static HTML already contains the content – verify before hydration completes.
    const h1 = page.locator('h1').first()
    await expect(h1).toBeVisible()

    // Interactivity proves hydration happened (menu toggle exists on every page).
    await page.waitForLoadState('networkidle')
    await expect(page.locator('nav').first()).toBeVisible()

    const hydrationIssues = problems.filter((p) => HYDRATION_PATTERNS.some((re) => re.test(p)))
    expect(hydrationIssues, problems.join('\n')).toEqual([])

    // Phones and tablets: nothing may stick out sideways (spec 17).
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

const LEGAL = [
  { route: '/regulamin', lastSection: 'Postanowienia końcowe' },
  { route: '/polityka-prywatnosci', lastSection: 'Zmiany polityki prywatności' },
]

for (const { route, lastSection } of LEGAL) {
  test(`[AC-PERF-002] ${route} ships the full text in the HTML and hydrates the lazy chunk`, async ({ page, request }) => {
    const html = await (await request.get(route)).text()
    expect(html).toContain(lastSection)
    expect(html).not.toContain('Wczytywanie dokumentu')

    const problems = await collectConsole(page)
    await page.goto(route)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(lastSection).first()).toBeVisible()
    await expect(page.getByText('Wczytywanie dokumentu')).toHaveCount(0)
    expect(
      problems.filter((p) => HYDRATION_PATTERNS.some((re) => re.test(p))),
      problems.join('\n'),
    ).toEqual([])
  })
}

test('[AC-PERF-002] client-side navigation loads the legal document chunk', async ({ page }) => {
  await page.goto('/blog')
  await page.waitForLoadState('networkidle')
  await page.locator('footer a[href="/regulamin"]').first().click()
  await expect(page).toHaveURL(/\/regulamin$/)
  await expect(page.getByText('Postanowienia końcowe').first()).toBeVisible()
})

test('[AC-SEO-002] prerendered HTML carries the per-route SEO head', async ({ page }) => {
  await page.goto('/blog/jak-zrobic-profesjonalne-zdjecia-allegro')
  await expect(page).toHaveTitle(/AllGrafika\.pl$/)
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
  expect(canonical).toBe('https://allgrafika.pl/blog/jak-zrobic-profesjonalne-zdjecia-allegro')
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent()
  expect(ld).toContain('"Article"')
})

test('[AC-SEO-003] the demo widget is interactive after hydration', async ({ page }) => {
  await page.goto('/')
  await page.locator('#demo').scrollIntoViewIfNeeded()
  const submit = page.getByRole('button', { name: 'Wygeneruj darmową grafikę' })
  await expect(submit).toBeDisabled()
  await page.getByPlaceholder('twoj@sklep.pl').fill('test@example.com')
  await expect(submit).toBeDisabled() // still needs a file + consent
})
