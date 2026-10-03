import { test, expect, Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockApp } from './fixtures'

/**
 * WCAG 2.1 A/AA audit of every screen with axe-core (docs/specs/11-ui-design-system.md, NFR-A11Y).
 * Any serious or critical violation fails the build; moderate/minor ones are listed in the report.
 */
const SCREENS: Array<{ path: string; loggedIn?: boolean; ready: string }> = [
  { path: '/login', loggedIn: false, ready: 'Zaloguj się' },
  { path: '/register', loggedIn: false, ready: 'Utwórz konto' },
  { path: '/forgot-password', loggedIn: false, ready: 'Reset hasła' },
  { path: '/reset-password?token=abc', loggedIn: false, ready: 'Ustaw nowe hasło' },
  { path: '/', ready: 'Witaj' },
  { path: '/upload', ready: 'Prześlij zdjęcie produktu' },
  { path: '/bulk-upload', ready: 'Masowe przesyłanie zdjęć' },
  { path: '/gallery', ready: 'Galeria zdjęć' },
  { path: '/generate/img-1', ready: 'Generator grafik produktowych' },
  { path: '/credits', ready: 'Kredyty' },
  { path: '/account', ready: 'Ustawienia konta' },
  { path: '/allegro', ready: 'Allegro' },
  { path: '/nie-ma-takiej-strony', ready: 'Tej strony nie ma' },
]

async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const describe = (v: (typeof results.violations)[number]) =>
    `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes
      .slice(0, 3)
      .map((n) => n.html.slice(0, 120))
      .join('\n  ')}`
  return { blocking, report: results.violations.map(describe).join('\n') }
}

for (const screen of SCREENS) {
  test(`[AC-UI-001] ${screen.path} has no serious accessibility violations`, async ({ page }) => {
    await mockApp(page, { loggedIn: screen.loggedIn ?? true })
    await page.goto(screen.path)
    await expect(page.getByRole('heading', { name: new RegExp(screen.ready) }).first()).toBeVisible()
    const { blocking, report } = await audit(page)
    expect(
      blocking.map((v) => `${v.id}: ${v.help}`),
      report,
    ).toEqual([])
  })
}

test('[AC-UI-002] the export dialog and the confirmation dialog are accessible', async ({ page }) => {
  await mockApp(page)
  await page.goto('/generate/img-1')
  await page.getByRole('button', { name: 'Więcej akcji' }).first().click()
  await page.getByRole('menuitem', { name: 'Eksport i edycja' }).click()
  await expect(page.getByRole('dialog', { name: 'Eksportuj grafikę' })).toBeVisible()
  let result = await audit(page)
  expect(
    result.blocking.map((v) => `${v.id}: ${v.help}`),
    result.report,
  ).toEqual([])
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Usuń zdjęcie' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  result = await audit(page)
  expect(
    result.blocking.map((v) => `${v.id}: ${v.help}`),
    result.report,
  ).toEqual([])
})
