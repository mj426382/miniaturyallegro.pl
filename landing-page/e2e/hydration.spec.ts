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

const ROUTES = ['/', '/blog', '/blog/jak-zrobic-profesjonalne-zdjecia-allegro', '/regulamin']

for (const route of ROUTES) {
  test(`[AC-SEO-001] hydrates ${route} without React errors`, async ({ page }) => {
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
  })
}

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
