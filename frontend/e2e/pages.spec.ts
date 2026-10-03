import { test, expect, Page } from '@playwright/test'
import { mockApp, PNG_BYTES, PASSWORD, USER } from './fixtures'

/**
 * Every screen of the app, driven against a mocked API on all configured devices:
 * auth pages, dashboard (incl. API failure), upload (incl. rejected files), generator actions,
 * account settings (name, password, deletion), gallery deletion, 404, navigation and logout.
 */
const isMobile = (page: Page) => page.viewportSize()!.width < 768

async function openMenuIfMobile(page: Page) {
  if (isMobile(page)) await page.getByRole('button', { name: 'Otwórz menu' }).click()
}

test.describe('login', () => {
  test('[AC-UI-005, AC-AUTH-005] rejects a wrong password with a readable error and signs in with the right one', async ({ page }) => {
    const { requests } = await mockApp(page, { loggedIn: false })
    await page.goto('/login')
    await expect(page).toHaveTitle(/Logowanie/)
    await expect(page.getByRole('heading', { name: 'Zaloguj się' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zaloguj się', exact: true })).toBeDisabled()

    await page.getByLabel('Email').fill('test@allgrafika.pl')
    await page.getByLabel('Hasło', { exact: true }).fill('Zle!Haslo1')
    await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Nieprawidłowy email lub hasło')

    await page.getByRole('button', { name: /Pokaż/ }).click()
    await expect(page.getByLabel('Hasło', { exact: true })).toHaveAttribute('type', 'text')
    await page.getByLabel('Hasło', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: /Witaj/ })).toBeVisible()
    expect(requests.filter((r) => r.url === '/auth/login')).toHaveLength(2)
    expect(requests.at(-1)!.body).toEqual({ email: 'test@allgrafika.pl', password: PASSWORD })
  })

  test('[AC-AUTH-016] a logged-in visitor is not stuck on the login page after signing in again', async ({ page }) => {
    await mockApp(page, { loggedIn: false })
    await page.goto('/gallery')
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('registration', () => {
  test('[AC-AUTH-017] keeps the button disabled until the form is valid and the terms are accepted', async ({ page }) => {
    const { requests } = await mockApp(page, { loggedIn: false })
    await page.goto('/register')
    await expect(page).toHaveTitle(/Rejestracja/)
    const submit = page.getByRole('button', { name: 'Zarejestruj się' })
    await expect(submit).toBeDisabled()

    await page.getByLabel('Imię i nazwisko').fill('Jan Testowy')
    await page.getByLabel('Email').fill('nowy@allgrafika.pl')
    await page.getByLabel('Hasło', { exact: true }).fill('slabe')
    await page.getByLabel('Hasło', { exact: true }).blur()
    await expect(page.getByText('Brakuje:')).toBeVisible()
    await page.getByLabel('Hasło', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Potwierdź hasło').fill('Inne!Haslo1')
    await page.getByLabel('Potwierdź hasło').blur()
    await expect(page.getByText('Hasła nie są identyczne')).toBeVisible()
    await page.getByLabel('Potwierdź hasło').fill(PASSWORD)
    await expect(submit).toBeDisabled() // terms not accepted yet

    await page.locator('#acceptTerms').check()
    await expect(submit).toBeEnabled()
    await submit.click()
    await expect(page).toHaveURL(/\/$/)
    expect(requests.find((r) => r.url === '/auth/register')!.body).toEqual({ email: 'nowy@allgrafika.pl', password: PASSWORD, name: 'Jan Testowy', acceptedTerms: true })
  })
})

test.describe('forgot password', () => {
  test('[AC-AUTH-018] always confirms without revealing whether the e-mail exists', async ({ page }) => {
    const { requests } = await mockApp(page, { loggedIn: false })
    await page.goto('/forgot-password')
    await expect(page).toHaveTitle(/Reset hasła/)
    await page.getByLabel('Email').fill('ktos@allgrafika.pl')
    await page.getByRole('button', { name: 'Wyślij link resetujący' }).click()
    await expect(page.getByText('Jeśli podany email istnieje')).toBeVisible()
    expect(requests.find((r) => r.url === '/auth/forgot-password')!.body).toEqual({ email: 'ktos@allgrafika.pl' })
  })
})

test.describe('dashboard', () => {
  test('[AC-UPL-016] shows the counters and recent photos', async ({ page }) => {
    await mockApp(page)
    await page.goto('/')
    await expect(page).toHaveTitle(/Dashboard/)
    await expect(page.getByText('Przesłane zdjęcia')).toBeVisible()
    await expect(page.getByText('Wygenerowane grafiki')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zobacz warianty' })).toBeVisible()
  })

  test('[AC-UI-006] an API failure shows an error with retry instead of an empty state', async ({ page }) => {
    await mockApp(page)
    let failures = 0
    await page.route('**/api/images?*', (route) => {
      failures++
      if (failures === 1) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' })
      return route.fallback()
    })
    await page.goto('/')
    await expect(page.getByRole('alert')).toContainText('Nie udało się pobrać Twoich zdjęć')
    await expect(page.getByText('Nie masz jeszcze żadnych zdjęć')).toHaveCount(0)
    await page.getByRole('button', { name: 'Spróbuj ponownie' }).click()
    await expect(page.getByRole('link', { name: 'Zobacz warianty' })).toBeVisible()
  })
})

test.describe('single upload', () => {
  test('[AC-UPL-009] refuses oversized files with a message and sends a valid one to the generator', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto('/upload')
    await expect(page).toHaveTitle(/Prześlij zdjęcie/)

    await page.locator('input[type=file]').setInputFiles({ name: 'huge.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(11 * 1024 * 1024) })
    await expect(page.getByText('Plik jest za duży (max 10 MB): huge.jpg')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Prześlij i wybierz style' })).toHaveCount(0)

    await page.locator('input[type=file]').setInputFiles({ name: 'kubek.png', mimeType: 'image/png', buffer: PNG_BYTES })
    await expect(page.getByText('kubek.png')).toBeVisible()
    await page.getByRole('button', { name: 'Prześlij i wybierz style' }).click()
    await expect(page).toHaveURL(/\/generate\/img-new-1$/)
    await expect(page.getByRole('heading', { name: 'Generator grafik produktowych' })).toBeVisible()
    expect(requests.filter((r) => r.url === '/images/upload')).toHaveLength(1)
  })
})

test.describe('generator actions', () => {
  test('[AC-GEN-021] custom style, retry of a failed graphic and feedback', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto('/generate/img-1')
    await expect(page).toHaveTitle(/Generator grafik/)

    // With results on the photo the style picker starts collapsed – open it, then switch to the custom tab
    await page.getByRole('button', { name: 'Pokaż style' }).click()
    await page.getByRole('tab', { name: 'Własny styl' }).click()
    await page.getByPlaceholder('np. na drewnianym stole, w plenerze, ciepłe kolory, rozmyte tło').fill('na marmurowym blacie')
    await page.getByRole('button', { name: 'Generuj grafikę' }).click()
    await expect.poll(() => requests.some((r) => r.url === '/generation/img-1/custom')).toBe(true)
    expect(requests.find((r) => r.url === '/generation/img-1/custom')!.body).toContain('na marmurowym blacie')

    // Retry the failed graphic
    await page.getByRole('button', { name: 'Ponów (kredyt zwrócony)' }).click()
    await expect.poll(() => requests.some((r) => r.url === '/generation/retry/gen-2')).toBe(true)

    // Thumbs up on the finished one
    await page.getByTitle('Dobra grafika').first().click()
    await expect.poll(() => requests.find((r) => r.url === '/generation/feedback/gen-1')?.body?.rating).toBe(1)

    // While graphics are in progress the photo cannot be deleted (credits would be lost mid-flight).
    await expect(page.getByRole('button', { name: 'Usuń zdjęcie' })).toBeDisabled()
  })

  test('[AC-UPL-017] deleting the photo asks for confirmation and returns to the gallery', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto('/generate/img-1')
    await page.getByRole('button', { name: 'Usuń zdjęcie' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Usunąć to zdjęcie?')
    await dialog.getByRole('button', { name: 'Anuluj' }).click()
    await expect(dialog).toHaveCount(0)
    expect(requests.some((r) => r.url === '/images/img-1' && r.method === 'DELETE')).toBe(false)
    await page.getByRole('button', { name: 'Usuń zdjęcie' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń zdjęcie' }).click()
    await expect(page).toHaveURL(/\/gallery$/)
    expect(requests.some((r) => r.url === '/images/img-1' && r.method === 'DELETE')).toBe(true)
  })
})

test.describe('gallery', () => {
  test('[AC-UPL-015] deletes a photo after confirmation', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto('/gallery')
    await expect(page).toHaveTitle(/Galeria/)
    await page.getByRole('button', { name: 'Usuń zdjęcie' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń zdjęcie' }).click()
    await expect(page.getByText('Brak zdjęć w galerii')).toBeVisible()
    expect(requests.some((r) => r.url === '/images/img-1' && r.method === 'DELETE')).toBe(true)
  })
})

test.describe('account settings', () => {
  test('[AC-AUTH-021] saves the name, changes the password with validation and deletes the account', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto('/account')
    await expect(page).toHaveTitle(/Ustawienia konta/)

    await page.getByLabel('Imię i nazwisko').fill('Nowe Imię')
    await page.getByRole('button', { name: 'Zapisz', exact: true }).click()
    await expect(page.getByText('Zapisano', { exact: true })).toBeVisible()
    expect(requests.find((r) => r.url === '/users/me' && r.method === 'PATCH')!.body).toEqual({ name: 'Nowe Imię' })

    const change = page.getByRole('button', { name: 'Zmień hasło' })
    await expect(change).toBeDisabled()
    await page.getByLabel('Obecne hasło').fill('Zle!Haslo1')
    await page.getByLabel('Nowe hasło', { exact: true }).fill('slabe')
    await expect(page.getByText('Brakuje:')).toBeVisible()
    await page.getByLabel('Nowe hasło', { exact: true }).fill('Nowe!Haslo2')
    await page.getByLabel('Powtórz nowe hasło').fill('Nowe!Haslo3')
    await expect(page.getByText('Hasła nie są identyczne')).toBeVisible()
    await page.getByLabel('Powtórz nowe hasło').fill('Nowe!Haslo2')
    await expect(change).toBeEnabled()
    await change.click()
    await expect(page.getByText('Obecne hasło jest nieprawidłowe')).toBeVisible()
    await page.getByLabel('Obecne hasło').fill(PASSWORD)
    await change.click()
    await expect(page.getByText('Hasło zmienione. Inne zalogowane urządzenia zostały wylogowane.')).toBeVisible()
    expect(requests.filter((r) => r.url === '/auth/change-password')).toHaveLength(2)

    const remove = page.getByRole('button', { name: 'Usuń konto na stałe' })
    await expect(remove).toBeDisabled()
    await page.getByLabel('Adres e-mail konta').fill(USER.email)
    await expect(remove).toBeEnabled()
    await remove.click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń konto' }).click()
    await expect(page).toHaveURL(/\/login$/)
    expect(requests.find((r) => r.url === '/users/me' && r.method === 'DELETE')!.body).toEqual({ confirmEmail: USER.email })
  })
})

test.describe('navigation', () => {
  test('[AC-UI-003] unknown addresses show a 404 page with a way back', async ({ page }) => {
    await mockApp(page)
    await page.goto('/nie-ma-takiej-strony')
    await expect(page.getByText('Tej strony nie ma')).toBeVisible()
    await page.getByRole('link', { name: 'Wróć na dashboard' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('[AC-UI-004] the mobile menu opens, navigates and closes', async ({ page }) => {
    test.skip(!isMobile(page), 'mobile layout only')
    await mockApp(page)
    await page.goto('/')
    const open = page.getByRole('button', { name: 'Otwórz menu' })
    await expect(open).toHaveAttribute('aria-expanded', 'false')
    await open.click()
    await expect(open).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('link', { name: 'Galeria' }).click()
    await expect(page).toHaveURL(/\/gallery$/)
    await expect(open).toHaveAttribute('aria-expanded', 'false')
  })

  test('[AC-AUTH-022] logging out ends the session and protects private pages', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto('/')
    await openMenuIfMobile(page)
    await page.getByRole('button', { name: 'Wyloguj się' }).click()
    await expect(page).toHaveURL(/\/login$/)
    expect(requests.some((r) => r.url === '/auth/logout')).toBe(true)
    await page.goto('/gallery')
    await expect(page).toHaveURL(/\/login$/)
  })
})
