import { test, expect } from '@playwright/test'

// 1×1 PNG – the API is mocked, so the content only has to be a valid image file.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64')
const API = 'https://server.allgrafika.pl/api'

test('[AC-PERF-005] the demo posts multipart form data with fetch and shows the result', async ({ page }) => {
  let posted: { contentType: string; body: string } | null = null
  await page.route(`${API}/demo`, async (route) => {
    const req = route.request()
    posted = { contentType: req.headers()['content-type'] ?? '', body: req.postDataBuffer()?.toString('latin1') ?? '' }
    await route.fulfill({ status: 201, json: { id: 'demo-1' } })
  })
  await page.route(`${API}/demo/demo-1`, (route) =>
    route.fulfill({
      json: { id: 'demo-1', status: 'COMPLETED', originalUrl: 'https://cdn.test/original.png', resultUrl: 'https://cdn.test/result.png', registerUrl: 'https://app.allgrafika.pl/register' },
    }),
  )
  await page.route('https://cdn.test/**', (route) => route.fulfill({ contentType: 'image/png', body: PNG }))

  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('#demo input[type="file"]').setInputFiles({ name: 'produkt.png', mimeType: 'image/png', buffer: PNG })
  await page.getByPlaceholder('twoj@sklep.pl').fill('sprzedawca@example.com')
  await page.locator('#demo label').filter({ hasText: 'Akceptuję' }).locator('input[type="checkbox"]').check()
  await page.getByRole('button', { name: 'Wygeneruj darmową grafikę' }).click()

  await expect(page.getByAltText('Po', { exact: true })).toBeVisible()
  expect(posted).not.toBeNull()
  expect(posted!.contentType).toMatch(/^multipart\/form-data; boundary=/)
  expect(posted!.body).toContain('name="email"')
  expect(posted!.body).toContain('sprzedawca@example.com')
  expect(posted!.body).toContain('name="file"; filename="produkt.png"')
  expect(posted!.body).toContain('name="style"')
})

test('[AC-PERF-005] a validation error from the API is shown in the form', async ({ page }) => {
  await page.route(`${API}/demo`, (route) => route.fulfill({ status: 429, json: { statusCode: 429, message: 'Ten adres e-mail wykorzystał już darmową próbę.' } }))
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('#demo input[type="file"]').setInputFiles({ name: 'produkt.png', mimeType: 'image/png', buffer: PNG })
  await page.getByPlaceholder('twoj@sklep.pl').fill('sprzedawca@example.com')
  await page.locator('#demo label').filter({ hasText: 'Akceptuję' }).locator('input[type="checkbox"]').check()
  await page.getByRole('button', { name: 'Wygeneruj darmową grafikę' }).click()
  await expect(page.getByText('Ten adres e-mail wykorzystał już darmową próbę.')).toBeVisible()
})
