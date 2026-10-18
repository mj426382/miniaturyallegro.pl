import { describe, expect, it } from 'vitest'
import { discountLabel, DISCOUNT_STATUS_LABEL, EMPTY_DISCOUNT_FORM, endOfDay, usageLabel, validateDiscountCodeForm, type DiscountCodeForm } from './discountCodes'

const NOW = new Date('2026-10-18T12:00:00')
const form = (patch: Partial<DiscountCodeForm>): DiscountCodeForm => ({ ...EMPTY_DISCOUNT_FORM, code: 'PARTNER-10', value: '10', ...patch })

describe('discount code form', () => {
  it('[AC-ADM-020] builds the payload of a percent code with limit, expiry (end of the day) and note', () => {
    const { errors, input } = validateDiscountCodeForm(form({ code: '  katalog-10 ', maxRedemptions: '50', expiresOn: '2026-12-31', note: '  Katalog firm  ' }), NOW)
    expect(errors).toEqual({})
    expect(input).toEqual({
      code: 'KATALOG-10',
      type: 'percent',
      percentOff: 10,
      maxRedemptions: 50,
      expiresAt: new Date('2026-12-31T23:59:59').toISOString(),
      note: 'Katalog firm',
    })
  })

  it('[AC-ADM-020] accepts a fixed amount with a comma or a dot and leaves optional fields out', () => {
    expect(validateDiscountCodeForm(form({ type: 'amount', value: '12,50' }), NOW).input).toEqual({ code: 'PARTNER-10', type: 'amount', amountOffPln: 12.5 })
    expect(validateDiscountCodeForm(form({ type: 'amount', value: '7.05' }), NOW).input?.amountOffPln).toBe(7.05)
    expect(validateDiscountCodeForm(form({ type: 'amount', value: '15' }), NOW).input?.amountOffPln).toBe(15)
    expect(validateDiscountCodeForm(form({ value: '100' }), NOW).input?.percentOff).toBe(100)
  })

  const cases: Array<[string, Partial<DiscountCodeForm>, keyof DiscountCodeForm, RegExp]> = [
    ['an empty code', { code: '' }, 'code', /3–30 znaków/],
    ['a too short code', { code: 'AB' }, 'code', /3–30 znaków/],
    ['a too long code', { code: 'A'.repeat(31) }, 'code', /3–30 znaków/],
    ['Polish letters', { code: 'ZNIŻKA' }, 'code', /bez polskich znaków/],
    ['a space inside', { code: 'PARTNER 10' }, 'code', /3–30 znaków/],
    ['an empty percent', { value: '' }, 'value', /od 1 do 100/],
    ['0%', { value: '0' }, 'value', /od 1 do 100/],
    ['101%', { value: '101' }, 'value', /od 1 do 100/],
    ['a fractional percent', { value: '10,5' }, 'value', /od 1 do 100/],
    ['an empty amount', { type: 'amount', value: '' }, 'value', /najwyżej 2 miejscami/],
    ['0 zł', { type: 'amount', value: '0' }, 'value', /większa od 0/],
    ['a negative amount', { type: 'amount', value: '-5' }, 'value', /najwyżej 2 miejscami/],
    ['three decimals', { type: 'amount', value: '1,234' }, 'value', /najwyżej 2 miejscami/],
    ['an absurd amount', { type: 'amount', value: '10000,01' }, 'value', /10 000 zł/],
    ['a limit of 0', { maxRedemptions: '0' }, 'maxRedemptions', /co najmniej 1/],
    ['a fractional limit', { maxRedemptions: '2.5' }, 'maxRedemptions', /liczbą całkowitą/],
    ['a huge limit', { maxRedemptions: '1000001' }, 'maxRedemptions', /1 000 000/],
    ['a past date', { expiresOn: '2026-10-17' }, 'expiresOn', /w przyszłości/],
    ['an invalid date', { expiresOn: '2026-13-45' }, 'expiresOn', /Nieprawidłowa data/],
    ['a too long note', { note: 'x'.repeat(201) }, 'note', /200 znaków/],
  ]

  it.each(cases)('[AC-ADM-020] rejects %s before anything is sent', (_, patch, field, message) => {
    const { errors, input } = validateDiscountCodeForm(form(patch), NOW)
    expect(input).toBeNull()
    expect(errors[field]).toMatch(message)
  })

  it('[AC-ADM-020] today is still valid until the end of the day', () => {
    expect(validateDiscountCodeForm(form({ expiresOn: '2026-10-18' }), NOW).errors).toEqual({})
    expect(endOfDay('jutro')).toBeNull()
    expect(endOfDay('2026-12-31')?.getHours()).toBe(23)
  })
})

describe('discount code labels', () => {
  it('[AC-ADM-020] shows the discount, the status and the usage in Polish', () => {
    expect(discountLabel({ type: 'percent', percentOff: 10, amountOffGrosze: null })).toBe('−10%')
    expect(discountLabel({ type: 'amount', percentOff: null, amountOffGrosze: 1250 })).toBe('−12,50 zł')
    expect(DISCOUNT_STATUS_LABEL).toEqual({ active: 'aktywny', inactive: 'wyłączony', expired: 'wygasł', exhausted: 'wyczerpany' })
    expect(usageLabel({ timesRedeemed: 3, maxRedemptions: 50 })).toBe('3 / 50')
    expect(usageLabel({ timesRedeemed: 0, maxRedemptions: null })).toBe('0 / bez limitu')
    expect(usageLabel({ timesRedeemed: null, maxRedemptions: 5 })).toBe('? / 5')
  })
})
