import type { PartnerInput, PayoutInput } from '../services/api'
import { DISCOUNT_CODE_PATTERN, endOfDay, MAX_REDEMPTIONS } from './discountCodes'
import { formatZl } from './format'

/** Spec 24: the approved model (defaults of a new partner) and the payout hint. */
export const PARTNER_DEFAULTS = { customerDiscountPercent: 10, commissionPercent: 20, commissionMonths: 12 } as const
export const MIN_PAYOUT_GROSZE = 5000
export const MAX_PAYOUT_PLN = 100_000

export interface PartnerForm {
  name: string
  contactEmail: string
  companyName: string
  nip: string
  customerDiscountPercent: string
  commissionPercent: string
  commissionMonths: string
  active: boolean
  note: string
  /** Only when creating: the partner's first discount code. */
  code: string
  codeMaxRedemptions: string
  /** `YYYY-MM-DD`; the code works until the end of that day. */
  codeExpiresOn: string
}

export type PartnerErrors = Partial<Record<keyof PartnerForm, string>>

export const EMPTY_PARTNER_FORM: PartnerForm = {
  name: '',
  contactEmail: '',
  companyName: '',
  nip: '',
  customerDiscountPercent: String(PARTNER_DEFAULTS.customerDiscountPercent),
  commissionPercent: String(PARTNER_DEFAULTS.commissionPercent),
  commissionMonths: String(PARTNER_DEFAULTS.commissionMonths),
  active: true,
  note: '',
  code: '',
  codeMaxRedemptions: '',
  codeExpiresOn: '',
}

/** NIP without spaces, dashes and an optional "PL" prefix. */
export const normalizeNip = (raw: string) => raw.trim().replace(/^PL/i, '').replace(/[\s-]/g, '')

/** 10 digits with the official check digit (the same rule as the API, AC-PRT-002). */
export function isValidNip(raw: string): boolean {
  const nip = normalizeNip(raw)
  if (!/^\d{10}$/.test(nip)) return false
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const sum = weights.reduce((acc, w, i) => acc + w * Number(nip[i]), 0)
  const check = sum % 11
  return check !== 10 && check === Number(nip[9])
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function wholeNumber(value: string, min: number, max: number): number | null {
  const text = value.trim()
  if (!/^\d+$/.test(text)) return null
  const n = Number(text)
  return n >= min && n <= max ? n : null
}

/**
 * Validates the partner form (AC-PRT-016) and builds the API payload (null while there are errors). When editing
 * (`mode: 'edit'`) the code fields are ignored and emptied optional fields are sent as null so they are cleared.
 */
export function validatePartnerForm(form: PartnerForm, options: { mode?: 'create' | 'edit'; now?: Date } = {}): { errors: PartnerErrors; input: PartnerInput | null } {
  const mode = options.mode ?? 'create'
  const now = options.now ?? new Date()
  const errors: PartnerErrors = {}
  const name = form.name.trim()
  const email = form.contactEmail.trim().toLowerCase()
  const input: PartnerInput = { name, contactEmail: email }

  if (name.length < 2 || name.length > 100) errors.name = 'Nazwa partnera musi mieć od 2 do 100 znaków'
  if (!EMAIL.test(email) || email.length > 254) errors.contactEmail = 'Podaj poprawny adres e-mail partnera'

  const company = form.companyName.trim()
  if (company.length > 200) errors.companyName = 'Nazwa firmy może mieć maksymalnie 200 znaków'
  else if (company) input.companyName = company
  else if (mode === 'edit') input.companyName = null

  const nip = normalizeNip(form.nip)
  if (nip && !isValidNip(nip)) errors.nip = 'NIP musi mieć 10 cyfr z poprawną cyfrą kontrolną'
  else if (nip) input.nip = nip
  else if (mode === 'edit') input.nip = null

  const discount = wholeNumber(form.customerDiscountPercent, 1, 100)
  if (discount === null) errors.customerDiscountPercent = 'Rabat dla klientów musi być liczbą całkowitą od 1 do 100'
  else input.customerDiscountPercent = discount
  const commission = wholeNumber(form.commissionPercent, 1, 50)
  if (commission === null) errors.commissionPercent = 'Prowizja musi być liczbą całkowitą od 1 do 50'
  else input.commissionPercent = commission
  const months = wholeNumber(form.commissionMonths, 1, 60)
  if (months === null) errors.commissionMonths = 'Okres prowizji musi być liczbą całkowitą od 1 do 60 miesięcy'
  else input.commissionMonths = months
  input.active = form.active

  const note = form.note.trim()
  if (note.length > 500) errors.note = 'Notatka może mieć maksymalnie 500 znaków'
  else if (note) input.note = note
  else if (mode === 'edit') input.note = null

  if (mode === 'create') {
    const code = form.code.trim().toUpperCase()
    if (code) {
      if (!DISCOUNT_CODE_PATTERN.test(code)) errors.code = 'Kod może mieć 3–30 znaków: litery A–Z (bez polskich znaków), cyfry i myślnik'
      else input.code = code
      const limit = form.codeMaxRedemptions.trim()
      if (limit) {
        const max = wholeNumber(limit, 1, MAX_REDEMPTIONS)
        if (!/^\d+$/.test(limit)) errors.codeMaxRedemptions = 'Limit użyć musi być liczbą całkowitą'
        else if (max === null) errors.codeMaxRedemptions = Number(limit) < 1 ? 'Limit użyć musi wynosić co najmniej 1' : 'Limit użyć może wynosić najwyżej 1 000 000'
        else input.codeMaxRedemptions = max
      }
      if (form.codeExpiresOn) {
        const expires = endOfDay(form.codeExpiresOn)
        if (!expires) errors.codeExpiresOn = 'Nieprawidłowa data ważności'
        else if (expires.getTime() <= now.getTime()) errors.codeExpiresOn = 'Data ważności musi być w przyszłości'
        else input.codeExpiresAt = expires.toISOString()
      }
    } else if (form.codeMaxRedemptions.trim() || form.codeExpiresOn) {
      errors.code = 'Podaj kod, jeśli ustawiasz limit użyć lub datę ważności'
    }
  }

  return { errors, input: Object.keys(errors).length ? null : input }
}

/** A partner row → the edit form. */
export function partnerToForm(p: {
  name: string
  contactEmail: string
  companyName: string | null
  nip: string | null
  customerDiscountPercent: number
  commissionPercent: number
  commissionMonths: number
  active: boolean
  note: string | null
}): PartnerForm {
  return {
    ...EMPTY_PARTNER_FORM,
    name: p.name,
    contactEmail: p.contactEmail,
    companyName: p.companyName ?? '',
    nip: p.nip ?? '',
    customerDiscountPercent: String(p.customerDiscountPercent),
    commissionPercent: String(p.commissionPercent),
    commissionMonths: String(p.commissionMonths),
    active: p.active,
    note: p.note ?? '',
  }
}

/** Today's date in Poland as YYYY-MM-DD. */
export function todayInPoland(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export interface PayoutForm {
  amount: string
  paidOn: string
  reference: string
}
export type PayoutErrors = Partial<Record<keyof PayoutForm, string>>

const isCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** "57,42" or "57.4" → grosze; null for anything that is not a positive amount with at most 2 decimals. */
export function parseZlToGrosze(text: string): number | null {
  const value = text.trim()
  if (!/^\d+([.,]\d{1,2})?$/.test(value)) return null
  const grosze = Math.round(Number(value.replace(',', '.')) * 100)
  return grosze > 0 ? grosze : null
}

/** Validates "Oznacz wypłatę" (AC-PRT-012/016): złoty with a comma or a dot, a past or today's date, a reference. */
export function validatePayoutForm(form: PayoutForm, now: Date = new Date()): { errors: PayoutErrors; input: PayoutInput | null } {
  const errors: PayoutErrors = {}
  const amountText = form.amount.trim()
  const amount = Number(amountText.replace(',', '.'))
  if (!/^\d+([.,]\d{1,2})?$/.test(amountText)) errors.amount = 'Kwota wypłaty musi być liczbą w zł z najwyżej 2 miejscami po przecinku'
  else if (amount <= 0) errors.amount = 'Kwota wypłaty musi być większa od 0 zł'
  else if (amount > MAX_PAYOUT_PLN) errors.amount = 'Kwota wypłaty może wynosić najwyżej 100 000 zł'

  if (!isCalendarDate(form.paidOn)) errors.paidOn = 'Podaj prawidłową datę wypłaty'
  else if (form.paidOn > todayInPoland(now)) errors.paidOn = 'Data wypłaty nie może być z przyszłości'

  const reference = form.reference.trim()
  if (!reference) errors.reference = 'Podaj numer faktury partnera albo notatkę'
  else if (reference.length > 200) errors.reference = 'Numer faktury lub notatka może mieć maksymalnie 200 znaków'

  return { errors, input: Object.keys(errors).length ? null : { amountPln: Math.round(amount * 100) / 100, paidOn: form.paidOn, reference } }
}

/** Shown under the payout form before saving – the API returns the same warnings. */
export function payoutWarnings(amountGrosze: number, balanceGrosze: number, minGrosze = MIN_PAYOUT_GROSZE): string[] {
  const warnings: string[] = []
  if (amountGrosze < minGrosze) warnings.push(`Kwota jest poniżej progu wypłaty ${formatZl(minGrosze)}.`)
  if (amountGrosze > balanceGrosze) warnings.push(`Wypłata jest wyższa niż saldo do wypłaty (${formatSignedZl(balanceGrosze)}).`)
  return warnings
}

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień']

/** "2026-10" → "październik 2026". */
export function monthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return month
  return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`
}

/** Corrections are negative: "−5,04 zł"; positive amounts as formatZl. */
export function formatSignedZl(grosze: number): string {
  return grosze < 0 ? `−${formatZl(-grosze)}` : formatZl(grosze)
}

export const ENTRY_KIND_LABEL = { payment: 'zamówienie', adjustment: 'korekta' } as const
