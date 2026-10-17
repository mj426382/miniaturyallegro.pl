import { countLabel } from './plural'

/**
 * Spec 11 §5a, AC-UI-014: the ONE place that maps the API's upload-limit errors to what the user sees.
 * Change the codes or fallback texts here – Upload, BulkUpload and UploadLimitAlert only use this module.
 *
 * API contract (backend, spec 04):
 *   403 { code: 'UPLOAD_LIMIT_UNVERIFIED', limit: 5, message }                         – e-mail not confirmed yet
 *   429 { code: 'UPLOAD_LIMIT_DAILY', limit: 200, retryAfterSeconds, message } + Retry-After – 24 h cap
 * The backend `message` is shown when present; the texts below are the fallback.
 */
export const UPLOAD_LIMIT_CODES = {
  unverified: 'UPLOAD_LIMIT_UNVERIFIED',
  daily: 'UPLOAD_LIMIT_DAILY',
} as const

/** Used when the response does not say the limit itself. */
export const UPLOAD_LIMIT_DEFAULTS = { unverified: 5, daily: 200 } as const

export type UploadLimitKind = keyof typeof UPLOAD_LIMIT_CODES

export interface UploadLimitError {
  kind: UploadLimitKind
  title: string
  /** The backend's message, or our fallback. */
  message: string
  /** Short text for the file row in bulk upload. */
  fileNote: string
  /** When uploading is possible again (daily cap) – null when the API did not say. */
  retryAt: Date | null
  /** „Kolejne zdjęcia prześlesz dziś o 14:30.” / „Spróbuj ponownie później.” – daily cap only. */
  retryHint: string | null
}

const photos = (n: number) => countLabel(n, 'zdjęcie', 'zdjęcia', 'zdjęć')

const positive = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null
}

const text = (value: unknown): string | null => {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string').join('. ') || null
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Moment from `retryAfterSeconds` (body) or the Retry-After header (seconds or HTTP date). */
export function retryMoment(body: any, headers: Record<string, unknown> | undefined, now: Date): Date | null {
  const seconds = positive(body?.retryAfterSeconds)
  if (seconds) return new Date(now.getTime() + seconds * 1000)
  const header = headers?.['retry-after']
  if (typeof header === 'string' || typeof header === 'number') {
    const asSeconds = positive(header)
    if (asSeconds) return new Date(now.getTime() + asSeconds * 1000)
    const at = new Date(String(header))
    if (!Number.isNaN(at.getTime()) && at.getTime() > now.getTime()) return at
  }
  return null
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** „dziś o 14:30”, „jutro o 9:05” or „20.10 o 14:30” in the user's time zone. */
export function formatRetryAt(at: Date, now: Date): string {
  const time = at.toLocaleTimeString('pl-PL', { hour: 'numeric', minute: '2-digit' })
  if (sameDay(at, now)) return `dziś o ${time}`
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (sameDay(at, tomorrow)) return `jutro o ${time}`
  return `${at.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} o ${time}`
}

/** The upload-limit error behind a failed `imagesApi.upload`, or null for any other error. */
export function uploadLimitError(err: any, now: Date = new Date()): UploadLimitError | null {
  const body = err?.response?.data
  const code = body?.code
  if (code === UPLOAD_LIMIT_CODES.unverified) {
    const limit = positive(body?.limit) ?? UPLOAD_LIMIT_DEFAULTS.unverified
    return {
      kind: 'unverified',
      title: 'Potwierdź adres e-mail, aby przesłać więcej zdjęć',
      message:
        text(body?.message) ??
        `Przed potwierdzeniem adresu e-mail możesz przesłać najwyżej ${photos(limit)}. Kliknij link, który wysłaliśmy na Twój adres – potem prześlesz do ${photos(UPLOAD_LIMIT_DEFAULTS.daily)} na dobę.`,
      fileNote: 'nie przesłano – potwierdź adres e-mail',
      retryAt: null,
      retryHint: null,
    }
  }
  if (code === UPLOAD_LIMIT_CODES.daily) {
    const limit = positive(body?.limit) ?? UPLOAD_LIMIT_DEFAULTS.daily
    const retryAt = retryMoment(body, err?.response?.headers, now)
    return {
      kind: 'daily',
      title: `Wykorzystano dzienny limit ${photos(limit)}`,
      message: text(body?.message) ?? 'Limit liczy zdjęcia przesłane w ciągu ostatnich 24 godzin.',
      fileNote: 'nie przesłano – dzienny limit',
      retryAt,
      retryHint: retryAt ? `Kolejne zdjęcia prześlesz ${formatRetryAt(retryAt, now)}.` : 'Spróbuj ponownie później.',
    }
  }
  return null
}
