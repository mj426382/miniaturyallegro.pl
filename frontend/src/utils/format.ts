/** Amount in grosze → "12,50 zł". */
export const formatZl = (grosze: number) => `${(grosze / 100).toFixed(2).replace('.', ',')} zł`

/** ISO date → short Polish date and time, or "–". */
export const formatDateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }) : '–')
