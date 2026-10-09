import { expect, test } from '@playwright/test'
import { IMAGE, mockApp, PASSWORD, PNG_BYTES } from './fixtures'

/** Browser coverage for spec 16 – consent, notification settings, unsubscribe, batch watch, admin panel. */

test.describe('e-mail notifications (spec 16)', () => {
  test('[AC-NOT-007] the marketing consent at sign-up is optional, unticked and sent when ticked', async ({ page }) => {
    const { requests } = await mockApp(page, { loggedIn: false })
    await page.goto('/register')
    const consent = page.getByLabel(/Chcę dostawać e-mailem zniżki na kredyty/)
    await expect(consent).not.toBeChecked()

    await page.getByLabel('Email').fill('nowy@example.com')
    await page.getByLabel('Hasło', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Potwierdź hasło').fill(PASSWORD)
    await page.locator('#acceptTerms').check()
    await consent.check()
    await page.getByRole('button', { name: 'Zarejestruj się' }).click()
    await expect.poll(() => requests.find((r) => r.url === '/auth/register')?.body?.marketingConsent).toBe(true)
  })

  test('[AC-NOT-007] account settings switch both notifications and save immediately', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto('/account')
    const tips = page.getByLabel(/Wskazówki, przypomnienia i zniżki/)
    const batch = page.getByLabel(/Koniec dużej paczki/)
    await expect(tips).not.toBeChecked()
    await expect(batch).toBeChecked()

    await tips.check()
    await expect(page.getByText('Zapisano ustawienia powiadomień')).toBeVisible()
    await expect(tips).toBeChecked()
    await batch.uncheck()
    await expect(batch).not.toBeChecked()
    const patches = requests.filter((r) => r.url === '/users/me' && r.method === 'PATCH').map((r) => r.body)
    expect(patches).toEqual([{ marketingConsent: true }, { notifyBatchDone: false }])
  })

  test('[AC-NOT-007] the unsubscribe link works without a session and explains a bad link', async ({ page }) => {
    const { requests } = await mockApp(page, { loggedIn: false })
    await page.goto('/unsubscribe?token=unsub-token')
    await expect(page.getByText('nie będziesz już dostawać wskazówek ani przypomnień')).toBeVisible()
    expect(requests.some((r) => r.url === '/notifications/unsubscribe?token=unsub-token')).toBe(true)

    await page.goto('/unsubscribe?token=zly')
    await expect(page.getByRole('alert')).toContainText('Link wypisania jest nieprawidłowy')
  })

  test('[AC-NOT-008] a bulk batch of three photos with graphics asks for the e-mail; upload-only does not', async ({ page }) => {
    const { requests } = await mockApp(page)
    const files = ['a.png', 'b.png', 'c.png'].map((name) => ({ name, mimeType: 'image/png', buffer: PNG_BYTES }))
    await page.goto('/bulk-upload')
    await page.locator('input[type=file]').setInputFiles(files)
    await page.getByLabel('Wspólne style dla wszystkich').check()
    await page.getByRole('button', { name: 'Prześlij i generuj (3)' }).click()
    await expect(page.getByText('Wyślemy Ci maila, gdy wszystkie grafiki będą gotowe.')).toBeVisible()
    expect(requests.find((r) => r.url === '/notifications/batches')?.body).toEqual({ imageIds: ['img-new-1', 'img-new-2', 'img-new-3'] })

    await page.getByRole('button', { name: 'Wyczyść wszystko' }).click()
    await page.getByLabel('Tylko prześlij').check()
    await page.locator('input[type=file]').setInputFiles(files)
    await page.getByRole('button', { name: 'Prześlij (3)' }).click()
    await expect(page.getByText('3 przesłane')).toBeVisible()
    expect(requests.filter((r) => r.url === '/notifications/batches')).toHaveLength(1)
  })
})

test.describe('admin panel (spec 16)', () => {
  test('[AC-ADM-006] the admin sees accounts, searches, opens one and sends a message', async ({ page }) => {
    const { requests } = await mockApp(page, { isAdmin: true })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // phones: the navigation lives in the slide-in menu
    const menu = page.getByRole('button', { name: 'Otwórz menu' })
    if (await menu.isVisible()) await menu.click()
    await page.locator('a[href="/admin"]:visible').first().click()
    await expect(page.getByRole('heading', { name: 'Panel administratora' })).toBeVisible()
    await expect(page.getByText('Konta', { exact: true })).toBeVisible()
    // Cards below the lg breakpoint, a table above – role queries only see the visible variant.
    await expect(page.getByRole('button', { name: /sklep\.kubki@example\.com/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /nowy@example\.com/ })).toBeVisible()

    await page.getByLabel('Szukaj użytkownika').fill('kubki')
    await expect(page.getByRole('button', { name: /nowy@example\.com/ })).toHaveCount(0)
    expect(requests.some((r) => r.url.startsWith('/admin/users?') && r.url.includes('search=kubki'))).toBe(true)

    await page.getByRole('button', { name: /sklep\.kubki@example\.com/ }).click()
    const dialog = page.getByRole('dialog', { name: 'sklep.kubki@example.com' })
    await expect(dialog.getByText('Start (active)')).toBeVisible()
    await expect(dialog.getByText('Jeszcze nic nie wysłaliśmy.')).toBeVisible()

    const send = dialog.getByRole('button', { name: 'Wyślij wiadomość' })
    await dialog.getByLabel('Temat').fill('Pytanie o grafiki')
    await dialog.getByLabel('Treść').fill('krótko')
    await expect(send).toBeDisabled()
    await dialog.getByLabel('Treść').fill('Dzień dobry, czy możemy pomóc z grafikami?')
    await send.click()
    await expect(page.getByText('Wiadomość wysłana')).toBeVisible()
    await expect(dialog.getByRole('list', { name: 'Historia maili' })).toContainText('Pytanie o grafiki')
    expect(requests.find((r) => r.url === '/admin/users/u-shop/email')?.body).toEqual({ subject: 'Pytanie o grafiki', message: 'Dzień dobry, czy możemy pomóc z grafikami?' })
  })

  test('[AC-ADM-006] a regular user has no admin entry and is sent away from /admin', async ({ page }) => {
    await mockApp(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/$/)
  })

  test('[AC-ADM-009] the admin browses the photos of a user and the latest graphics with a rating filter', async ({ page }) => {
    const { requests } = await mockApp(page, { isAdmin: true })
    await page.goto('/admin')
    await page.getByRole('button', { name: /sklep\.kubki@example\.com/ }).click()
    const dialog = page.getByRole('dialog', { name: 'sklep.kubki@example.com' })
    await dialog.getByRole('tab', { name: /Zdjęcia/ }).click()
    await expect(dialog.getByText('opis: Kubek ceramiczny 350 ml')).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Pełny rozmiar: Białe tło' })).toHaveAttribute('href', '/api/uploads/generated/a1.png')
    await expect(dialog.getByText('Błędy / artefakty na grafice')).toBeVisible()
    await expect(dialog.getByText(/nieudana/)).toBeVisible()
    expect(requests.some((r) => r.url === '/admin/users/u-shop/images')).toBe(true)
    await dialog.getByRole('button', { name: 'Zamknij', exact: true }).click()

    await page.getByRole('tab', { name: 'Grafiki' }).click()
    await expect(page.getByText('nowy@example.com')).toBeVisible()
    await page.getByLabel('Pokaż').selectOption('down')
    await expect(page.getByRole('button', { name: /nowy@example\.com/ })).toHaveCount(0)
    await expect(page.getByText('Inny powód – „zły kolor”')).toBeVisible()
    expect(requests.some((r) => r.url.startsWith('/admin/generations?') && r.url.includes('rating=down'))).toBe(true)

    await page.getByRole('button', { name: 'sklep.kubki@example.com' }).click()
    await expect(page.getByRole('dialog', { name: 'sklep.kubki@example.com' })).toBeVisible()
  })
})

test.describe('admin without a credit limit (spec 16)', () => {
  test('[AC-ADM-012] the admin sees "bez limitu" and can generate with an empty balance', async ({ page }) => {
    await mockApp(page, { isAdmin: true, noCredits: true })
    await page.goto(`/generate/${IMAGE.id}`)
    await expect(page.getByRole('heading', { name: 'Generator grafik produktowych' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Kredyty: bez limitu' }).first()).toBeAttached()
    // The photo already has graphics, so the style picker starts collapsed.
    await page.getByRole('button', { name: 'Pokaż style' }).click()
    await expect(page.getByText('Konto administratora – bez limitu kredytów')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Generuj \d+ grafik/ })).toBeEnabled()
    await expect(page.getByText(/\(masz 0\)/)).toHaveCount(0)

    await page.goto('/credits')
    await expect(page.getByRole('status').filter({ hasText: 'Konto administratora' })).toBeVisible()
  })

  test('[AC-ADM-012] a regular account with an empty balance sees the shortfall and no admin notice', async ({ page }) => {
    await mockApp(page, { noCredits: true })
    await page.goto(`/generate/${IMAGE.id}`)
    await expect(page.getByRole('heading', { name: 'Generator grafik produktowych' })).toBeVisible()
    await page.getByRole('button', { name: 'Pokaż style' }).click()
    // The cost hint warns about the empty balance (the API answers 402 if they try anyway).
    await expect(page.getByText(/\(masz 0\)/)).toBeVisible()
    await expect(page.getByText(/bez limitu/i)).toHaveCount(0)
  })
})
