import { expect, test } from '@playwright/test'
import { me, register, uniqueEmail, uploadProduct, verificationLink } from './helpers'

/**
 * Spec 17: the whole product path in a real browser against the real backend and database
 * (backend/test/e2e-server.ts). Only the AI provider and the mailbox are fakes.
 * Run: npm run test:e2e:fullstack (needs the local test Postgres, see infra/docker-compose.test.yml).
 */

test('[AC-E2E-001] sign up, confirm the e-mail, upload a photo and generate graphics', async ({ page }) => {
  const email = uniqueEmail('sprzedawca')
  await register(page, email)
  await expect(page.getByText('Potwierdź adres e-mail')).toBeVisible()

  await page.goto(await verificationLink(page.request, email))
  await expect(page.getByText(/Adres potwierdzony/)).toBeVisible()
  const before = await me(page)
  expect(before.emailVerified).toBe(true)
  expect(before.freeCreditsUsed).toBe(0)

  await uploadProduct(page)
  const start = page.getByRole('button', { name: /^Generuj \d+ grafik/ })
  await expect(start).toBeEnabled()
  const count = Number((await start.textContent())!.match(/\d+/)![0])
  expect(count).toBeGreaterThan(0)
  await start.click()
  // Real polling of the real API until every graphic is done (the fake AI answers immediately).
  await expect(page.getByText('Gotowe', { exact: true })).toHaveCount(count, { timeout: 20_000 })

  const after = await me(page)
  expect(after.freeCreditsUsed - before.freeCreditsUsed).toBe(count)
  expect(after.totalGenerations).toBe(count)

  await page.goto('/gallery')
  await expect(page.getByText('1 przesłane zdjęcie', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Stan produktu').first()).toContainText(`${count} grafik`)
  await expect(page.getByRole('link', { name: 'Zobacz warianty' })).toBeVisible()
})

test('[AC-E2E-003] an unconfirmed account cannot generate until the e-mail link is clicked', async ({ page }) => {
  const email = uniqueEmail('niepotwierdzony')
  await register(page, email)
  await uploadProduct(page)

  const start = page.getByRole('button', { name: /^Generuj \d+ grafik/ })
  await start.click()
  await expect(page.getByText(/Potwierdź adres e-mail, aby generować grafiki/).first()).toBeVisible()
  const blocked = await me(page)
  expect(blocked.emailVerified).toBe(false)
  expect(blocked.freeCreditsUsed).toBe(0)
  expect(blocked.totalGenerations).toBe(0)

  const generatorUrl = page.url()
  await page.goto(await verificationLink(page.request, email))
  await expect(page.getByText(/Adres potwierdzony/)).toBeVisible()

  await page.goto(generatorUrl)
  await page.getByRole('button', { name: /^Generuj \d+ grafik/ }).click()
  await expect(page.getByText('Gotowe', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
  expect((await me(page)).totalGenerations).toBeGreaterThan(0)
})
