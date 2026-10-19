import { expect, test, type Page } from '@playwright/test'
import { mockApp } from './fixtures'

/** Browser coverage for the partner programme in the admin panel (spec 24) on every device profile. */

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test.describe('admin partners (spec 24)', () => {
  test('[AC-PRT-015] list with metrics, Polish errors before sending, a new partner with a code', async ({ page }) => {
    const { requests } = await mockApp(page, { isAdmin: true })
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Partnerzy' }).click()

    const list = page.getByRole('list', { name: 'Partnerzy' })
    const katalog = list.getByTestId('partner-row').filter({ hasText: 'Katalog Firm' })
    await expect(katalog).toContainText('aktywny')
    await expect(katalog).toContainText('−10% dla klientów · 20% prowizji · 12 mies.')
    await expect(katalog).toContainText('Kody: KATALOG-10 · Klienci: 3')
    await expect(katalog.getByTestId('partner-current-month')).toHaveText('Ten miesiąc: 2 zamówienia · netto 35,20 zł · prowizja 7,04 zł')
    await expect(katalog.getByTestId('partner-all-time')).toHaveText('Łącznie: 3 zamówienia · netto 60,40 zł · prowizja 12,08 zł')
    await expect(katalog.getByTestId('partner-balance')).toContainText('Wypłacono: 5,00 zł · Do wypłaty: 7,08 zł')
    await expect(katalog.getByTestId('partner-balance')).toContainText('poniżej progu wypłaty 50,00 zł')
    await expectNoHorizontalScroll(page)

    // the form has the approved defaults
    await expect(page.getByLabel('Rabat dla klientów (%)')).toHaveValue('10')
    await expect(page.getByLabel('Prowizja (%)')).toHaveValue('20')
    await expect(page.getByLabel('Okres prowizji (miesiące)')).toHaveValue('12')

    // everything wrong at once – nothing is sent
    await page.getByLabel('Nazwa partnera').fill('A')
    await page.getByLabel('E-mail kontaktowy').fill('partner@')
    await page.getByLabel('NIP (opcjonalnie)').fill('5260001245')
    await page.getByLabel('Prowizja (%)').fill('60')
    await page.getByLabel('Okres prowizji (miesiące)').fill('0')
    await page.getByLabel('Kod rabatowy (opcjonalnie)').fill('zniżka')
    await page.getByRole('button', { name: 'Dodaj partnera' }).click()
    await expect(page.getByText('Nazwa partnera musi mieć od 2 do 100 znaków')).toBeVisible()
    await expect(page.getByText('Podaj poprawny adres e-mail partnera')).toBeVisible()
    await expect(page.getByText('NIP musi mieć 10 cyfr z poprawną cyfrą kontrolną')).toBeVisible()
    await expect(page.getByText('Prowizja musi być liczbą całkowitą od 1 do 50')).toBeVisible()
    await expect(page.getByText('Okres prowizji musi być liczbą całkowitą od 1 do 60 miesięcy')).toBeVisible()
    await expect(page.getByText('Kod może mieć 3–30 znaków: litery A–Z (bez polskich znaków), cyfry i myślnik')).toBeVisible()
    await expect(page.getByLabel('NIP (opcjonalnie)')).toHaveAttribute('aria-invalid', 'true')
    expect(requests.filter((r) => r.url === '/admin/partners' && r.method === 'POST')).toHaveLength(0)

    // a duplicate code is refused by the API and explained next to the form
    await page.getByLabel('Nazwa partnera').fill('Blog Sprzedawcy')
    await page.getByLabel('E-mail kontaktowy').fill('blog@example.com')
    await page.getByLabel('NIP (opcjonalnie)').fill('526-000-12-46')
    await page.getByLabel('Prowizja (%)').fill('20')
    await page.getByLabel('Okres prowizji (miesiące)').fill('12')
    await page.getByLabel('Kod rabatowy (opcjonalnie)').fill('katalog-10')
    await page.getByRole('button', { name: 'Dodaj partnera' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Taki kod już istnieje – wybierz inny' })).toBeVisible()

    await page.getByLabel('Kod rabatowy (opcjonalnie)').fill('blog-10')
    await expect(page.getByLabel('Kod rabatowy (opcjonalnie)')).toHaveValue('BLOG-10')
    await page.getByLabel('Limit użyć kodu (opcjonalnie)').fill('200')
    await page.getByRole('button', { name: 'Dodaj partnera' }).click()
    await expect(page.getByText('Dodano partnera Blog Sprzedawcy')).toBeVisible()
    const sent = requests.filter((r) => r.url === '/admin/partners' && r.method === 'POST').at(-1)?.body
    expect(sent).toEqual({
      name: 'Blog Sprzedawcy',
      contactEmail: 'blog@example.com',
      nip: '5260001246',
      customerDiscountPercent: 10,
      commissionPercent: 20,
      commissionMonths: 12,
      active: true,
      code: 'BLOG-10',
      codeMaxRedemptions: 200,
    })
    const blog = list.getByTestId('partner-row').filter({ hasText: 'Blog Sprzedawcy' })
    await expect(blog).toContainText('Kody: BLOG-10 · Klienci: 0')
    await expect(blog.getByTestId('partner-balance')).toContainText('Do wypłaty: 0,00 zł')
    await expect(page.getByLabel('Nazwa partnera')).toHaveValue('')

    // the discount code list shows the partner of a code
    await page.getByRole('tab', { name: 'Kody rabatowe' }).click()
    await expect(page.getByTestId('discount-code-row').filter({ hasText: 'BLOG-10' })).toContainText('Partner: Blog Sprzedawcy')
    await expect(page.getByTestId('discount-code-row').filter({ hasText: 'SMARTNET20' })).not.toContainText('Partner:')
  })

  test('[AC-PRT-015] statement with masked customers, linking an existing code and a payout below 50 zł', async ({ page }) => {
    const { requests } = await mockApp(page, { isAdmin: true })
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Partnerzy' }).click()
    await page.getByRole('button', { name: 'Szczegóły partnera Katalog Firm' }).click()

    await expect(page.getByRole('heading', { name: 'Katalog Firm', level: 2 })).toBeVisible()
    await expect(page.getByText('Katalog Firm sp. z o.o. · NIP 5260001246 · partner@example.com · klienci: 3')).toBeVisible()
    const tiles = page.getByTestId('partner-tiles')
    await expect(tiles).toContainText('Ten miesiąc – prowizja7,04 zł2 zamówienia')
    await expect(tiles).toContainText('Do wypłaty7,08 zł')

    // monthly statement, newest month first; customers only as K-… hashes
    const months = page.getByTestId('statement-month')
    await expect(months).toHaveCount(2)
    await expect(months.nth(0).getByRole('heading')).toHaveText('październik 2026')
    await expect(months.nth(0)).toContainText('2 zamówienia · netto 35,20 zł · prowizja 7,04 zł')
    await expect(months.nth(1).getByRole('heading')).toHaveText('wrzesień 2026')
    const correction = months.nth(1).getByTestId('statement-entry').first()
    await expect(correction).toContainText('korekta')
    await expect(correction).toContainText('K-5e5e5e5e')
    await expect(correction).toContainText('netto −2,80 zł')
    await expect(correction).toContainText('prowizja −0,56 zł (20%)')
    await expect(months.nth(0).getByTestId('statement-entry').first()).toContainText('zamówienie')
    await expect(months.nth(0)).toContainText('Abonament')
    const statementText = await page.getByRole('region', { name: 'Zestawienie miesięczne' }).innerText()
    expect(statementText).not.toMatch(/@/)
    await expectNoHorizontalScroll(page)

    // link an existing code (typed in lower case)
    await page.getByLabel('Podłącz istniejący kod').fill('smartnet20')
    await expect(page.getByLabel('Podłącz istniejący kod')).toHaveValue('SMARTNET20')
    await page.getByRole('button', { name: 'Podłącz', exact: true }).click()
    await expect(page.getByText('Podłączono kod SMARTNET20')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Kody partnera' })).toContainText('SMARTNET20')
    expect(requests.find((r) => r.url === '/admin/partners/p-1/codes/link')?.body).toEqual({ code: 'SMARTNET20' })
    // an unknown code is explained
    await page.getByLabel('Podłącz istniejący kod').fill('NIE-MA')
    await page.getByRole('button', { name: 'Podłącz', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Nie znaleziono kodu rabatowego' })).toBeVisible()

    // payout: errors first, then a warning below the 50 zł threshold (still allowed)
    const payout = page.getByRole('region', { name: 'Oznacz wypłatę' })
    await payout.getByRole('button', { name: 'Oznacz wypłatę' }).click()
    await expect(payout.getByText('Kwota wypłaty musi być liczbą w zł z najwyżej 2 miejscami po przecinku')).toBeVisible()
    await expect(payout.getByText('Podaj numer faktury partnera albo notatkę')).toBeVisible()
    expect(requests.some((r) => r.url === '/admin/partners/p-1/payouts')).toBe(false)

    await payout.getByLabel('Kwota (zł)').fill('7,08')
    await expect(payout.getByRole('status').filter({ hasText: 'Kwota jest poniżej progu wypłaty 50,00 zł.' })).toBeVisible()
    await payout.getByLabel('Numer faktury lub notatka').fill('FV 2/10/2026')
    await payout.getByRole('button', { name: 'Oznacz wypłatę' }).click()
    await expect(page.getByText('Zapisano wypłatę 7,08 zł')).toBeVisible()
    await expect(payout.getByRole('status').filter({ hasText: 'Zapisano z ostrzeżeniem: Kwota jest poniżej progu wypłaty 50,00 zł.' })).toBeVisible()
    const sent = requests.find((r) => r.url === '/admin/partners/p-1/payouts')?.body
    expect(sent).toMatchObject({ amountPln: 7.08, reference: 'FV 2/10/2026' })
    expect(sent.paidOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    await expect(tiles).toContainText('Do wypłaty0,00 zł')
    await expect(tiles).toContainText('Wypłacono12,08 zł')
    await expect(payout.getByTestId('payout-row')).toHaveCount(2)
    await expect(payout.getByTestId('payout-row').first()).toContainText('7,08 zł')
    await expectNoHorizontalScroll(page)

    // back to the list with the new balance
    await page.getByRole('button', { name: 'Wszyscy partnerzy' }).click()
    await expect(page.getByTestId('partner-row').filter({ hasText: 'Katalog Firm' }).getByTestId('partner-balance')).toContainText('Do wypłaty: 0,00 zł')
  })

  test('[AC-PRT-015] editing rates and deactivating a partner sends only the form fields', async ({ page }) => {
    const { requests } = await mockApp(page, { isAdmin: true })
    await page.goto('/admin')
    await page.getByRole('tab', { name: 'Partnerzy' }).click()
    await page.getByRole('button', { name: 'Szczegóły partnera Katalog Firm' }).click()

    const edit = page.getByRole('region', { name: 'Dane i stawki' })
    await expect(edit.getByLabel('Nazwa partnera')).toHaveValue('Katalog Firm')
    await expect(edit.getByLabel('Kod rabatowy (opcjonalnie)')).toHaveCount(0)
    await edit.getByLabel('Prowizja (%)').fill('51')
    await edit.getByRole('button', { name: 'Zapisz zmiany' }).click()
    await expect(edit.getByText('Prowizja musi być liczbą całkowitą od 1 do 50')).toBeVisible()
    await edit.getByLabel('Prowizja (%)').fill('25')
    await edit.getByLabel('Firma (opcjonalnie)').fill('')
    await edit.getByLabel('Partner aktywny').uncheck()
    await edit.getByRole('button', { name: 'Zapisz zmiany' }).click()
    await expect(page.getByText('Zapisano zmiany partnera')).toBeVisible()
    const sent = requests.find((r) => r.url === '/admin/partners/p-1' && r.method === 'PATCH')?.body
    expect(sent).toEqual({
      name: 'Katalog Firm',
      contactEmail: 'partner@example.com',
      companyName: null,
      nip: '5260001246',
      note: null,
      customerDiscountPercent: 10,
      commissionPercent: 25,
      commissionMonths: 12,
      active: false,
    })
    await page.getByRole('button', { name: 'Wszyscy partnerzy' }).click()
    const row = page.getByTestId('partner-row').filter({ hasText: 'Katalog Firm' })
    await expect(row).toContainText('nieaktywny')
    await expect(row).toContainText('25% prowizji')
  })
})
