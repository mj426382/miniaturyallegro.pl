import { expect, test } from '@playwright/test'
import { ADMIN_USERS, IMAGE, mockApp, PNG_BYTES } from './fixtures'

/** Spec 19: welcome pack, offer when credits run out, payment retry, consent, admin gifts, free pool copy. */

const files = [
  { name: 'kubek.png', mimeType: 'image/png', buffer: PNG_BYTES },
  { name: 'talerz.png', mimeType: 'image/png', buffer: PNG_BYTES },
]

test.describe('offer when the balance runs out', () => {
  test('[AC-MON-003] the generator opens the offer with the welcome pack instead of starting; payment needs the consent', async ({ page }) => {
    const { requests } = await mockApp(page, { noCredits: true })
    await page.goto(`/generate/${IMAGE.id}`)
    await page.getByRole('button', { name: 'Pokaż style' }).click()
    await page.getByRole('button', { name: /^Generuj \d+ grafik/ }).click()

    const dialog = page.getByRole('dialog', { name: /Brakuje Ci/ })
    await expect(dialog).toBeVisible()
    const welcome = dialog.getByRole('button', { name: /Pakiet powitalny – 5 kredytów/ })
    await expect(welcome).toContainText('5 zł')
    await expect(dialog.getByRole('button', { name: /^5 kredytów/ })).toBeVisible()
    expect(requests.some((r) => r.url.endsWith('/start'))).toBe(false)

    await welcome.click()
    await expect(page.getByText('Zaznacz zgodę na natychmiastowe udostępnienie kredytów')).toBeVisible()
    expect(requests.some((r) => r.url === '/payments/checkout')).toBe(false)

    await dialog.getByRole('checkbox').check()
    await welcome.click()
    await expect(page).toHaveURL(/\/credits\?success=1|\/credits$/)
    expect(requests.find((r) => r.url === '/payments/checkout')?.body).toEqual({ packageId: 'welcome_5', acceptedWithdrawalWaiver: true })
  })

  test('[AC-MON-003] after the first purchase the offer shows only the regular packs; Escape closes it', async ({ page }) => {
    await mockApp(page, { noCredits: true, hasPurchased: true })
    await page.goto(`/generate/${IMAGE.id}`)
    await page.getByRole('button', { name: 'Pokaż style' }).click()
    await page.getByRole('button', { name: /^Generuj \d+ grafik/ }).click()
    const dialog = page.getByRole('dialog', { name: /Brakuje Ci/ })
    await expect(dialog.getByRole('button', { name: /^5 kredytów/ })).toBeVisible()
    await expect(dialog.getByText('Pakiet powitalny')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('[AC-MON-003] bulk upload opens the same offer instead of a disabled button', async ({ page }) => {
    const { requests } = await mockApp(page, { noCredits: true })
    await page.goto('/bulk-upload')
    await page.locator('input[type=file]').setInputFiles(files)
    await page.getByLabel('Wspólne style dla wszystkich').check()
    const start = page.getByRole('button', { name: 'Prześlij i generuj (2)' })
    await expect(start).toBeEnabled()
    await start.click()
    await expect(page.getByRole('dialog', { name: /Brakuje Ci 6 kredytów/ })).toBeVisible()
    expect(requests.some((r) => r.url.startsWith('/images/upload'))).toBe(false)
  })

  test('[AC-MON-003] the admin never sees the offer', async ({ page }) => {
    await mockApp(page, { noCredits: true, isAdmin: true })
    await page.goto(`/generate/${IMAGE.id}`)
    await page.getByRole('button', { name: 'Pokaż style' }).click()
    await page.getByRole('button', { name: /^Generuj \d+ grafik/ }).click()
    await expect(page.getByRole('dialog', { name: /Brakuje Ci/ })).toHaveCount(0)
  })
})

test.describe('credits page', () => {
  test('[AC-MON-002] shows the welcome pack only before the first purchase', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto('/credits')
    const card = page.getByTestId('welcome-offer')
    await expect(card).toContainText('Pakiet powitalny – 5 kredytów')
    await expect(card).toContainText('5 zł zamiast 10 zł')
    await page.getByText(/Żądam natychmiastowego udostępnienia kredytów/).click()
    await card.getByRole('button', { name: 'Kup za 5 zł' }).click()
    await expect.poll(() => requests.find((r) => r.url === '/payments/checkout')?.body).toEqual({ packageId: 'welcome_5', acceptedWithdrawalWaiver: true })
  })

  test('[AC-MON-002] is hidden after a purchase', async ({ page }) => {
    await mockApp(page, { hasPurchased: true })
    await page.goto('/credits')
    await expect(page.getByRole('heading', { name: 'Kredyty', level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Kup 5 kredytów/ })).toBeVisible()
    await expect(page.getByTestId('welcome-offer')).toHaveCount(0)
  })

  test('[AC-MON-004] after a cancelled payment explains BLIK and retries the same package', async ({ page }) => {
    const { requests } = await mockApp(page, { hasPurchased: true })
    await page.addInitScript(() => sessionStorage.setItem('allgrafika:last-package', 'credits_5'))
    await page.goto('/credits?canceled=1')
    const banner = page.getByRole('status').filter({ hasText: 'Płatność nie została dokończona' })
    await expect(banner).toContainText('Kod BLIK jest ważny tylko 2 minuty')
    await expect(banner).toContainText('kartą')
    await page.getByText(/Żądam natychmiastowego udostępnienia kredytów/).click()
    await banner.getByRole('button', { name: 'Spróbuj ponownie' }).click()
    await expect.poll(() => requests.find((r) => r.url === '/payments/checkout')?.body).toEqual({ packageId: 'credits_5', acceptedWithdrawalWaiver: true })
  })
})

test.describe('marketing consent', () => {
  test('[AC-MON-005] sign-up explains the benefit and keeps the box unticked', async ({ page }) => {
    await mockApp(page, { loggedIn: false })
    await page.goto('/register')
    const consent = page.getByLabel(/Chcę dostawać e-mailem zniżki na kredyty/)
    await expect(consent).not.toBeChecked()
    await expect(page.getByText(/wypis jednym kliknięciem/)).toBeVisible()
  })

  test('[AC-MON-005] the dashboard card turns consent on with an explicit click and then disappears', async ({ page }) => {
    const { requests } = await mockApp(page, { marketingConsent: false })
    await page.goto('/')
    const card = page.getByRole('region', { name: 'Chcesz dostawać zniżki na kredyty i porady?' })
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: 'Tak, chcę' }).click()
    await expect(card).toBeHidden()
    expect(requests.filter((r) => r.url === '/users/me' && r.method === 'PATCH').map((r) => r.body)).toEqual([{ marketingConsent: true }])
  })

  test('[AC-MON-005] the generator asks next to finished graphics and one answer hides the card everywhere', async ({ page }) => {
    await mockApp(page, { marketingConsent: false })
    await page.goto(`/generate/${IMAGE.id}`)
    const card = page.getByRole('region', { name: 'Chcesz dostawać zniżki na kredyty i porady?' })
    await expect(card).toBeVisible() // IMAGE already has a finished graphic
    await card.getByRole('button', { name: 'Nie, dziękuję' }).click()
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Witaj/ })).toBeVisible()
    await expect(card).toHaveCount(0) // one decision hides it everywhere
  })

  test('[AC-MON-005] "Nie, dziękuję" hides the card for good without saving consent', async ({ page }) => {
    const { requests } = await mockApp(page, { marketingConsent: false })
    await page.goto('/')
    const card = page.getByRole('region', { name: 'Chcesz dostawać zniżki na kredyty i porady?' })
    await card.getByRole('button', { name: 'Nie, dziękuję' }).click()
    await expect(card).toBeHidden()
    await page.reload()
    await expect(page.getByRole('heading', { name: /Witaj/ })).toBeVisible()
    await expect(card).toHaveCount(0)
    expect(requests.some((r) => r.url === '/users/me' && r.method === 'PATCH')).toBe(false)
  })
})

test('[AC-MON-006] the admin gives credits from the user details and sees them in the history', async ({ page }) => {
  const { requests } = await mockApp(page, { isAdmin: true })
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Panel administratora' })).toBeVisible()
  await page.getByRole('button', { name: new RegExp(ADMIN_USERS[0].email.replace(/\./g, '\\.')) }).click()
  const dialog = page.getByRole('dialog', { name: ADMIN_USERS[0].email })
  await dialog.getByLabel('Liczba').fill('5')
  await dialog.getByLabel('Powód (zapisywany w historii)').fill('Prezent – 5 grafik gratis')
  await dialog.getByRole('button', { name: 'Dodaj kredyty' }).click()
  await expect(page.getByText(/Dodano 5 kredytów/)).toBeVisible()
  await expect(dialog.getByRole('list', { name: 'Historia dodanych kredytów' })).toContainText('Prezent – 5 grafik gratis')
  expect(requests.find((r) => r.url.endsWith('/credits'))?.body).toEqual({ amount: 5, reason: 'Prezent – 5 grafik gratis' })
})

test('[AC-MON-007] a new account sees its pool of 5 free graphics; sign-up promises 5', async ({ page }) => {
  await mockApp(page, { freeCreditsLimit: 5 })
  await page.goto('/credits')
  // USER has 3 free graphics used: 2 of 5 left on the credits page.
  await expect(page.locator('main').getByText('2 / 5', { exact: true })).toBeVisible()
  await mockApp(page, { loggedIn: false })
  await page.goto('/register')
  await expect(page.getByText(/5 grafik za darmo/)).toBeVisible()
})
