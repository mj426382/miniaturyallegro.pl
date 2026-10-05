/** Polish labels for the admin views (spec 16). Same wording as the feedback buttons. */
const REASON_LABELS: Record<string, string> = {
  'product-changed': 'Produkt wygląda inaczej niż w oryginale',
  artifacts: 'Błędy / artefakty na grafice',
  'wrong-style': 'Nie pasuje do wybranego stylu',
  composition: 'Zła kompozycja lub kadr',
  'text-or-logo': 'Dodany tekst, logo lub znak wodny',
  other: 'Inny powód',
}

/** ratingReason is stored as "reason" or "reason: comment". */
export function ratingReasonLabel(reason: string | null | undefined): string | null {
  if (!reason) return null
  const [key, ...comment] = reason.split(':')
  const label = REASON_LABELS[key.trim()] ?? key.trim()
  const rest = comment.join(':').trim()
  return rest ? `${label} – „${rest}”` : label
}

export const GENERATION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'oczekuje',
  PROCESSING: 'w toku',
  COMPLETED: 'gotowa',
  FAILED: 'nieudana',
}
