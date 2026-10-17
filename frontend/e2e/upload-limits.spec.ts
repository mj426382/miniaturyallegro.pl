import { test, expect, Page, Route } from '@playwright/test'
import { mockApp, PNG_BYTES } from './fixtures'

/**
 * Spec 11 §5a, AC-UI-014: the API's upload limits (403 UPLOAD_LIMIT_UNVERIFIED, 429 UPLOAD_LIMIT_DAILY) are explained
 * next to the form – the API's message plus the next step – in single and bulk upload (per file in bulk);
 * every other upload error looks as before.
 */
const UNVERIFIED_MESSAGE =
  'Przed potwierdzeniem adresu e-mail możesz przesłać najwyżej 5 zdjęć. Kliknij link z wiadomości, którą wysłaliśmy po rejestracji (możesz wysłać go ponownie z banera u góry strony), a potem prześlesz kolejne.'
const UNVERIFIED = { statusCode: 403, code: 'UPLOAD_LIMIT_UNVERIFIED', limit: 5, message: UNVERIFIED_MESSAGE }
const DAILY_MESSAGE = 'Osiągnięto dzienny limit 200 przesłanych zdjęć. Kolejne prześlesz za około 3 godziny.'
const daily = (extra: Record<string, unknown> = {}) => ({ statusCode: 429, code: 'UPLOAD_LIMIT_DAILY', limit: 200, message: DAILY_MESSAGE, ...extra })
const FILE = (name: string) => ({ name, mimeType: 'image/png', buffer: PNG_BYTES })

/** Answers the upload endpoint with the given responses in order (`null` = the normal mocked success). */
async function uploadResponses(page: Page, responses: Array<{ status: number; body: unknown; headers?: Record<string, string> } | null>) {
  const calls: number[] = []
  await page.route('**/api/images/upload', async (route: Route) => {
    const response = responses[calls.length] ?? null
    calls.push(response?.status ?? 201)
    if (response) await route.fulfill({ status: response.status, json: response.body, headers: response.headers })
    else await route.fallback()
  })
  return calls
}

/** The time the app should show for a moment `seconds` from now, formatted in the browser (its time zone). */
const timeInBrowser = (page: Page, at: number) => page.evaluate((value) => new Date(value).toLocaleTimeString('pl-PL', { hour: 'numeric', minute: '2-digit' }), at)

async function uploadSingle(page: Page) {
  await page.goto('/upload')
  await page.locator('input[type=file]').setInputFiles(FILE('kubek.png'))
  await page.getByRole('button', { name: 'Prześlij i wybierz style' }).click()
}

test.describe('single upload', () => {
  test('[AC-UI-014] unverified account over the limit: shows the API message and resends the confirmation link', async ({ page }) => {
    const { requests } = await mockApp(page, { emailVerified: false })
    await uploadResponses(page, [{ status: 403, body: UNVERIFIED }])
    await uploadSingle(page)

    const alert = page.getByRole('alert').filter({ hasText: 'Potwierdź adres e-mail, aby przesłać więcej zdjęć' })
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(UNVERIFIED_MESSAGE)
    await expect(alert.getByTestId('upload-limit-retry')).toHaveCount(0)
    await expect(page).toHaveURL(/\/upload$/)
    // The photo stays selected, so the next try needs one click.
    await expect(page.getByRole('button', { name: 'Prześlij i wybierz style' })).toBeVisible()

    await alert.getByRole('button', { name: 'Wyślij link ponownie' }).click()
    await expect(page.getByText('Wysłaliśmy nowy link. Sprawdź skrzynkę, także folder spam.')).toBeVisible()
    expect(requests.filter((r) => r.url === '/auth/resend-verification')).toHaveLength(1)
  })

  test('[AC-UI-014] daily cap: API message plus the local time of the next upload; a later success clears it', async ({ page }) => {
    await mockApp(page)
    const seconds = 3 * 3600
    const calls = await uploadResponses(page, [{ status: 429, body: daily({ retryAfterSeconds: seconds }), headers: { 'Retry-After': String(seconds) } }, null])
    const expectedAt = Date.now() + seconds * 1000
    await uploadSingle(page)

    const alert = page.getByRole('alert').filter({ hasText: 'Wykorzystano dzienny limit 200 zdjęć' })
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(DAILY_MESSAGE)
    // Allow a minute of drift between computing the expectation and the response.
    const times = [await timeInBrowser(page, expectedAt), await timeInBrowser(page, expectedAt + 60_000)]
    await expect(alert.getByTestId('upload-limit-retry')).toHaveText(new RegExp(`^Kolejne zdjęcia prześlesz (dziś|jutro) o (${times.join('|')})\\.$`))
    await expect(alert.getByRole('button')).toHaveCount(0)

    await page.getByRole('button', { name: 'Prześlij i wybierz style' }).click()
    await expect(page).toHaveURL(/\/generate\/img-new-1$/)
    expect(calls).toEqual([429, 201])
  })

  test('[AC-UI-014] daily cap without message or time uses our texts; other errors stay toasts without the alert', async ({ page }) => {
    await mockApp(page)
    await uploadResponses(page, [
      { status: 429, body: { statusCode: 429, code: 'UPLOAD_LIMIT_DAILY' } },
      { status: 400, body: { statusCode: 400, message: 'Plik nie jest prawidłowym obrazem' } },
      { status: 429, body: { statusCode: 429, message: 'Zbyt wiele żądań – odczekaj chwilę' } },
    ])
    await uploadSingle(page)
    const alert = page.getByRole('alert').filter({ hasText: 'Wykorzystano dzienny limit' })
    await expect(alert).toContainText('Limit liczy zdjęcia przesłane w ciągu ostatnich 24 godzin.')
    await expect(alert.getByTestId('upload-limit-retry')).toHaveText('Spróbuj ponownie później.')

    await page.getByRole('button', { name: 'Prześlij i wybierz style' }).click()
    await expect(page.getByText('Plik nie jest prawidłowym obrazem')).toBeVisible()
    await expect(page.getByTestId('upload-limit-title')).toHaveCount(0)

    // A plain 429 from the request throttler is not the daily cap.
    await page.getByRole('button', { name: 'Prześlij i wybierz style' }).click()
    await expect(page.getByText('Zbyt wiele żądań – odczekaj chwilę')).toBeVisible()
    await expect(page.getByTestId('upload-limit-title')).toHaveCount(0)
  })
})

test.describe('bulk upload', () => {
  async function startBulk(page: Page, names: string[]) {
    await page.goto('/bulk-upload')
    await page.getByLabel('Tylko prześlij').check()
    await page.locator('input[type=file]').setInputFiles(names.map(FILE))
    await page.getByRole('button', { name: `Prześlij (${names.length})` }).click()
  }

  test('[AC-UI-014] the daily cap stops the batch: uploaded files stay, the rest wait with the reason per file', async ({ page }) => {
    const { requests } = await mockApp(page)
    const calls = await uploadResponses(page, [null, { status: 429, body: daily({ retryAfterSeconds: 2 * 3600 }) }])
    await startBulk(page, ['a.png', 'b.png', 'c.png'])

    const alert = page.getByRole('alert').filter({ hasText: 'Wykorzystano dzienny limit 200 zdjęć' })
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(DAILY_MESSAGE)
    await expect(alert.getByTestId('upload-limit-retry')).toHaveText(/^Kolejne zdjęcia prześlesz (dziś|jutro) o \d{1,2}:\d{2}\.$/)
    await expect(alert).toContainText('Przesłane zdjęcia zostają. Pozostałe czekają na liście – kliknij „Prześlij”, gdy limit pozwoli na kolejne.')
    // Per file: a.png uploaded, b.png refused, c.png never sent – both waiting with the reason.
    expect(calls).toEqual([201, 429])
    await expect(page.getByText('Przesłane', { exact: true })).toHaveCount(1)
    await expect(page.getByTestId('file-limit-note')).toHaveText(['— nie przesłano – dzienny limit', '— nie przesłano – dzienny limit'])
    await expect(page.getByRole('button', { name: 'Prześlij (2)' })).toBeEnabled()
    await expect(page.getByText('Błąd', { exact: true })).toHaveCount(0)
    expect(requests.filter((r) => /\/start$/.test(r.url))).toEqual([])
    // No „success” or „nothing processed” toast competes with the alert.
    await expect(page.getByText('Żaden plik nie został przetworzony')).toHaveCount(0)
    await expect(page.getByText(/Gotowe: \d+, z błędem/)).toHaveCount(0)

    // Later: the waiting files go through and their notes disappear.
    await page.getByRole('button', { name: 'Prześlij (2)' }).click()
    await expect(page.getByText('Przesłane', { exact: true })).toHaveCount(3)
    await expect(page.getByTestId('file-limit-note')).toHaveCount(0)
    await expect(page.getByTestId('upload-limit-title')).toHaveCount(0)
  })

  test('[AC-UI-014] unverified limit in the batch offers the link; other errors stay on the file and the batch goes on', async ({ page }) => {
    const { requests } = await mockApp(page, { emailVerified: false })
    const calls = await uploadResponses(page, [
      { status: 400, body: { statusCode: 400, message: 'Plik nie jest prawidłowym obrazem' } },
      { status: 403, body: UNVERIFIED },
    ])
    await startBulk(page, ['zly.png', 'b.png', 'c.png'])

    const alert = page.getByRole('alert').filter({ hasText: 'Potwierdź adres e-mail, aby przesłać więcej zdjęć' })
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(UNVERIFIED_MESSAGE)
    await expect(page.getByText('— Plik nie jest prawidłowym obrazem')).toBeVisible()
    await expect(page.getByTestId('file-limit-note')).toHaveText(['— nie przesłano – potwierdź adres e-mail', '— nie przesłano – potwierdź adres e-mail'])
    expect(calls).toEqual([400, 403])
    await expect(page.getByRole('button', { name: 'Prześlij (2)' })).toBeEnabled()

    await alert.getByRole('button', { name: 'Wyślij link ponownie' }).click()
    await expect(page.getByText('Wysłaliśmy nowy link. Sprawdź skrzynkę, także folder spam.')).toBeVisible()
    expect(requests.filter((r) => r.url === '/auth/resend-verification')).toHaveLength(1)
  })

  test('[AC-UI-014] without limit errors the batch behaves as before (per-file error and summary toast)', async ({ page }) => {
    await mockApp(page)
    const calls = await uploadResponses(page, [null, { status: 500, body: { statusCode: 500, message: 'Błąd serwera' } }, null])
    await startBulk(page, ['a.png', 'b.png', 'c.png'])
    await expect(page.getByText('Gotowe: 2, z błędem: 1 – sprawdź komunikaty na liście.')).toBeVisible()
    await expect(page.getByText('— Błąd serwera')).toBeVisible()
    await expect(page.getByTestId('upload-limit-title')).toHaveCount(0)
    expect(calls).toEqual([201, 500, 201])
  })
})
