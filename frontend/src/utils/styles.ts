import type { GenerationStyleInfo, StyleCategory } from '../services/api'

export interface StyleGroup {
  id: StyleCategory
  label: string
  hint?: string
  styles: GenerationStyleInfo[]
}

const GROUPS: Array<Omit<StyleGroup, 'styles'>> = [
  { id: 'universal', label: 'Uniwersalne' },
  { id: 'seasonal', label: 'Sezonowe', hint: 'Na zdjęcia dodatkowe i kampanie – zdjęcie główne zostaw na białym tle.' },
  { id: 'industry', label: 'Branżowe' },
]

/**
 * Spec 05: styles grouped as Uniwersalne / Sezonowe / Branżowe, API order kept inside a group,
 * except that seasonal styles in their season come first. Empty groups are dropped.
 */
export function groupStyles(styles: GenerationStyleInfo[]): StyleGroup[] {
  return GROUPS.map((group) => {
    const members = styles.filter((s) => (s.category ?? 'universal') === group.id)
    const ordered = group.id === 'seasonal' ? [...members.filter((s) => s.inSeason), ...members.filter((s) => !s.inSeason)] : members
    return { ...group, styles: ordered }
  }).filter((group) => group.styles.length > 0)
}

/**
 * Styles offered after a batch (or when returning to a photo): the universal ones not generated yet.
 * Seasonal and industry styles are always an explicit choice – preselecting all 13 would make the
 * default batch needlessly expensive.
 */
export function missingUniversalStyleIds(styles: GenerationStyleInfo[], generated: Set<string>): string[] {
  return styles.filter((s) => (s.category ?? 'universal') === 'universal' && !generated.has(s.id)).map((s) => s.id)
}

/** A collapsible group starts open when it holds a selected style or (seasonal) a style in season. */
export function groupStartsOpen(group: StyleGroup, selected: string[]): boolean {
  if (group.id === 'universal') return true
  return group.styles.some((s) => selected.includes(s.id) || (group.id === 'seasonal' && s.inSeason))
}
