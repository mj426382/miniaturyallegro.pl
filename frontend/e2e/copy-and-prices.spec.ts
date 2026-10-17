import { test, expect } from '@playwright/test'
import { mockApp } from './fixtures'

/** Spec 11: „E-mail” spelling on every form (AC-UI-013) and subscription prices taken from the API (AC-UI-016). */

for (const { path, heading } of [
  { path: '/login', heading: 'Zaloguj się' },
  { path: '/register', heading: 'Utwórz konto' },
  { path: '/forgot-password', heading: 'Reset hasła' },
]) {
  test(`[AC-UI-013] ${path} labels the address field „E-mail” and validates it with „adres e-mail”`, async ({ page }) => {
    await mockApp(page, { loggedIn: false })
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
    const field = page.getByLabel('E-mail', { exact: true })
    await expect(field).toBeVisible()
    await expect(field).toHaveAttribute('type', 'email')
    await expect(page.getByLabel('Email', { exact: true })).toHaveCount(0)
    await expect(page.locator('label').filter({ hasText: /^\s*Email\s*$/ })).toHaveCount(0)
    if (path !== '/forgot-password') {
      await field.fill('to-nie-jest-adres')
      await field.blur()
      await expect(page.getByText('Podaj prawidłowy adres e-mail')).toBeVisible()
    }
  })
}

test('[AC-UI-016] the plan cards show the prices and descriptions sent by the API', async ({ page }) => {
  await mockApp(page)
  const plans = [
    { id: 'sub_start', name: 'Start', credits: 40, priceGrosze: 1900, priceLabel: '19 zł / mies.', description: '40 grafik miesięcznie (0,48 zł / grafikę).', available: true },
    { id: 'sub_pro', name: 'Pro', credits: 150, priceGrosze: 5900, priceLabel: '59 zł / mies.', description: '150 grafik miesięcznie (0,39 zł / grafikę).', available: true },
  ]
  await page.route('**/api/payments/plans', (route) => route.fulfill({ json: plans }))
  await page.goto('/credits')
  await expect(page.getByRole('heading', { name: 'Abonament miesięczny' })).toBeVisible()
  for (const plan of plans) {
    await expect(page.getByText(plan.priceLabel, { exact: true })).toBeVisible()
    await expect(page.getByText(plan.description, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: `Wybierz plan ${plan.name}` })).toBeVisible()
  }
  await expect(page.getByText(/\b(49|149) zł \/ mies\./)).toHaveCount(0)
})
