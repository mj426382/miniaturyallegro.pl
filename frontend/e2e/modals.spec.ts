import { test, expect, Page, Locator } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { IMAGE, mockApp, MockOptions } from './fixtures'

/**
 * Spec 11, AC-UI-010 / AC-UI-011 / AC-UI-012: every dialog of the app behaves the same on every device –
 * focus inside, Tab and Shift+Tab cycle without leaving, the page behind is inert, Escape closes, focus returns
 * to the opener, no serious/critical axe violation with the dialog open; a confirmation can sit on top of export.
 */
const SECOND_IMAGE = {
  ...IMAGE,
  id: 'img-2',
  originalUrl: '/api/uploads/originals/img-2.jpg',
  generations: [{ id: 'gen-21', style: 'gradient-bg', status: 'COMPLETED', url: '/api/uploads/generated/gen-21.png', rating: null, createdAt: '2026-10-02T10:00:00.000Z' }],
}
const isMobile = (page: Page) => page.viewportSize()!.width < 1024

/** Presses Tab (or Shift+Tab) until focus is back where it started; every stop must be inside the dialog. */
async function expectTabCycle(page: Page, dialog: Locator, shift = false) {
  await page.evaluate(() => document.activeElement?.setAttribute('data-tab-start', ''))
  const stops: string[] = []
  for (let i = 0; i < 80 && !stops.includes('<start>'); i++) {
    await page.keyboard.press(shift ? 'Shift+Tab' : 'Tab')
    const stop = await dialog.evaluate((d) => {
      const el = document.activeElement as HTMLElement | null
      if (!el || !d.contains(el)) return `<outside:${el?.tagName ?? 'none'}>`
      return el.hasAttribute('data-tab-start') ? '<start>' : (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40)
    })
    expect(stop, `Tab stop ${i + 1} left the dialog`).not.toMatch(/^<outside/)
    stops.push(stop)
  }
  await page.evaluate(() => document.querySelector('[data-tab-start]')?.removeAttribute('data-tab-start'))
  expect(stops.at(-1), `focus did not come back to the start (${stops.join(' → ')})`).toBe('<start>')
  return stops
}

/** Everything interactive outside the dialog (except toasts) is inert and cannot take focus. */
async function expectBackgroundInert(dialog: Locator) {
  const result = await dialog.evaluate((d) => {
    const root = d.closest('[data-dialog-root]') ?? d
    const outside = Array.from(document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea')).filter((el) => !root.contains(el) && !el.closest('[data-dialog-keep]'))
    const before = document.activeElement
    outside.forEach((el) => el.focus())
    return {
      count: outside.length,
      active: outside.filter((el) => !el.closest('[inert]')).map((el) => el.outerHTML.slice(0, 100)),
      focusMoved: document.activeElement !== before,
    }
  })
  expect(result.count, 'the page behind the dialog has controls').toBeGreaterThan(0)
  expect(result.active, 'controls behind the dialog that are not inert').toEqual([])
  expect(result.focusMoved, 'a control behind the dialog took focus').toBe(false)
}

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(
    blocking.map((v) => `${v.id}: ${v.help} – ${v.nodes.map((n) => n.html.slice(0, 80)).join(' | ')}`),
    'serious/critical axe violations with the dialog open',
  ).toEqual([])
}

interface Case {
  name: string
  options?: MockOptions
  /** Navigates and returns the opener; `open` then opens the dialog from it. */
  setup: (page: Page) => Promise<Locator>
  open: (page: Page, opener: Locator) => Promise<void>
  dialog: (page: Page) => Locator
  /** Waits until the dialog's own data arrived, so its tab stops do not change while they are counted. */
  ready?: (dialog: Locator) => Promise<void>
}

const openMenuItem = (item: string) => async (page: Page, opener: Locator) => {
  await opener.click()
  await page.getByRole('menuitem', { name: item }).click()
}

const CASES: Case[] = [
  {
    name: 'export (opened with the keyboard from „Więcej akcji”)',
    setup: async (page) => {
      await page.goto(`/generate/${IMAGE.id}`)
      return page.getByRole('button', { name: 'Więcej akcji' }).first()
    },
    open: async (page, opener) => {
      await opener.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('menuitem', { name: 'Eksport i edycja' })).toBeFocused()
      await page.keyboard.press('Enter')
    },
    dialog: (page) => page.getByRole('dialog', { name: 'Eksportuj grafikę' }),
    ready: (dialog) => expect(dialog.getByRole('button', { name: 'Dalej' })).toBeEnabled(),
  },
  {
    name: 'export of the original photo',
    setup: async (page) => {
      await page.goto(`/generate/${IMAGE.id}`)
      return page.getByRole('button', { name: /Eksportuj oryginał/ })
    },
    open: async (_page, opener) => opener.click(),
    dialog: (page) => page.getByRole('dialog', { name: 'Eksportuj oryginalne zdjęcie' }),
    ready: (dialog) => expect(dialog.getByRole('button', { name: 'Pobierz zdjęcie' })).toBeEnabled(),
  },
  {
    name: 'infographic',
    setup: async (page) => {
      await page.goto(`/generate/${IMAGE.id}`)
      return page.getByRole('button', { name: 'Więcej akcji' }).first()
    },
    open: openMenuItem('Infografika'),
    dialog: (page) => page.getByRole('dialog', { name: 'Infografika – zdjęcie dodatkowe' }),
  },
  {
    name: 'offer when credits run out',
    options: { noCredits: true },
    setup: async (page) => {
      await page.goto(`/generate/${IMAGE.id}`)
      await page.getByRole('button', { name: 'Pokaż style' }).click()
      return page.getByRole('button', { name: /^Generuj \d+ grafik/ })
    },
    open: async (_page, opener) => opener.click(),
    dialog: (page) => page.getByRole('dialog', { name: /Brakuje Ci/ }),
    ready: (dialog) => expect(dialog.getByRole('button', { name: /^5 kredytów/ })).toBeVisible(),
  },
  {
    name: 'confirmation (delete photo)',
    setup: async (page) => {
      await page.goto(`/generate/${IMAGE.id}`)
      return page.getByRole('button', { name: 'Usuń zdjęcie' })
    },
    open: async (_page, opener) => opener.click(),
    dialog: (page) => page.getByRole('alertdialog', { name: 'Usunąć to zdjęcie?' }),
  },
  {
    name: 'descriptions for selected photos',
    options: { extraImages: [SECOND_IMAGE] },
    setup: async (page) => {
      await page.goto('/gallery')
      await page.getByRole('button', { name: 'Zaznacz', exact: true }).click()
      await page.getByRole('button', { name: 'Zaznacz wszystkie na stronie' }).click()
      return page.getByRole('toolbar', { name: 'Akcje dla zaznaczonych zdjęć' }).getByRole('button', { name: 'Napisz opisy' })
    },
    open: async (_page, opener) => opener.click(),
    dialog: (page) => page.getByRole('dialog', { name: /Opisy dla zaznaczonych/ }),
  },
  {
    name: 'user details in the admin panel',
    options: { isAdmin: true },
    setup: async (page) => {
      await page.goto('/admin')
      return page
        .getByRole('button', { name: /sklep\.kubki@example\.com/ })
        .filter({ visible: true })
        .first()
    },
    open: async (_page, opener) => opener.click(),
    dialog: (page) => page.getByRole('dialog', { name: 'sklep.kubki@example.com' }),
    ready: (dialog) => expect(dialog.getByText('Start (active)')).toBeVisible(),
  },
  {
    name: 'cookie settings',
    setup: async (page) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: /Witaj/ })).toBeVisible()
      if (isMobile(page)) await page.getByRole('button', { name: 'Otwórz menu' }).click()
      return page.getByRole('button', { name: 'Cookies', exact: true }).filter({ visible: true }).first()
    },
    open: async (_page, opener) => opener.click(),
    dialog: (page) => page.getByRole('dialog', { name: 'Ustawienia plików cookies' }),
  },
]

for (const c of CASES) {
  test(`[AC-UI-010, AC-UI-012] ${c.name}: focus trap, inert page, Escape, focus return, no serious axe violations`, async ({ page }) => {
    await mockApp(page, c.options)
    const opener = await c.setup(page)
    await expect(opener).toBeVisible()
    await c.open(page, opener)

    const dialog = c.dialog(page)
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
    await c.ready?.(dialog)
    await expect.poll(() => dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)

    const forward = await expectTabCycle(page, dialog)
    const backward = await expectTabCycle(page, dialog, true)
    // Shift+Tab visits the same stops in reverse order.
    expect(backward.slice(0, -1)).toEqual(forward.slice(0, -1).reverse())
    await expectBackgroundInert(dialog)
    await expectNoSeriousA11yViolations(page)

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    expect(await page.locator('[inert]').count()).toBe(0)
  })
}

test('[AC-UI-010] the descriptions dialog cannot be closed while it is writing, then closes normally', async ({ page }) => {
  await mockApp(page, { extraImages: [SECOND_IMAGE] })
  // The first description is held until the test has tried to close the dialog, so the batch is surely running.
  let release!: () => void
  const released = new Promise<void>((resolve) => (release = resolve))
  await page.route(`**/api/descriptions/${IMAGE.id}`, async (route) => {
    if (route.request().method() === 'POST') await released
    await route.fallback()
  })
  await page.goto('/gallery')
  await page.getByRole('button', { name: 'Zaznacz', exact: true }).click()
  await page.getByRole('button', { name: 'Zaznacz wszystkie na stronie' }).click()
  await page.getByRole('toolbar', { name: 'Akcje dla zaznaczonych zdjęć' }).getByRole('button', { name: 'Napisz opisy' }).click()
  const dialog = page.getByRole('dialog', { name: /Opisy dla zaznaczonych/ })
  await dialog.getByRole('button', { name: 'Napisz opisy' }).click()
  await expect(dialog.getByRole('button', { name: 'Przerwij' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Zamknij okno' }).click({ position: { x: 5, y: 5 } })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Przerwij' })).toBeVisible()
  release()
  await expect(dialog.getByText('Gotowe: 2, pominięte: 0, błędy: 0')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test.describe('[AC-UI-011] confirmation on top of the export dialog', () => {
  async function openExport(page: Page) {
    await mockApp(page)
    await page.goto(`/generate/${IMAGE.id}`)
    const more = page.getByRole('button', { name: 'Więcej akcji' }).first()
    await more.click()
    await page.getByRole('menuitem', { name: 'Eksport i edycja' }).click()
    const exportDialog = page.getByRole('dialog', { name: 'Eksportuj grafikę' })
    await expect(exportDialog).toBeVisible()
    return { more, exportDialog }
  }

  test('[AC-UI-011, AC-UI-012] Escape on unsaved changes asks first; Escape again closes only the confirmation', async ({ page }) => {
    const { more, exportDialog } = await openExport(page)
    // Without changes the dialog closes at once.
    await page.keyboard.press('Escape')
    await expect(exportDialog).toHaveCount(0)
    await expect(more).toBeFocused()

    await more.click()
    await page.getByRole('menuitem', { name: 'Eksport i edycja' }).click()
    await exportDialog.getByRole('button', { name: 'Obróć w prawo o 90 stopni' }).click()
    await expect(exportDialog.getByTestId('rotation-label')).toHaveText('90°')
    await exportDialog.getByRole('button', { name: 'Obróć w prawo o 90 stopni' }).focus()

    await page.keyboard.press('Escape')
    const confirm = page.getByRole('alertdialog', { name: 'Zamknąć bez pobierania?' })
    await expect(confirm).toBeVisible()
    await expect(exportDialog).toBeVisible()
    await expect(confirm.getByRole('button', { name: 'Zamknij bez pobierania' })).toBeFocused()
    // Only the confirmation is active: the export below is inert and Tab stays in the confirmation.
    expect(await exportDialog.evaluate((d) => Boolean(d.closest('[inert]')))).toBe(true)
    expect(await expectTabCycle(page, confirm)).toEqual(['Wróć do edycji', '<start>'])
    await expectBackgroundInert(confirm)
    await expectNoSeriousA11yViolations(page)

    await page.keyboard.press('Escape')
    await expect(confirm).toHaveCount(0)
    await expect(exportDialog).toBeVisible()
    await expect(exportDialog.getByRole('button', { name: 'Obróć w prawo o 90 stopni' })).toBeFocused()
    await expect(exportDialog.getByTestId('rotation-label')).toHaveText('90°')
    await expectTabCycle(page, exportDialog)
  })

  test('[AC-UI-011] „Wróć do edycji” keeps the export open; „Zamknij bez pobierania” closes both and focus returns to „Więcej akcji”', async ({ page }) => {
    const { more, exportDialog } = await openExport(page)
    await exportDialog.getByRole('button', { name: 'Obróć w lewo o 90 stopni' }).click()
    await exportDialog.getByRole('button', { name: 'Zamknij', exact: true }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Zamknąć bez pobierania?' })
    await confirm.getByRole('button', { name: 'Wróć do edycji' }).click()
    await expect(confirm).toHaveCount(0)
    await expect(exportDialog.getByTestId('rotation-label')).toHaveText('270°')
    await expect(exportDialog.getByRole('button', { name: 'Zamknij', exact: true })).toBeFocused()

    // The backdrop asks too.
    await page.getByRole('button', { name: 'Zamknij okno' }).click({ position: { x: 5, y: 5 } })
    await confirm.getByRole('button', { name: 'Zamknij bez pobierania' }).click()
    await expect(confirm).toHaveCount(0)
    await expect(exportDialog).toHaveCount(0)
    await expect(more).toBeFocused()
    expect(await page.locator('[inert]').count()).toBe(0)
  })

  test('[AC-UI-011] after downloading the edited graphic the export closes without asking', async ({ page }) => {
    test.skip(isMobile(page), 'phones and tablets save through the share sheet (download.spec.ts)')
    const { exportDialog } = await openExport(page)
    await exportDialog.getByRole('button', { name: 'Obróć w prawo o 90 stopni' }).click()
    await exportDialog.getByLabel('Cała grafika').check()
    await exportDialog.getByRole('button', { name: 'Dalej' }).click()
    const download = page.waitForEvent('download')
    await exportDialog.getByRole('button', { name: 'Pobierz', exact: true }).click()
    await download
    await page.keyboard.press('Escape')
    await expect(exportDialog).toHaveCount(0)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })
})
