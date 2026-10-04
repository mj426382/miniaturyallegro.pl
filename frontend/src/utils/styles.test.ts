import { describe, expect, it } from 'vitest'
import { groupStartsOpen, groupStyles, missingUniversalStyleIds } from './styles'
import type { GenerationStyleInfo } from '../services/api'

const style = (id: string, category?: GenerationStyleInfo['category'], inSeason = false): GenerationStyleInfo => ({
  id,
  name: id,
  description: '',
  starter: false,
  category,
  inSeason,
})

describe('missingUniversalStyleIds', () => {
  it('[AC-GEN-024] preselects only universal styles that were not generated yet', () => {
    const styles = [style('white-bg', 'universal'), style('gradient-bg', 'universal'), style('christmas', 'seasonal', true), style('fashion', 'industry'), style('legacy')]
    expect(missingUniversalStyleIds(styles, new Set(['white-bg']))).toEqual(['gradient-bg', 'legacy'])
  })
})

describe('groupStyles', () => {
  it('[AC-GEN-024] groups by category, keeps API order and puts in-season styles first', () => {
    const groups = groupStyles([
      style('white-bg', 'universal'),
      style('valentines', 'seasonal'),
      style('fashion', 'industry'),
      style('christmas', 'seasonal', true),
      style('legacy'), // older API without a category
      style('electronics', 'industry'),
    ])
    expect(groups.map((g) => g.label)).toEqual(['Uniwersalne', 'Sezonowe', 'Branżowe'])
    expect(groups[0].styles.map((s) => s.id)).toEqual(['white-bg', 'legacy'])
    expect(groups[1].styles.map((s) => s.id)).toEqual(['christmas', 'valentines'])
    expect(groups[1].hint).toContain('zdjęcie główne zostaw na białym tle')
    expect(groups[2].styles.map((s) => s.id)).toEqual(['fashion', 'electronics'])
  })

  it('[AC-GEN-024] drops empty groups and opens a group with a selected or in-season style', () => {
    const groups = groupStyles([style('white-bg', 'universal'), style('fashion', 'industry'), style('summer', 'seasonal')])
    const [universal, seasonal, industry] = groups
    expect(groupStartsOpen(universal, [])).toBe(true)
    expect(groupStartsOpen(seasonal, [])).toBe(false)
    expect(groupStartsOpen(industry, ['fashion'])).toBe(true)
    expect(groupStartsOpen({ ...seasonal, styles: [style('christmas', 'seasonal', true)] }, [])).toBe(true)
    expect(groupStyles([style('white-bg', 'universal')]).map((g) => g.id)).toEqual(['universal'])
  })
})
