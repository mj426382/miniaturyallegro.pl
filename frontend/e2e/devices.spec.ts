import { expect, test, Page } from '@playwright/test'
import { IMAGE, mockApp } from './fixtures'

/**
 * Spec 17: layout on every device profile – desktop, phones and tablets (iPad, Galaxy Tab).
 * Each test runs on all projects from playwright.config.ts unless it says otherwise.
 */
const SCREENS = [
  { path: '/', heading: /Witaj/ },
  { path: '/upload', heading: /Prześlij/ },
  { path: '/bulk-upload', heading: /Masowe/ },
  { path: `/generate/${IMAGE.id}`, heading: 'Generator grafik produktowych' },
  { path: '/gallery', heading: 'Galeria' },
  { path: '/credits', heading: /Kredyty|Cennik/ },
  { path: '/account', heading: /Konto|Ustawienia/ },
  { path: '/allegro', heading: /Allegro/ },
  { path: '/admin', heading: /Panel administratora|Admin/ },
]

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
}

const isTablet = () => ['ipad', 'galaxy-tab'].includes(test.info().project.name)

for (const screen of SCREENS) {
  test(`[AC-RWD-001] ${screen.path} fits the screen without horizontal scrolling`, async ({ page }) => {
    await mockApp(page, { isAdmin: true })
    await page.goto(screen.path)
    await expect(page.getByRole('heading', { level: 1, name: screen.heading })).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  })
}

test('[AC-RWD-002] the dashboard on a tablet has compact stat cards and one-line card actions', async ({ page }) => {
  test.skip(!isTablet(), 'tablet layout only')
  await mockApp(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Witaj/ })).toBeVisible()

  const cards = page.getByTestId('dashboard-stats').locator(':scope > div')
  await expect(cards).toHaveCount(3)
  for (const i of [0, 1]) {
    const box = await cards.nth(i).boundingBox()
    expect(box!.height, `stat card ${i}`).toBeLessThanOrEqual(160)
  }

  const action = page.getByRole('link', { name: 'Zobacz warianty' }).first()
  await expect(action).toBeVisible()
  const lineHeight = await action.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight))
  const box = await action.boundingBox()
  // py-2 (16 px) + one line of text; two lines would add another line height.
  expect(box!.height).toBeLessThan(16 + lineHeight * 1.5)
})

test('[AC-RWD-003] the admin user list is a list of cards on phones and tablets', async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 1024, 'cards replace the table below the lg breakpoint')
  await mockApp(page, { isAdmin: true })
  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await expect(page.locator('table')).toBeHidden()
  const cards = page.getByTestId('admin-user-card')
  await expect(cards.first()).toBeVisible()
  const first = cards.first()
  await expect(first).toContainText('@')
  await expect(first).toContainText('Grafiki')
  await expect(first).toContainText('Plan')
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)

  await first.click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('[AC-UX-001] the gallery says "1 przesłane zdjęcie" for a single photo', async ({ page }) => {
  await mockApp(page)
  await page.goto('/gallery')
  await expect(page.getByText('1 przesłane zdjęcie', { exact: true })).toBeVisible()
})

test('[AC-UX-002] the sign-up page explains that the free graphics unlock after confirming the e-mail', async ({ page }) => {
  await mockApp(page, { loggedIn: false })
  await page.goto('/register')
  await expect(page.getByText(/odblokujesz je, potwierdzając adres e-mail/)).toBeVisible()
})
