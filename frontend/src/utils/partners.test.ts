import { describe, expect, it } from 'vitest'
import {
  EMPTY_PARTNER_FORM,
  formatSignedZl,
  isValidNip,
  monthLabel,
  normalizeNip,
  parseZlToGrosze,
  partnerToForm,
  payoutWarnings,
  todayInPoland,
  validatePartnerForm,
  validatePayoutForm,
  type PartnerForm,
} from './partners'

const NOW = new Date('2026-10-19T12:00:00')
const form = (patch: Partial<PartnerForm>): PartnerForm => ({ ...EMPTY_PARTNER_FORM, name: 'Katalog Firm', contactEmail: 'partner@example.com', ...patch })

describe('partner form', () => {
  it('[AC-PRT-016] a new partner has the approved defaults and a minimal payload', () => {
    expect(EMPTY_PARTNER_FORM).toMatchObject({ customerDiscountPercent: '10', commissionPercent: '20', commissionMonths: '12', active: true })
    const { errors, input } = validatePartnerForm(form({ name: '  Katalog Firm ', contactEmail: ' Partner@Example.com ' }), { now: NOW })
    expect(errors).toEqual({})
    expect(input).toEqual({ name: 'Katalog Firm', contactEmail: 'partner@example.com', customerDiscountPercent: 10, commissionPercent: 20, commissionMonths: 12, active: true })
  })

  it('[AC-PRT-016] builds the payload with company, NIP (normalised), note and a code with limit and expiry', () => {
    const { errors, input } = validatePartnerForm(
      form({ companyName: ' Przykład sp. z o.o. ', nip: 'PL 526-000-12-46', note: ' Umowa ', code: ' katalog-10 ', codeMaxRedemptions: '300', codeExpiresOn: '2027-01-31' }),
      { now: NOW },
    )
    expect(errors).toEqual({})
    expect(input).toMatchObject({
      companyName: 'Przykład sp. z o.o.',
      nip: '5260001246',
      note: 'Umowa',
      code: 'KATALOG-10',
      codeMaxRedemptions: 300,
      codeExpiresAt: new Date('2027-01-31T23:59:59').toISOString(),
    })
  })

  const cases: Array<[string, Partial<PartnerForm>, keyof PartnerForm, RegExp]> = [
    ['an empty name', { name: ' ' }, 'name', /od 2 do 100 znaków/],
    ['a too long name', { name: 'A'.repeat(101) }, 'name', /od 2 do 100 znaków/],
    ['a bad e-mail', { contactEmail: 'partner@' }, 'contactEmail', /poprawny adres e-mail/],
    ['a NIP with a wrong check digit', { nip: '5260001245' }, 'nip', /cyfrą kontrolną/],
    ['a 9-digit NIP', { nip: '526000124' }, 'nip', /10 cyfr/],
    ['a too long company', { companyName: 'F'.repeat(201) }, 'companyName', /200 znaków/],
    ['a discount of 0', { customerDiscountPercent: '0' }, 'customerDiscountPercent', /od 1 do 100/],
    ['a fractional discount', { customerDiscountPercent: '10,5' }, 'customerDiscountPercent', /od 1 do 100/],
    ['a commission of 51', { commissionPercent: '51' }, 'commissionPercent', /od 1 do 50/],
    ['an empty commission', { commissionPercent: '' }, 'commissionPercent', /od 1 do 50/],
    ['a period of 61 months', { commissionMonths: '61' }, 'commissionMonths', /od 1 do 60 miesięcy/],
    ['a too long note', { note: 'n'.repeat(501) }, 'note', /500 znaków/],
    ['Polish letters in the code', { code: 'ZNIŻKA' }, 'code', /bez polskich znaków/],
    ['a limit without a code', { codeMaxRedemptions: '10' }, 'code', /Podaj kod/],
    ['a code limit of 0', { code: 'KOD-1', codeMaxRedemptions: '0' }, 'codeMaxRedemptions', /co najmniej 1/],
    ['a fractional code limit', { code: 'KOD-1', codeMaxRedemptions: '1.5' }, 'codeMaxRedemptions', /liczbą całkowitą/],
    ['a past expiry', { code: 'KOD-1', codeExpiresOn: '2026-01-01' }, 'codeExpiresOn', /w przyszłości/],
  ]
  it.each(cases)('[AC-PRT-016] %s is refused with a Polish message', (_, patch, field, message) => {
    const { errors, input } = validatePartnerForm(form(patch), { now: NOW })
    expect(input).toBeNull()
    expect(errors[field]).toMatch(message)
  })

  it('[AC-PRT-016] editing ignores the code fields and clears emptied optional fields', () => {
    const edit = partnerToForm({
      name: 'Katalog',
      contactEmail: 'p@example.com',
      companyName: 'Firma',
      nip: '5260001246',
      customerDiscountPercent: 15,
      commissionPercent: 25,
      commissionMonths: 6,
      active: false,
      note: 'n',
    })
    expect(edit).toMatchObject({ companyName: 'Firma', nip: '5260001246', customerDiscountPercent: '15', commissionPercent: '25', commissionMonths: '6', active: false, code: '' })
    const { input } = validatePartnerForm({ ...edit, companyName: '', nip: ' ', note: '', code: 'ZNIŻKA' }, { mode: 'edit', now: NOW })
    expect(input).toEqual({
      name: 'Katalog',
      contactEmail: 'p@example.com',
      companyName: null,
      nip: null,
      note: null,
      customerDiscountPercent: 15,
      commissionPercent: 25,
      commissionMonths: 6,
      active: false,
    })
  })

  it('[AC-PRT-016] NIP rules are the same as in the API', () => {
    expect(isValidNip('5260001246')).toBe(true)
    expect(isValidNip('526-000-12-46')).toBe(true)
    expect(isValidNip('PL5260001246')).toBe(true)
    expect(isValidNip('1111111111')).toBe(true) // the check digit works out
    expect(isValidNip('5260001245')).toBe(false)
    expect(isValidNip('')).toBe(false)
    expect(normalizeNip(' pl 526 000 12 46 ')).toBe('5260001246')
  })
})

describe('payout form', () => {
  it('[AC-PRT-016] accepts złoty with a comma or a dot, today or a past date and trims the reference', () => {
    expect(validatePayoutForm({ amount: '57,42', paidOn: '2026-10-19', reference: ' FV 1/10/2026 ' }, NOW)).toEqual({
      errors: {},
      input: { amountPln: 57.42, paidOn: '2026-10-19', reference: 'FV 1/10/2026' },
    })
    expect(validatePayoutForm({ amount: '50', paidOn: '2026-09-30', reference: 'x' }, NOW).input?.amountPln).toBe(50)
    expect(validatePayoutForm({ amount: '7.4', paidOn: '2026-09-30', reference: 'x' }, NOW).input?.amountPln).toBe(7.4)
  })

  it.each([
    ['0', '2026-10-01', 'FV', 'amount', /większa od 0/],
    ['-5', '2026-10-01', 'FV', 'amount', /najwyżej 2 miejscami/],
    ['10,001', '2026-10-01', 'FV', 'amount', /najwyżej 2 miejscami/],
    ['dziesięć', '2026-10-01', 'FV', 'amount', /liczbą w zł/],
    ['100000,01', '2026-10-01', 'FV', 'amount', /100 000 zł/],
    ['10', '2026-10-20', 'FV', 'paidOn', /z przyszłości/],
    ['10', '2026-02-30', 'FV', 'paidOn', /prawidłową datę/],
    ['10', '', 'FV', 'paidOn', /prawidłową datę/],
    ['10', '2026-10-01', '  ', 'reference', /numer faktury/],
    ['10', '2026-10-01', 'x'.repeat(201), 'reference', /200 znaków/],
  ] as const)('[AC-PRT-016] amount %s, date %s, reference %s → error on %s', (amount, paidOn, reference, field, message) => {
    const { errors, input } = validatePayoutForm({ amount, paidOn, reference }, NOW)
    expect(input).toBeNull()
    expect(errors[field]).toMatch(message)
  })

  it('[AC-PRT-016] warns below the 50 zł threshold and above the balance with the same text as the API', () => {
    expect(payoutWarnings(5000, 5742)).toEqual([])
    expect(payoutWarnings(742, 742)).toEqual(['Kwota jest poniżej progu wypłaty 50,00 zł.'])
    expect(payoutWarnings(6000, 0)).toEqual(['Wypłata jest wyższa niż saldo do wypłaty (0,00 zł).'])
    expect(payoutWarnings(100, -500)).toEqual(['Kwota jest poniżej progu wypłaty 50,00 zł.', 'Wypłata jest wyższa niż saldo do wypłaty (−5,00 zł).'])
  })

  it('[AC-PRT-016] the live warning reads the amount alone', () => {
    expect(parseZlToGrosze('7,08')).toBe(708)
    expect(parseZlToGrosze(' 50.5 ')).toBe(5050)
    expect(parseZlToGrosze('0,10')).toBe(10)
    expect(parseZlToGrosze('0')).toBeNull()
    expect(parseZlToGrosze('1,234')).toBeNull()
    expect(parseZlToGrosze('')).toBeNull()
  })

  it('[AC-PRT-016] "today" is the Polish date (DST aware)', () => {
    expect(todayInPoland(new Date('2026-10-31T23:30:00.000Z'))).toBe('2026-11-01')
    expect(todayInPoland(new Date('2026-10-31T22:30:00.000Z'))).toBe('2026-10-31')
    expect(todayInPoland(new Date('2026-06-30T22:30:00.000Z'))).toBe('2026-07-01')
  })
})

describe('statement labels', () => {
  it('[AC-PRT-016] months and amounts are Polish', () => {
    expect(monthLabel('2026-10')).toBe('październik 2026')
    expect(monthLabel('2027-01')).toBe('styczeń 2027')
    expect(monthLabel('2026-13')).toBe('2026-13')
    expect(formatSignedZl(504)).toBe('5,04 zł')
    expect(formatSignedZl(-504)).toBe('−5,04 zł')
    expect(formatSignedZl(0)).toBe('0,00 zł')
  })
})
