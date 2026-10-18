import { expect, test } from '@playwright/test'
import { mockApp } from './fixtures'

/** Browser coverage for discount codes – spec 09 (credits page hint) and spec 16 (admin panel). */

const HINT = 'Masz kod rabatowy? Wpiszesz go na stronie płatności Stripe.'

test.describe('credits page (spec 09)', () => {
  test('[AC-PAY-031] the hint about discount codes sits under the packages, not on the welcome pack', async ({ page }) => {
    await mockApp(page)
    await page.goto('/credits')
    const welcome = page.getByTestId('welcome-offer')
    await expect(welcome).toBeVisible()
    const hint = page.getByTestId('discount-code-hint')
    await expect(hint).toHaveText(HINT)
    await expect(page.getByText(HINT)).toHaveCount(1)
    await expect(welcome).not.toContainText('kod rabatowy')

    // below the last package button
    const buy = await page.getByRole('button', { name: /^Kup 5 kredytów/ }).boundingBox()
    const hintBox = await hint.boundingBox()
    expect(buy && hintBox && hintBox.y > buy.y).toBe(true)
  })

  test('[AC-PAY-031] after the first purchase the hint stays with the regular packages', async ({ page }) => {
    await mockApp(page, { hasPurchased: true })
    await page.goto('/credits')
    await expect(page.getByTestId('welcome-offer')).toHaveCount(0)
    await expect(page.getByTestId('discount-code-hint')).toHaveText(HINT)
  })
})

test.describe('admin discount codes (spec 16)', () => {
  test('[AC-ADM-020] the admin sees the codes, gets Polish errors before sending, creates and deactivates a code', async ({ page }) => {
    const { requests } = await mockApp(page, { isAdmin: true })
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Kody rabatowe' }).click()

    const list = page.getByRole('list', { name: 'Kody rabatowe' })
    const first = list.getByTestId('discount-code-row').first()
    await expect(first).toContainText('KATALOG-10')
    await expect(first).toContainText('−10%')
    await expect(first).toContainText('aktywny')
    await expect(first).toContainText('Użycia: 3 / 50')
    await expect(first).toContainText('Zamówienia: 2')
    await expect(first).toContainText('Katalog firm – czytelnicy')

    // everything wrong at once – nothing is sent
    await page.getByLabel('Kod', { exact: true }).fill('zniżka')
    await page.getByLabel('Rabat (%)').fill('150')
    await page.getByLabel('Limit użyć (opcjonalnie)').fill('0')
    await page.getByLabel('Ważny do (opcjonalnie)').fill('2020-01-01')
    await page.getByRole('button', { name: 'Utwórz kod' }).click()
    await expect(page.getByText('Kod może mieć 3–30 znaków: litery A–Z (bez polskich znaków), cyfry i myślnik')).toBeVisible()
    await expect(page.getByText('Rabat procentowy musi być liczbą całkowitą od 1 do 100')).toBeVisible()
    await expect(page.getByText('Limit użyć musi wynosić co najmniej 1')).toBeVisible()
    await expect(page.getByText('Data ważności musi być w przyszłości')).toBeVisible()
    await expect(page.getByLabel('Kod', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    expect(requests.filter((r) => r.url === '/admin/discount-codes' && r.method === 'POST')).toHaveLength(0)

    // a fixed amount with a comma
    await page.getByLabel('Kod', { exact: true }).fill('partner-5zl')
    await expect(page.getByLabel('Kod', { exact: true })).toHaveValue('PARTNER-5ZL')
    await page.getByLabel('Rodzaj rabatu').selectOption('amount')
    await page.getByLabel('Rabat (zł)').fill('0')
    await page.getByLabel('Limit użyć (opcjonalnie)').fill('')
    await page.getByLabel('Ważny do (opcjonalnie)').fill('2099-12-31')
    await page.getByRole('button', { name: 'Utwórz kod' }).click()
    await expect(page.getByText('Kwota rabatu musi być większa od 0 zł')).toBeVisible()
    await page.getByLabel('Rabat (zł)').fill('5,50')
    await page.getByLabel('Notatka (opcjonalnie, np. partner)').fill('Blog partnera')
    await page.getByRole('button', { name: 'Utwórz kod' }).click()
    await expect(page.getByText('Utworzono kod PARTNER-5ZL')).toBeVisible()

    const sent = requests.find((r) => r.url === '/admin/discount-codes' && r.method === 'POST')?.body
    expect(sent).toMatchObject({ code: 'PARTNER-5ZL', type: 'amount', amountOffPln: 5.5, note: 'Blog partnera' })
    expect(sent).not.toHaveProperty('maxRedemptions')
    expect(new Date(sent.expiresAt).getFullYear()).toBe(2099)

    const created = list.getByTestId('discount-code-row').first()
    await expect(created).toContainText('PARTNER-5ZL')
    await expect(created).toContainText('−5,50 zł')
    await expect(created).toContainText('Użycia: 0 / bez limitu')
    await expect(page.getByLabel('Kod', { exact: true })).toHaveValue('')

    // a duplicate is refused by the API and explained next to the form
    await page.getByLabel('Kod', { exact: true }).fill('KATALOG-10')
    await page.getByLabel('Rabat (%)').fill('20')
    await page.getByRole('button', { name: 'Utwórz kod' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Taki kod już istnieje – wybierz inny' })).toBeVisible()

    // deactivate after a confirmation
    await page.getByRole('button', { name: 'Wyłącz kod KATALOG-10' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Wyłącz kod' }).click()
    await expect(page.getByText('Kod KATALOG-10 wyłączony')).toBeVisible()
    const katalog = list.getByTestId('discount-code-row').filter({ hasText: 'KATALOG-10' })
    await expect(katalog).toContainText('wyłączony')
    await expect(page.getByRole('button', { name: 'Wyłącz kod KATALOG-10' })).toHaveCount(0)
    expect(requests.some((r) => r.url === '/admin/discount-codes/dc-1/deactivate')).toBe(true)
  })

  test('[AC-ADM-019] the account details show the code and the discount of a payment', async ({ page }) => {
    await mockApp(page, { isAdmin: true })
    await page.goto('/admin')
    await page.getByRole('button', { name: /sklep\.kubki@example\.com/ }).click()
    const dialog = page.getByRole('dialog', { name: 'sklep.kubki@example.com' })
    await expect(dialog.getByText(/25,20 zł · \+15 kr\. · pakiet/)).toBeVisible()
    await expect(dialog.getByTestId('payment-discount')).toHaveCount(1)
    await expect(dialog.getByTestId('payment-discount')).toHaveText('kod PARTNER-10 · rabat 2,80 zł')
  })
})
