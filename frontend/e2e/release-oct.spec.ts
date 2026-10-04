import { expect, test } from '@playwright/test'
import { DESCRIPTION, IMAGE, mockApp, PNG_BYTES } from './fixtures'

/** Browser coverage for specs 05 (style groups), 08, 09, 13, 14 and 15 (October 2026 release). */

const SECOND_IMAGE = {
  ...IMAGE,
  id: 'img-2',
  originalUrl: '/api/uploads/originals/img-2.jpg',
  createdAt: '2026-10-02T10:00:00.000Z',
  generations: [{ id: 'gen-21', style: 'gradient-bg', status: 'COMPLETED', url: '/api/uploads/generated/gen-21.png', rating: null, createdAt: '2026-10-02T10:00:00.000Z' }],
}

test.describe('e-mail verification (spec 13)', () => {
  test('[AC-VER-012] an unconfirmed user sees the banner and can resend the link; a confirmed one does not', async ({ page }) => {
    const { requests } = await mockApp(page, { emailVerified: false })
    await page.goto('/')
    const banner = page.getByRole('status').filter({ hasText: 'Potwierdź adres e-mail' })
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('test@allgrafika.pl')
    await page.getByRole('button', { name: 'Wyślij link ponownie' }).click()
    await expect(page.getByText('Wysłaliśmy nowy link')).toBeVisible()
    expect(requests.filter((r) => r.url === '/auth/resend-verification')).toHaveLength(1)

    await page.goto('/gallery')
    await expect(page.getByRole('button', { name: 'Wyślij link ponownie' })).toBeVisible()
  })

  test('[AC-VER-012] no banner for a confirmed account', async ({ page }) => {
    await mockApp(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Wyślij link ponownie' })).toHaveCount(0)
  })

  test('[AC-VER-013] the link page confirms the address without a session and explains a bad link', async ({ page }) => {
    const { requests } = await mockApp(page, { loggedIn: false })
    await page.goto('/verify-email?token=good-token')
    await expect(page.getByText('Adres potwierdzony')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zaloguj się' })).toBeVisible()
    expect(requests.find((r) => r.url === '/auth/verify-email')?.body).toEqual({ token: 'good-token' })

    await page.goto('/verify-email?token=stary')
    await expect(page.getByRole('alert')).toContainText('nieprawidłowy lub wygasł')
    await expect(page.getByText('Nowy link wyślesz z banera')).toBeVisible()
  })

  test('[AC-VER-013] a logged-in user goes straight back to the app and the banner is gone', async ({ page }) => {
    await mockApp(page, { emailVerified: false })
    await page.goto('/verify-email?token=good-token')
    await expect(page.getByText('Adres potwierdzony')).toBeVisible()
    await page.getByRole('link', { name: 'Przejdź do aplikacji' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('button', { name: 'Wyślij link ponownie' })).toHaveCount(0)
  })
})

test.describe('style groups (spec 05)', () => {
  test('[AC-GEN-024] the generator groups styles, promotes the in-season one and charges for it', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto(`/generate/${IMAGE.id}`)
    await page.getByRole('button', { name: 'Pokaż style' }).click()

    await expect(page.getByText('Uniwersalne', { exact: true })).toBeVisible()
    const seasonal = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Sezonowe' }) })
    await expect(seasonal).toHaveAttribute('open', '')
    await expect(seasonal.getByText('Na zdjęcia dodatkowe i kampanie')).toBeVisible()
    const seasonalNames = await seasonal.locator('label').allTextContents()
    expect(seasonalNames[0]).toContain('Boże Narodzenie')
    expect(seasonalNames[0]).toContain('Teraz')

    const industry = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Branżowe' }) })
    await expect(industry).not.toHaveAttribute('open', '')
    await industry.locator('summary').click()
    await industry.getByLabel(/Moda i odzież/).check()
    await seasonal.getByLabel(/Boże Narodzenie/).check()
    await page.getByRole('button', { name: /^Generuj \d+ grafik/ }).click()

    const start = requests.find((r) => r.url === `/generation/${IMAGE.id}/start`)
    expect(start?.body.styles).toEqual(expect.arrayContaining(['christmas', 'fashion']))
  })

  test('[AC-GEN-024] bulk upload shows the same groups', async ({ page }) => {
    await mockApp(page)
    await page.goto('/bulk-upload')
    await page.getByLabel('Wspólne style dla wszystkich').check()
    await expect(page.locator('summary').filter({ hasText: 'Sezonowe' })).toBeVisible()
    await expect(page.locator('summary').filter({ hasText: 'Branżowe' })).toBeVisible()
    await expect(page.getByLabel(/Boże Narodzenie/)).toBeVisible() // in season → group open
  })
})

test.describe('infographics (spec 14)', () => {
  test('[AC-INF-008] prefills features from the offer copy, previews and downloads; dimensions too', async ({ page }) => {
    const { requests } = await mockApp(page, { withDescription: true })
    await page.goto(`/generate/${IMAGE.id}`)
    await page.getByRole('button', { name: 'Więcej akcji' }).first().click()
    await page.getByRole('menuitem', { name: 'Infografika' }).click()

    const dialog = page.getByRole('dialog', { name: 'Infografika – zdjęcie dodatkowe' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Cecha 1')).toHaveValue('pojemność 350 ml')
    await expect(dialog.getByLabel('Cecha 2')).toHaveValue('można myć w zmywarce')
    await dialog.getByLabel('Ikona cechy 1').selectOption('shield')
    await dialog.getByLabel(/Tytuł/).fill('Kubek 350 ml')
    await dialog.getByRole('button', { name: 'Podgląd' }).click()
    await expect(dialog.getByAltText('Podgląd infografiki')).toBeVisible()

    let renders = requests.filter((r) => r.url === '/generation/infographic/gen-1')
    expect(renders).toHaveLength(1)
    expect(renders[0].body).toMatchObject({
      template: 'features',
      title: 'Kubek 350 ml',
      features: [
        { icon: 'shield', text: 'pojemność 350 ml' },
        { icon: 'check', text: 'można myć w zmywarce' },
      ],
    })

    // unchanged options → the preview is reused for the download
    await dialog.getByRole('button', { name: 'Pobierz PNG' }).click()
    renders = requests.filter((r) => r.url === '/generation/infographic/gen-1')
    expect(renders).toHaveLength(1)

    await dialog.getByLabel('Wymiary').check()
    await dialog.getByRole('button', { name: 'Podgląd' }).click()
    await expect(dialog.getByRole('alert')).toContainText('szerokość albo wysokość')
    await dialog.getByLabel('Szerokość').fill('12,5')
    await dialog.getByLabel('Wysokość').fill('20')
    await dialog.getByRole('button', { name: 'Podgląd' }).click()
    await expect.poll(() => requests.filter((r) => r.url === '/generation/infographic/gen-1').length).toBe(2)
    expect(requests.filter((r) => r.url === '/generation/infographic/gen-1')[1].body).toMatchObject({
      template: 'dimensions',
      dimensions: { width: 12.5, height: 20, unit: 'cm' },
    })
  })
})

test.describe('batch actions (spec 15)', () => {
  test('[AC-BAT-005] selecting photos in the gallery downloads a ZIP and writes descriptions with progress', async ({ page }) => {
    const { requests } = await mockApp(page, { extraImages: [SECOND_IMAGE] })
    await page.goto('/gallery')
    await page.getByRole('button', { name: 'Zaznacz', exact: true }).click()
    await page.getByRole('button', { name: 'Zaznacz wszystkie na stronie' }).click()
    await expect(page.getByText('Zaznaczono: 2')).toBeVisible()

    const toolbar = page.getByRole('toolbar', { name: 'Akcje dla zaznaczonych zdjęć' })
    await toolbar.getByRole('button', { name: 'Pobierz ZIP' }).click()
    await expect(page.getByText('Paczka gotowa')).toBeVisible()
    expect(requests.find((r) => r.url === '/generation/zip')?.body).toEqual({ imageIds: [IMAGE.id, SECOND_IMAGE.id] })

    await toolbar.getByRole('button', { name: 'Napisz opisy' }).click()
    const dialog = page.getByRole('dialog', { name: /Opisy dla zaznaczonych/ })
    await dialog.getByLabel(/Wspólne informacje/).fill('Gwarancja 24 miesiące')
    await dialog.getByRole('button', { name: 'Napisz opisy' }).click()
    await expect(dialog.getByText('Gotowe: 2, pominięte: 0, błędy: 0')).toBeVisible()
    const created = requests.filter((r) => r.method === 'POST' && /^\/descriptions\/img-(1|2)$/.test(r.url))
    expect(created.map((r) => r.url).sort()).toEqual([`/descriptions/${IMAGE.id}`, `/descriptions/${SECOND_IMAGE.id}`])
    for (const r of created) expect(r.body).toEqual({ notes: 'Gwarancja 24 miesiące' })
    await dialog.getByRole('button', { name: 'Zamknij', exact: true }).last().click()
    await page.getByRole('button', { name: 'Anuluj' }).click()
    await expect(page.getByRole('toolbar', { name: 'Akcje dla zaznaczonych zdjęć' })).toHaveCount(0)
  })

  test('[AC-BAT-006] the bulk upload summary offers the ZIP and descriptions for the whole batch', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto('/bulk-upload')
    await page.locator('input[type=file]').setInputFiles([
      { name: 'a.png', mimeType: 'image/png', buffer: PNG_BYTES },
      { name: 'b.png', mimeType: 'image/png', buffer: PNG_BYTES },
    ])
    await page.getByLabel('Wspólne style dla wszystkich').check()
    await page.getByRole('button', { name: 'Prześlij i generuj (2)' }).click()
    await expect(page.getByText('2 gotowe')).toBeVisible()

    await page.getByRole('button', { name: 'Pobierz wszystko (ZIP)' }).click()
    await expect(page.getByText('Paczka gotowa')).toBeVisible()
    expect(requests.find((r) => r.url === '/generation/zip')?.body).toEqual({ imageIds: ['img-new-1', 'img-new-2'] })

    await page.getByRole('button', { name: 'Napisz opisy dla wszystkich' }).click()
    const dialog = page.getByRole('dialog', { name: /Opisy dla zaznaczonych \(2\)/ })
    await dialog.getByRole('button', { name: 'Napisz opisy' }).click()
    await expect(dialog.getByText('Gotowe: 2, pominięte: 0, błędy: 0')).toBeVisible()
  })

  test('[AC-BAT-006] upload-only batches do not offer graphics actions', async ({ page }) => {
    await mockApp(page)
    await page.goto('/bulk-upload')
    await page.getByLabel('Tylko prześlij').check()
    await page.locator('input[type=file]').setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: PNG_BYTES }])
    await page.getByRole('button', { name: 'Prześlij (1)' }).click()
    await expect(page.getByText('1 przesłane')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pobierz wszystko (ZIP)' })).toHaveCount(0)
  })
})

test.describe('Allegro description publishing (spec 08)', () => {
  test('[AC-ALG-010] publishes the saved copy to the chosen offer with the chosen options', async ({ page }) => {
    const { requests } = await mockApp(page, { allegroConnected: true, withDescription: true })
    await page.goto(`/generate/${IMAGE.id}`)
    await expect(page.getByLabel('Tytuł oferty')).toHaveValue(DESCRIPTION.title)
    await page.getByRole('button', { name: 'Opublikuj na Allegro' }).click()

    const dialog = page.getByRole('dialog', { name: 'Opublikuj opis w Allegro' })
    await dialog.getByLabel('Kubek ceramiczny – oferta').check()
    await dialog.getByLabel(/Zastąp opis/).check()
    await dialog.getByLabel('Zmień też tytuł oferty').check()
    await dialog.getByRole('button', { name: 'Opublikuj opis' }).click()
    await expect(page.getByText('Tytuł i opis zaktualizowane w ofercie Allegro.')).toBeVisible()
    expect(requests.find((r) => r.url === '/allegro/offers/off-1/description')?.body).toEqual({ imageId: IMAGE.id, mode: 'replace', updateTitle: true })
  })

  test('[AC-ALG-010] preselects the source offer and hides the button without a connection', async ({ page }) => {
    await mockApp(page, { allegroConnected: true, withDescription: true, imageOfferId: 'off-1' })
    await page.goto(`/generate/${IMAGE.id}`)
    await page.getByRole('button', { name: 'Opublikuj na Allegro' }).click()
    const dialog = page.getByRole('dialog', { name: 'Opublikuj opis w Allegro' })
    await expect(dialog.getByLabel('Kubek ceramiczny – oferta')).toBeChecked()
    await expect(dialog.getByLabel(/Dodaj na początku/)).toBeChecked()

    const other = await page.context().newPage()
    await mockApp(other, { withDescription: true })
    await other.goto(`/generate/${IMAGE.id}`)
    await expect(other.getByLabel('Tytuł oferty')).toHaveValue(DESCRIPTION.title)
    await expect(other.getByRole('button', { name: 'Opublikuj na Allegro' })).toHaveCount(0)
  })
})

test.describe('invoices (spec 09)', () => {
  test('[AC-PAY-015] the history links the invoice of a paid order and the packages mention the NIP', async ({ page }) => {
    const history = [
      { id: 'tx-1', creditsAdded: 5, amountPln: 1000, status: 'completed', kind: 'package', createdAt: '2026-10-03T10:00:00.000Z', hasInvoice: true },
      { id: 'tx-2', creditsAdded: 15, amountPln: 2800, status: 'pending', kind: 'package', createdAt: '2026-10-03T09:00:00.000Z', hasInvoice: false },
    ]
    const { requests } = await mockApp(page, { history })
    await page.goto('/credits')
    await expect(page.getByText('Faktura VAT – NIP podasz w formularzu płatności').first()).toBeVisible()
    const invoiceButtons = page.getByRole('button', { name: 'Faktura' })
    await expect(invoiceButtons).toHaveCount(1)
    const popup = page.waitForEvent('popup')
    await invoiceButtons.click()
    await popup
    await expect.poll(() => requests.some((r) => r.url === '/payments/invoices/tx-1')).toBe(true)
  })
})
