import { describe, expect, it } from 'vitest'
import { formatRetryAt, retryMoment, UPLOAD_LIMIT_CODES, uploadLimitError } from './uploadLimits'

/** Spec 11 §5a, AC-UI-014: one module maps the API's upload-limit codes to copy with the next step. */
const NOW = new Date(2026, 9, 18, 10, 0, 0) // 18.10.2026 10:00 local time
const axiosError = (status: number, data: unknown, headers: Record<string, string> = {}) => ({ response: { status, data, headers } })

const BACKEND_UNVERIFIED =
  'Przed potwierdzeniem adresu e-mail możesz przesłać najwyżej 5 zdjęć. Kliknij link z wiadomości, którą wysłaliśmy po rejestracji (możesz wysłać go ponownie z banera u góry strony), a potem prześlesz kolejne.'
const BACKEND_DAILY = 'Osiągnięto dzienny limit 200 przesłanych zdjęć. Kolejne prześlesz za około 3 godziny.'

describe('[AC-UI-014] uploadLimitError', () => {
  it('[AC-UI-014] the codes are the ones the API sends', () => {
    expect(UPLOAD_LIMIT_CODES).toEqual({ unverified: 'UPLOAD_LIMIT_UNVERIFIED', daily: 'UPLOAD_LIMIT_DAILY' })
  })

  it('[AC-UI-014] UPLOAD_LIMIT_UNVERIFIED shows the API message (fallback with the limit) and no retry time', () => {
    expect(uploadLimitError(axiosError(403, { statusCode: 403, code: 'UPLOAD_LIMIT_UNVERIFIED', limit: 5, message: BACKEND_UNVERIFIED }), NOW)).toEqual({
      kind: 'unverified',
      title: 'Potwierdź adres e-mail, aby przesłać więcej zdjęć',
      message: BACKEND_UNVERIFIED,
      fileNote: 'nie przesłano – potwierdź adres e-mail',
      retryAt: null,
      retryHint: null,
    })
    expect(uploadLimitError(axiosError(403, { code: 'UPLOAD_LIMIT_UNVERIFIED', limit: 3 }), NOW)!.message).toBe(
      'Przed potwierdzeniem adresu e-mail możesz przesłać najwyżej 3 zdjęcia. Kliknij link, który wysłaliśmy na Twój adres – potem prześlesz do 200 zdjęć na dobę.',
    )
  })

  it('[AC-UI-014] UPLOAD_LIMIT_DAILY shows the API message and the local time from retryAfterSeconds', () => {
    const error = uploadLimitError(axiosError(429, { code: 'UPLOAD_LIMIT_DAILY', limit: 200, retryAfterSeconds: 4.5 * 3600, message: BACKEND_DAILY }, { 'retry-after': '16200' }), NOW)!
    expect(error.kind).toBe('daily')
    expect(error.title).toBe('Wykorzystano dzienny limit 200 zdjęć')
    expect(error.message).toBe(BACKEND_DAILY)
    expect(error.fileNote).toBe('nie przesłano – dzienny limit')
    expect(error.retryHint).toBe('Kolejne zdjęcia prześlesz dziś o 14:30.')
    expect(error.retryAt).toEqual(new Date(2026, 9, 18, 14, 30))
  })

  it('[AC-UI-014] falls back to the Retry-After header, then to „try again later”, and to our own message', () => {
    expect(uploadLimitError(axiosError(429, { code: 'UPLOAD_LIMIT_DAILY' }, { 'retry-after': '86400' }), NOW)!.retryHint).toBe('Kolejne zdjęcia prześlesz jutro o 10:00.')
    const fallback = uploadLimitError(axiosError(429, { code: 'UPLOAD_LIMIT_DAILY' }), NOW)!
    expect(fallback.retryAt).toBeNull()
    expect(fallback.retryHint).toBe('Spróbuj ponownie później.')
    expect(fallback.message).toBe('Limit liczy zdjęcia przesłane w ciągu ostatnich 24 godzin.')
  })

  it('[AC-UI-014] ignores every other error (plain 429 throttling, 403 e-mail gate, 400, network)', () => {
    expect(uploadLimitError(axiosError(429, { statusCode: 429, message: 'ThrottlerException: Too Many Requests' }), NOW)).toBeNull()
    expect(uploadLimitError(axiosError(403, { code: 'EMAIL_NOT_VERIFIED' }), NOW)).toBeNull()
    expect(uploadLimitError(axiosError(400, { message: 'Nieprawidłowy plik' }), NOW)).toBeNull()
    expect(uploadLimitError(new Error('Network Error'), NOW)).toBeNull()
    expect(uploadLimitError(undefined, NOW)).toBeNull()
  })
})

describe('[AC-UI-014] retry time', () => {
  it('[AC-UI-014] formats today, tomorrow and later dates in Polish', () => {
    expect(formatRetryAt(new Date(2026, 9, 18, 9, 5), NOW)).toBe('dziś o 9:05')
    expect(formatRetryAt(new Date(2026, 9, 19, 9, 5), NOW)).toBe('jutro o 9:05')
    expect(formatRetryAt(new Date(2026, 9, 21, 18, 45), NOW)).toBe('21.10 o 18:45')
  })

  it('[AC-UI-014] ignores invalid values and past dates', () => {
    expect(retryMoment({ retryAfterSeconds: -5 }, { 'retry-after': 'abc' }, NOW)).toBeNull()
    expect(retryMoment({ retryAfterSeconds: 'x' }, { 'retry-after': new Date(2026, 9, 17).toUTCString() }, NOW)).toBeNull()
    expect(retryMoment({}, { 'retry-after': new Date(2026, 9, 18, 12).toUTCString() }, NOW)?.getHours()).toBe(12)
  })
})
