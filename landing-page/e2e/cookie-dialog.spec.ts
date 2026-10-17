import { test, expect, type Locator, type Page } from '@playwright/test'

/**
 * Spec 11, AC-UI-010: the per-category cookie choice is a modal dialog on the landing page too (the banner and its
 * dialog hook are identical copies of the app's) – focus stays inside, the page behind is inert, Escape closes,
 * focus returns to what opened it. The summary banner itself stays a non-modal region.
 */
async function expectTabCycle(page: Page, dialog: Locator) {
  await page.evaluate(() => document.activeElement?.setAttribute('data-tab-start', ''))
  const stops: string[] = []
  for (let i = 0; i < 40 && !stops.includes('<start>'); i++) {
    await page.keyboard.press('Tab')
    const stop = await dialog.evaluate((d) => {
      const el = document.activeElement as HTMLElement | null
      if (!el || !d.contains(el)) return `<outside:${el?.tagName ?? 'none'}>`
      return el.hasAttribute('data-tab-start') ? '<start>' : (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40)
    })
    expect(stop, `Tab stop ${i + 1} left the dialog`).not.toMatch(/^<outside/)
    stops.push(stop)
  }
  await page.evaluate(() => document.querySelector('[data-tab-start]')?.removeAttribute('data-tab-start'))
  expect(stops.at(-1)).toBe('<start>')
  return stops
}

async function expectPageInert(dialog: Locator) {
  const result = await dialog.evaluate((d) => {
    const root = d.closest('[data-dialog-root]') ?? d
    const outside = Array.from(document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea')).filter((el) => !root.contains(el))
    return { count: outside.length, active: outside.filter((el) => !el.closest('[inert]')).length }
  })
  expect(result.count).toBeGreaterThan(0)
  expect(result.active).toBe(0)
}

test('[AC-UI-010] „Ustawienia cookies” in the footer opens a modal dialog that traps focus and returns it', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const opener = page.locator('footer').getByRole('button', { name: 'Ustawienia cookies' })
  await opener.focus()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Ustawienia plików cookies' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  await expect.poll(() => dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
  const stops = await expectTabCycle(page, dialog)
  for (const name of ['Odrzucam', 'Zapisz wybór', 'Akceptuję']) expect(stops).toContain(name)
  await expectPageInert(dialog)

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Zgoda na pliki cookies' })).toHaveCount(0)
  await expect(opener).toBeFocused()
  expect(await page.locator('[inert]').count()).toBe(0)
})

test.describe('first visit', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('[AC-UI-010] „Dostosuj” opens the dialog; Escape goes back to the banner with focus on „Dostosuj”', async ({ page }) => {
    await page.route(/googletagmanager\.com|google-analytics\.com|googleadservices\.com|doubleclick\.net/, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
    await page.goto('/')
    const banner = page.getByRole('region', { name: 'Zgoda na pliki cookies' })
    await expect(banner).toBeVisible()
    // The summary is not modal: the page stays usable.
    expect(await page.locator('[inert]').count()).toBe(0)

    await banner.getByRole('button', { name: 'Dostosuj' }).click()
    const dialog = page.getByRole('dialog', { name: 'Ustawienia plików cookies' })
    await expect(dialog).toBeVisible()
    await expectPageInert(dialog)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(banner.getByRole('button', { name: 'Dostosuj' })).toBeFocused()
    await expect(banner.getByRole('button', { name: 'Akceptuję' })).toBeVisible()
    expect(await page.locator('[inert]').count()).toBe(0)
  })
})
