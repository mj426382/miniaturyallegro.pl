import { expect, test } from '@playwright/test'
import { mockApp, PASSWORD } from './fixtures'

/** Spec 20: referral programme in the browser. */

test('[AC-REF-005] a referral link announces the gift and the code survives a detour to the login page', async ({ page }) => {
  const { requests } = await mockApp(page, { loggedIn: false })
  await page.goto('/register?ref=abc23xyz')
  await expect(page.getByRole('status').filter({ hasText: 'Masz zaproszenie od znajomego' })).toContainText('3 dodatkowe grafiki')

  // The visitor looks at the login page first and comes back without the parameter.
  await page.getByRole('link', { name: 'Zaloguj się' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/register')
  await expect(page.getByText('Masz zaproszenie od znajomego')).toBeVisible()

  await page.getByLabel('Email').fill('polecony@example.com')
  await page.getByLabel('Hasło', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Potwierdź hasło').fill(PASSWORD)
  await page.locator('#acceptTerms').check()
  await page.getByRole('button', { name: 'Zarejestruj się' }).click()
  await expect.poll(() => requests.find((r) => r.url === '/auth/register')?.body?.referralCode).toBe('abc23xyz')

  // After the account exists the code is forgotten.
  expect(await page.evaluate(() => localStorage.getItem('allgrafika:ref'))).toBeNull()
})

test('[AC-REF-005] a sign-up without a referral sends no code and shows no gift note', async ({ page }) => {
  const { requests } = await mockApp(page, { loggedIn: false })
  await page.goto('/register')
  await expect(page.getByText('Masz zaproszenie od znajomego')).toHaveCount(0)
  await page.getByLabel('Email').fill('ktos@example.com')
  await page.getByLabel('Hasło', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Potwierdź hasło').fill(PASSWORD)
  await page.locator('#acceptTerms').check()
  await page.getByRole('button', { name: 'Zarejestruj się' }).click()
  await expect.poll(() => requests.find((r) => r.url === '/auth/register')?.body).toBeTruthy()
  expect(requests.find((r) => r.url === '/auth/register')!.body).not.toHaveProperty('referralCode')
})

test('[AC-REF-006] the account page shows the referral link, copies it and shows the results', async ({ page, browserName }) => {
  await mockApp(page)
  if (browserName === 'chromium') await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/account')
  const card = page.getByRole('region', { name: 'Poleć znajomym – zdobądź darmowe grafiki' })
  await expect(card.getByLabel('Twój link polecający')).toHaveValue('http://localhost:4173/register?ref=abc23xyz')
  await expect(card).toContainText('Polecone konta')
  await expect(card.getByText('2', { exact: true })).toBeVisible()
  await expect(card.getByText('3', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'Kopiuj link' }).click()
  await expect(page.getByText(/Link skopiowany|skopiuj ręcznie/)).toBeVisible()
  if (browserName === 'chromium') expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('http://localhost:4173/register?ref=abc23xyz')
})

test('[AC-REF-006] the paywall points to the referral programme', async ({ page }) => {
  await mockApp(page, { noCredits: true })
  await page.goto('/generate/img-1')
  await page.getByRole('button', { name: 'Pokaż style' }).click()
  await page.getByRole('button', { name: /^Generuj \d+ grafik/ }).click()
  await page.getByRole('dialog').getByRole('link', { name: 'Poleć AllGrafika znajomemu' }).click()
  await expect(page).toHaveURL(/\/account#polecenia$/)
  await expect(page.getByRole('region', { name: 'Poleć znajomym – zdobądź darmowe grafiki' })).toBeVisible()
})
