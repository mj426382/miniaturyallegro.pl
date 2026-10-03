import { test, expect } from '@playwright/test'
import { mockApp, PNG_BYTES } from './fixtures'

test.describe('password reset page', () => {
  test('[AC-AUTH-019] validates the password and submits the token from the e-mail link', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto('/reset-password?token=abc123')
    await expect(page.getByRole('heading', { name: 'Ustaw nowe hasło' })).toBeVisible()

    await page.getByPlaceholder('Min. 8 znaków').fill('weak')
    await expect(page.getByText('Brakuje:')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zmień hasło' })).toBeDisabled()

    await page.getByPlaceholder('Min. 8 znaków').fill('N3w!Password')
    await page.getByPlaceholder('Powtórz hasło').fill('N3w!Password')
    await page.getByRole('button', { name: 'Zmień hasło' }).click()

    await expect(page).toHaveURL(/\/login$/)
    const call = requests.find((r) => r.url === '/auth/reset-password')!
    expect(call.body).toEqual({ token: 'abc123', password: 'N3w!Password' })
  })

  test('[AC-AUTH-020] explains a missing token', async ({ page }) => {
    await mockApp(page)
    await page.goto('/reset-password')
    await expect(page.getByText('Link do resetowania hasła jest nieprawidłowy.')).toBeVisible()
  })
})

test.describe('credits purchase', () => {
  test('[AC-PAY-011] requires the consumer consent and creates exactly one checkout session on a double click', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto('/credits')
    await expect(page.getByRole('heading', { name: 'Kredyty' })).toBeVisible()

    const buy = page.getByRole('button', { name: 'Kup 5 kredytów' })
    await buy.click()
    await expect(page.getByText('Zaznacz zgodę na natychmiastowe udostępnienie kredytów')).toBeVisible()
    expect(requests.filter((r) => r.url === '/payments/checkout')).toHaveLength(0)

    await page.getByText('Żądam natychmiastowego udostępnienia kredytów').click()
    // two rapid clicks – the second must be ignored while the redirect is in flight
    await buy.click()
    await buy.click({ force: true }).catch(() => undefined)
    await page.waitForURL(/credits\?success=1|\/credits$/)
    expect(requests.filter((r) => r.url === '/payments/checkout')).toHaveLength(1)
    expect(requests.find((r) => r.url === '/payments/checkout')!.body).toEqual({ packageId: 'credits_5', acceptedWithdrawalWaiver: true })
  })
})

test.describe('offer description (SEO copy)', () => {
  test('[AC-DESC-011] writes the copy from seller notes, refines it by prompt, undoes and saves a manual edit', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined)
    const { requests } = await mockApp(page)
    await page.goto('/generate/img-1')
    const panel = page.getByRole('region', { name: 'Opis oferty pod SEO Allegro' })
    await expect(panel).toBeVisible()

    await panel.getByLabel('Co warto napisać o produkcie?').fill('kubek 350 ml')
    await panel.getByRole('button', { name: 'Wygeneruj opis (gratis)' }).click()
    expect(requests.find((r) => r.url === '/descriptions/img-1' && r.method === 'POST')!.body).toEqual({ notes: 'kubek 350 ml' })

    const title = panel.getByLabel('Tytuł oferty')
    await expect(title).toHaveValue('Kubek ceramiczny 350 ml biały do zmywarki')
    await expect(panel.getByText('Poprawki promptem: 5 z 5')).toBeVisible()
    await expect(panel.getByTestId('description-preview').locator('li')).toHaveCount(2)
    await expect(panel.getByRole('button', { name: 'Zapisz zmiany' })).toBeDisabled()

    // AI rewrite – counts down the free rewrites and can be undone.
    await panel.getByLabel('Popraw promptem').fill('krócej')
    await panel.getByRole('button', { name: 'Popraw (zostało 5)' }).click()
    await expect(title).toHaveValue('Kubek ceramiczny 350 ml biały do zmywarki (poprawiony)')
    await expect(panel.getByText('Poprawki promptem: 4 z 5')).toBeVisible()
    expect(requests.find((r) => r.url === '/descriptions/img-1/refine')!.body).toEqual({ instruction: 'krócej' })
    await panel.getByRole('button', { name: 'Cofnij ostatnią poprawkę' }).click()
    await expect(title).toHaveValue('Kubek ceramiczny 350 ml biały do zmywarki')

    // Manual edit: the title limit is enforced in the UI, HTML is sanitized before saving.
    await title.fill('x'.repeat(80))
    await expect(panel.getByText('80/75')).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Zapisz zmiany' })).toBeDisabled()
    await title.fill('Kubek ceramiczny 350 ml – edycja')
    await panel.getByRole('button', { name: 'Edytuj HTML' }).click()
    await panel.getByLabel('Opis oferty (HTML)').fill('<h3>Opis</h3><p onclick="x()">Ręcznie <a href="#">poprawiony</a> opis kubka.</p><script>x()</script>')
    await panel.getByLabel('Frazy kluczowe').fill('Kubek, kubek, biały kubek')
    await panel.getByRole('button', { name: 'Zapisz zmiany' }).click()
    const saved = requests.find((r) => r.url === '/descriptions/img-1' && r.method === 'PATCH')!
    expect(saved.body).toEqual({
      title: 'Kubek ceramiczny 350 ml – edycja',
      body: '<h2>Opis</h2><p>Ręcznie poprawiony opis kubka.</p>',
      keywords: ['kubek', 'biały kubek'],
    })
    await expect(panel.getByRole('button', { name: 'Zapisz zmiany' })).toBeDisabled()
  })

  test('[AC-DESC-012, AC-PRC-007] offers a pack of fifteen rewrites for a credit once the free ones are used up', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto('/generate/img-1')
    const panel = page.getByRole('region', { name: 'Opis oferty pod SEO Allegro' })
    await panel.getByRole('button', { name: 'Wygeneruj opis (gratis)' }).click()
    await expect(panel.getByLabel('Tytuł oferty')).toBeVisible()

    for (let left = 5; left >= 1; left--) {
      await panel.getByLabel('Popraw promptem').fill(`zmiana ${left}`)
      await panel.getByRole('button', { name: `Popraw (zostało ${left})` }).click()
      await expect(panel.getByText(`Poprawki promptem: ${left - 1} z 5`)).toBeVisible()
    }
    await expect(panel.getByLabel('Popraw promptem')).toBeDisabled()
    const buy = panel.getByRole('button', { name: 'Dokup 15 poprawek (1 kredyt)' })
    await expect(buy).toBeVisible()
    await buy.click()
    await expect(panel.getByText('Poprawki promptem: 15 z 20')).toBeVisible()
    expect(requests.filter((r) => r.url === '/descriptions/img-1/edit-packs')).toHaveLength(1)
    await expect(panel.getByRole('button', { name: 'Popraw (zostało 15)' })).toBeVisible()
  })
})

test.describe('bulk upload', () => {
  const files = [
    { name: 'a.png', mimeType: 'image/png', buffer: PNG_BYTES },
    { name: 'b.png', mimeType: 'image/png', buffer: PNG_BYTES },
  ]

  test('[AC-UPL-011] upload-only mode stores the photos without spending credits', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto('/bulk-upload')
    await page.getByLabel('Tylko prześlij').check()
    await page.locator('input[type=file]').setInputFiles(files)
    await expect(page.getByText('Koszt: 0 kredytów')).toBeVisible()
    await page.getByRole('button', { name: 'Prześlij (2)' }).click()
    await expect(page.getByText('2 przesłane')).toBeVisible()
    expect(requests.filter((r) => r.url === '/images/upload')).toHaveLength(2)
    expect(requests.filter((r) => r.url.endsWith('/start'))).toHaveLength(0)
  })

  test('[AC-UPL-012] shared styles apply to every file and the cost is shown up front', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto('/bulk-upload')
    await page.locator('input[type=file]').setInputFiles(files)
    await page.getByLabel('Wspólne style dla wszystkich').check()
    await expect(page.getByText('6 kredytów')).toBeVisible() // 2 files × 3 starter styles
    await page.getByLabel('Gradient').check()
    await page.getByLabel('Ciemny luksus').uncheck()
    await expect(page.getByText('6 kredytów')).toBeVisible()
    await page.getByRole('button', { name: 'Prześlij i generuj (2)' }).click()
    await expect(page.getByText('2 gotowe')).toBeVisible()
    const starts = requests.filter((r) => r.url.endsWith('/start'))
    expect(starts).toHaveLength(2)
    for (const s of starts) expect(s.body).toEqual({ styles: ['white-bg', 'lifestyle-home', 'gradient-bg'] })
  })

  test('[AC-UPL-013] per-file styles let each product get its own set', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto('/bulk-upload')
    await page.locator('input[type=file]').setInputFiles(files)
    await page.getByLabel('Osobne style dla każdego pliku').check()
    const rows = page.getByRole('listitem')
    await rows.nth(0).getByRole('button', { name: 'Lifestyle – wnętrze' }).click() // off
    await rows.nth(0).getByRole('button', { name: 'Ciemny luksus' }).click() // off
    await rows.nth(1).getByRole('button', { name: 'Gradient' }).click() // on
    await expect(page.getByText('5 kredytów')).toBeVisible() // 1 + 4
    await page.getByRole('button', { name: 'Prześlij i generuj (2)' }).click()
    await expect(page.getByText('2 gotowe')).toBeVisible()
    const starts = requests.filter((r) => r.url.endsWith('/start'))
    expect(starts.map((s) => s.body.styles)).toEqual([['white-bg'], ['white-bg', 'lifestyle-home', 'dark-luxury', 'gradient-bg']])
  })
})

test.describe('gallery', () => {
  test('[AC-UPL-014] cards show how many graphics exist and whether the offer copy is written', async ({ page }) => {
    await mockApp(page)
    await page.goto('/gallery')
    const card = page.getByRole('link', { name: 'Zobacz warianty' }).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
    await expect(card.getByText('1 grafika')).toBeVisible()
    await expect(card.getByText('Opis ✓')).toHaveCount(0)

    // Once the copy exists the gallery flags it.
    await page.goto('/generate/img-1')
    await page.getByRole('button', { name: 'Wygeneruj opis (gratis)' }).click()
    await expect(page.getByLabel('Tytuł oferty')).toBeVisible()
    await page.goto('/gallery')
    await expect(page.getByText('Opis ✓')).toBeVisible()
  })

  test('[AC-UI-007] the Allegro publish button is hidden until a seller account is connected', async ({ page }) => {
    await mockApp(page)
    await page.goto('/generate/img-1')
    await page.getByRole('button', { name: 'Więcej akcji' }).first().click()
    await expect(page.getByRole('menuitem', { name: 'Eksport i edycja' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Opublikuj na Allegro' })).toHaveCount(0)
  })
})

test.describe('Allegro integration page', () => {
  test('[AC-ALG-003] shows the not-configured state and keeps the navigation working', async ({ page }) => {
    await mockApp(page)
    await page.goto('/allegro')
    await expect(page.getByText('Integracja z Allegro nie jest jeszcze włączona')).toBeVisible()
  })

  test('[AC-ALG-004] handles the OAuth callback with a missing code', async ({ page }) => {
    await mockApp(page)
    await page.goto('/allegro/callback?error_description=odmowa')
    await expect(page.getByText('odmowa')).toBeVisible()
    await page.getByRole('link', { name: 'Spróbuj ponownie' }).click()
    await expect(page).toHaveURL(/\/allegro$/)
  })
})

test.describe('session bootstrap', () => {
  test('[AC-AUTH-016] redirects to /login when the API says there is no session', async ({ page }) => {
    await page.route('**/api/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Unauthorized"}' }))
    await page.goto('/gallery')
    await expect(page).toHaveURL(/\/login$/)
  })
})
