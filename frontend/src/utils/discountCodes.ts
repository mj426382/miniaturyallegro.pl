import type { AdminDiscountCode, CreateDiscountCodeInput } from '../services/api'
import { formatZl } from './format'

/** Spec 16, AC-ADM-017: the same rules as the API, so the admin sees mistakes before anything reaches Stripe. */
export const DISCOUNT_CODE_PATTERN = /^[A-Z0-9-]{3,30}$/
export const MAX_AMOUNT_PLN = 10000
export const MAX_REDEMPTIONS = 1_000_000
export const MAX_NOTE_LENGTH = 200

export interface DiscountCodeForm {
  code: string
  type: 'percent' | 'amount'
  /** Percent or złoty as typed (a comma is accepted as the decimal separator). */
  value: string
  maxRedemptions: string
  /** `YYYY-MM-DD` from a date input; the code works until the end of that day. */
  expiresOn: string
  note: string
}

export type DiscountCodeErrors = Partial<Record<keyof DiscountCodeForm, string>>

export const EMPTY_DISCOUNT_FORM: DiscountCodeForm = { code: '', type: 'percent', value: '', maxRedemptions: '', expiresOn: '', note: '' }

export const normalizeDiscountCode = (raw: string) => raw.trim().toUpperCase()

/** End of the chosen day in the admin's time zone, or null for an invalid date. */
export function endOfDay(isoDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  const date = new Date(`${isoDate}T23:59:59`)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Validates the form and builds the API payload (null while there are errors). */
export function validateDiscountCodeForm(form: DiscountCodeForm, now: Date = new Date()): { errors: DiscountCodeErrors; input: CreateDiscountCodeInput | null } {
  const errors: DiscountCodeErrors = {}
  const input: CreateDiscountCodeInput = { code: normalizeDiscountCode(form.code), type: form.type }

  if (!DISCOUNT_CODE_PATTERN.test(input.code)) errors.code = 'Kod może mieć 3–30 znaków: litery A–Z (bez polskich znaków), cyfry i myślnik'

  const value = form.value.trim()
  if (form.type === 'percent') {
    const percent = Number(value)
    if (!/^\d+$/.test(value) || percent < 1 || percent > 100) errors.value = 'Rabat procentowy musi być liczbą całkowitą od 1 do 100'
    else input.percentOff = percent
  } else if (form.type === 'amount') {
    const amount = Number(value.replace(',', '.'))
    if (!/^\d+([.,]\d{1,2})?$/.test(value)) errors.value = 'Kwota rabatu musi być liczbą w zł z najwyżej 2 miejscami po przecinku'
    else if (amount <= 0) errors.value = 'Kwota rabatu musi być większa od 0 zł'
    else if (amount > MAX_AMOUNT_PLN) errors.value = 'Kwota rabatu może wynosić najwyżej 10 000 zł'
    else input.amountOffPln = amount
  } else {
    errors.type = 'Wybierz rodzaj rabatu: procentowy albo kwotowy'
  }

  const limit = form.maxRedemptions.trim()
  if (limit) {
    const max = Number(limit)
    if (!/^\d+$/.test(limit)) errors.maxRedemptions = 'Limit użyć musi być liczbą całkowitą'
    else if (max < 1) errors.maxRedemptions = 'Limit użyć musi wynosić co najmniej 1'
    else if (max > MAX_REDEMPTIONS) errors.maxRedemptions = 'Limit użyć może wynosić najwyżej 1 000 000'
    else input.maxRedemptions = max
  }

  if (form.expiresOn) {
    const expires = endOfDay(form.expiresOn)
    if (!expires) errors.expiresOn = 'Nieprawidłowa data ważności'
    else if (expires.getTime() <= now.getTime()) errors.expiresOn = 'Data ważności musi być w przyszłości'
    else input.expiresAt = expires.toISOString()
  }

  const note = form.note.trim()
  if (note.length > MAX_NOTE_LENGTH) errors.note = 'Notatka może mieć maksymalnie 200 znaków'
  else if (note) input.note = note

  return { errors, input: Object.keys(errors).length ? null : input }
}

/** "−10%" or "−12,50 zł". */
export const discountLabel = (code: Pick<AdminDiscountCode, 'type' | 'percentOff' | 'amountOffGrosze'>) =>
  code.type === 'percent' ? `−${code.percentOff}%` : `−${formatZl(code.amountOffGrosze ?? 0)}`

export const DISCOUNT_STATUS_LABEL: Record<AdminDiscountCode['status'], string> = {
  active: 'aktywny',
  inactive: 'wyłączony',
  expired: 'wygasł',
  exhausted: 'wyczerpany',
}

/** "3 / 50", "3 / bez limitu"; "?" when Stripe did not answer. */
export const usageLabel = (code: Pick<AdminDiscountCode, 'timesRedeemed' | 'maxRedemptions'>) => `${code.timesRedeemed ?? '?'} / ${code.maxRedemptions ?? 'bez limitu'}`
