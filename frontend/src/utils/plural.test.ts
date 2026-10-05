import { describe, expect, it } from 'vitest'
import { countLabel, plural } from './plural'

describe('[AC-UX-001] plural', () => {
  const zdjecie = (n: number) => countLabel(n, 'zdjęcie', 'zdjęcia', 'zdjęć')

  it('uses the singular only for exactly one', () => {
    expect(zdjecie(1)).toBe('1 zdjęcie')
  })

  it('uses the "few" form for 2–4 and 22–24 but not 12–14', () => {
    expect([2, 3, 4, 22, 23, 24, 102, 1004].map(zdjecie)).toEqual(['2 zdjęcia', '3 zdjęcia', '4 zdjęcia', '22 zdjęcia', '23 zdjęcia', '24 zdjęcia', '102 zdjęcia', '1004 zdjęcia'])
    expect([12, 13, 14, 112].map(zdjecie)).toEqual(['12 zdjęć', '13 zdjęć', '14 zdjęć', '112 zdjęć'])
  })

  it('uses the "many" form for 0, 5–21 and 25+', () => {
    expect([0, 5, 11, 21, 25, 100].map(zdjecie)).toEqual(['0 zdjęć', '5 zdjęć', '11 zdjęć', '21 zdjęć', '25 zdjęć', '100 zdjęć'])
  })

  it('returns only the word from plural()', () => {
    expect(plural(3, 'grafika', 'grafiki', 'grafik')).toBe('grafiki')
  })
})
