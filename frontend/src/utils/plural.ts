/**
 * Polish plural form for a count (spec 17, AC-UX-001):
 * 1 → `one` (zdjęcie), 2–4 / 22–24 / … → `few` (zdjęcia), 0, 5–21, 12–14, 25–31 … → `many` (zdjęć).
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n)
  if (abs === 1) return one
  const lastDigit = abs % 10
  const lastTwo = abs % 100
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return few
  return many
}

/** `plural` with the number in front: countLabel(3, 'zdjęcie', 'zdjęcia', 'zdjęć') → "3 zdjęcia". */
export function countLabel(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`
}
