import { test, expect } from '@playwright/test'
import { mockApp, IMAGE, PNG_BYTES } from './fixtures'

/** Spec 27: „Moje style” – saved styles managed on /styles and chosen in the generator and in bulk upload. */
const KITCHEN = {
  id: 'us-a',
  name: 'Kuchnia z kotem',
  prompt: 'produkt na stole w jasnej kuchni, obok siedzi kot',
  referenceUrl: '/api/uploads/user-styles/a.png',
  createdAt: '2026-10-28T09:00:00.000Z',
  updatedAt: '2026-10-28T09:00:00.000Z',
}
const MEADOW = { ...KITCHEN, id: 'us-b', name: 'Plener', prompt: 'na trawie w słońcu', referenceUrl: null }

test.describe('Moje style', () => {
  test('[AC-UST-008] add, validate, edit and delete a saved style from the menu', async ({ page }) => {
    const { requests } = await mockApp(page)
    await page.goto('/')
    // The menu item exists (on phones the sidebar is behind the menu button), then open the page.
    await expect(page.locator('a[href="/styles"]', { hasText: 'Moje style' }).first()).toBeAttached()
    await page.goto('/styles')
    await expect(page.getByRole('heading', { name: 'Moje style', level: 1 })).toBeVisible()
    await expect(page.getByText('Nie masz jeszcze zapisanych stylów.')).toBeVisible()

    // Client-side validation: nothing is sent.
    await page.getByRole('button', { name: 'Dodaj styl' }).click()
    await page.getByLabel('Nazwa stylu').fill('a')
    await page.getByLabel('Opis sceny').fill('jasna kuchnia')
    await page.getByRole('button', { name: 'Zapisz styl' }).click()
    await expect(page.getByRole('alert')).toHaveText('Nazwa stylu musi mieć co najmniej 2 znaki.')
    expect(requests.filter((r) => r.url === '/user-styles' && r.method === 'POST')).toHaveLength(0)

    // Save with a reference photo; the counter follows the description.
    await page.getByLabel('Nazwa stylu').fill('Kuchnia z kotem')
    await page.getByLabel('Opis sceny').fill('produkt na stole, obok kot')
    await expect(page.getByTestId('style-prompt-count')).toHaveText('26/500')
    await page.getByTestId('style-reference-input').setInputFiles({ name: 'wzor.png', mimeType: 'image/png', buffer: PNG_BYTES })
    await expect(page.getByAltText('Podgląd zdjęcia wzoru')).toBeVisible()
    await page.getByRole('button', { name: 'Zapisz styl' }).click()
    const list = page.getByRole('list', { name: 'Zapisane style' })
    await expect(list.getByText('Kuchnia z kotem')).toBeVisible()
    expect(requests.find((r) => r.url === '/user-styles' && r.method === 'POST')?.body).toEqual({
      name: 'Kuchnia z kotem',
      prompt: 'produkt na stole, obok kot',
      reference: true,
    })

    // Duplicate name (any case) – the API message is shown in the form.
    await page.getByRole('button', { name: 'Dodaj styl' }).click()
    await page.getByLabel('Nazwa stylu').fill('kuchnia z kotem')
    await page.getByLabel('Opis sceny').fill('inny opis sceny')
    await page.getByRole('button', { name: 'Zapisz styl' }).click()
    await expect(page.getByRole('alert')).toHaveText('Masz już styl o tej nazwie.')
    await page.getByRole('button', { name: 'Anuluj' }).click()

    // Edit: rename and drop the photo.
    await page.getByRole('button', { name: 'Edytuj styl Kuchnia z kotem' }).click()
    await page.getByLabel('Nazwa stylu').fill('Kuchnia z psem')
    await page.getByRole('button', { name: 'Usuń zdjęcie' }).click()
    await page.getByRole('button', { name: 'Zapisz styl' }).click()
    await expect(list.getByText('Kuchnia z psem')).toBeVisible()
    expect(requests.find((r) => r.method === 'PATCH')?.body).toMatchObject({ name: 'Kuchnia z psem', removeReference: true, reference: false })

    // Delete with confirmation; cancel first.
    await page.getByRole('button', { name: 'Usuń styl Kuchnia z psem' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Gotowe grafiki zostaną.')
    await dialog.getByRole('button', { name: 'Anuluj' }).click()
    expect(requests.filter((r) => r.method === 'DELETE')).toHaveLength(0)
    await page.getByRole('button', { name: 'Usuń styl Kuchnia z psem' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń styl' }).click()
    await expect(page.getByText('Nie masz jeszcze zapisanych stylów.')).toBeVisible()
    expect(requests.filter((r) => r.method === 'DELETE').map((r) => r.url)).toEqual(['/user-styles/us-1'])
  })

  test('[AC-UST-009] the generator lists saved styles first, counts them in the cost and starts each one', async ({ page }) => {
    const { requests } = await mockApp(page, { userStyles: [KITCHEN, MEADOW] })
    await page.goto(`/generate/${IMAGE.id}`)
    await page.getByRole('button', { name: 'Pokaż style' }).click()

    const group = page.getByTestId('user-style-group')
    await expect(group).toBeVisible()
    const firstGroupIsMine = await page.evaluate(() => {
      const mine = document.querySelector('[data-testid="user-style-group"]')!
      const universal = [...document.querySelectorAll('p')].find((p) => p.textContent === 'Uniwersalne')!
      return Boolean(mine.compareDocumentPosition(universal) & Node.DOCUMENT_POSITION_FOLLOWING)
    })
    expect(firstGroupIsMine).toBe(true)

    for (const name of ['Białe tło', 'Lifestyle – wnętrze', 'Ciemny luksus', 'Gradient']) await page.getByLabel(name).uncheck()
    await page.getByLabel('Gradient').check()
    await page.getByLabel('Mój styl: Kuchnia z kotem').check()
    await page.getByLabel('Mój styl: Plener').check()
    await page.getByRole('button', { name: 'Generuj 3 grafiki' }).click()

    await expect(page.getByText('✨ Mój styl: Kuchnia z kotem').first()).toBeVisible()
    await expect(page.getByText('✨ Mój styl: Plener').first()).toBeVisible()
    expect(requests.find((r) => r.url === `/generation/${IMAGE.id}/start`)?.body).toEqual({ styles: ['gradient-bg'] })
    expect(requests.filter((r) => r.url.includes('/user-style/')).map((r) => r.url)).toEqual([`/generation/${IMAGE.id}/user-style/us-a`, `/generation/${IMAGE.id}/user-style/us-b`])
  })

  test('[AC-UST-009] without saved styles the group links to /styles', async ({ page }) => {
    await mockApp(page)
    await page.goto(`/generate/${IMAGE.id}`)
    await page.getByRole('button', { name: 'Pokaż style' }).click()
    const group = page.getByTestId('user-style-group')
    await expect(group.getByRole('link', { name: 'Zapisz własny styl' })).toHaveAttribute('href', '/styles')
    await group.getByRole('link', { name: 'Zarządzaj stylami' }).click()
    await expect(page).toHaveURL(/\/styles$/)
  })

  test.describe('bulk upload', () => {
    const files = [
      { name: 'a.png', mimeType: 'image/png', buffer: PNG_BYTES },
      { name: 'b.png', mimeType: 'image/png', buffer: PNG_BYTES },
    ]

    test('[AC-UST-010] a saved style chosen for the whole batch runs after the built-in styles of every photo', async ({ page }) => {
      const { requests } = await mockApp(page, { userStyles: [KITCHEN, MEADOW] })
      await page.goto('/bulk-upload')
      await page.locator('input[type=file]').first().setInputFiles(files)
      await page.getByLabel('Wspólne style dla wszystkich').check()
      await page.getByLabel('Mój styl: Kuchnia z kotem').check()
      await expect(page.getByText('8 kredytów')).toBeVisible() // 2 photos × (3 starter + 1 saved)
      await page.getByRole('button', { name: 'Prześlij i generuj (2)' }).click()
      await expect(page.getByText('2 gotowe')).toBeVisible()
      const calls = requests.filter((r) => r.url.startsWith('/generation/img-new-')).map((r) => r.url)
      expect(calls).toEqual(['/generation/img-new-1/start', '/generation/img-new-1/user-style/us-a', '/generation/img-new-2/start', '/generation/img-new-2/user-style/us-a'])
    })

    test('[AC-UST-010] per-file mode adds a saved style to one photo only', async ({ page }) => {
      const { requests } = await mockApp(page, { userStyles: [KITCHEN, MEADOW] })
      await page.goto('/bulk-upload')
      await page.locator('input[type=file]').first().setInputFiles(files)
      await page.getByLabel('Osobne style dla każdego pliku').check()
      const rows = page.getByRole('listitem')
      await rows.nth(0).getByTestId('file-user-styles').getByRole('button', { name: 'Plener' }).click()
      await expect(page.getByText('7 kredytów')).toBeVisible() // (3 + 1) + 3
      await page.getByRole('button', { name: 'Prześlij i generuj (2)' }).click()
      await expect(page.getByText('2 gotowe')).toBeVisible()
      const calls = requests.filter((r) => r.url.startsWith('/generation/img-new-')).map((r) => r.url)
      expect(calls).toEqual(['/generation/img-new-1/start', '/generation/img-new-1/user-style/us-b', '/generation/img-new-2/start'])
    })
  })
})
