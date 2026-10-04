import { describe, expect, it } from 'vitest'
import { featuresFromDescription, parseMeasure } from './infographic'

describe('featuresFromDescription', () => {
  it('[AC-INF-008] takes up to 5 bullets from "Najważniejsze cechy", decoded and clamped to 48 chars', () => {
    const html =
      '<p>Wstęp</p><ul><li>nie ta lista</li></ul><h2>Najważniejsze cechy</h2><ul><li>pojemność <b>350 ml</b></li><li>można myć w zmywarce &amp; mikrofali</li>' +
      '<li>bardzo długi punkt, który zdecydowanie przekracza limit czterdziestu ośmiu znaków</li><li>4</li><li>5</li><li>6</li></ul>'
    const features = featuresFromDescription(html)
    expect(features).toHaveLength(5)
    expect(features[0]).toBe('pojemność 350 ml')
    expect(features[1]).toBe('można myć w zmywarce & mikrofali')
    expect(features[2].length).toBeLessThanOrEqual(48)
    expect(features[2].endsWith('…')).toBe(true)
  })

  it('[AC-INF-008] falls back to the first list and handles missing copy', () => {
    expect(featuresFromDescription('<ul><li>a</li><li>b</li></ul>')).toEqual(['a', 'b'])
    expect(featuresFromDescription('<p>bez listy</p>')).toEqual([])
    expect(featuresFromDescription(null)).toEqual([])
  })
})

describe('parseMeasure', () => {
  it('[AC-INF-004] accepts Polish and English decimals', () => {
    expect(parseMeasure('12,5')).toBe(12.5)
    expect(parseMeasure(' 3 ')).toBe(3)
    expect(parseMeasure('')).toBeUndefined()
    expect(parseMeasure('abc')).toBeNaN()
    expect(parseMeasure('-2')).toBeNaN()
  })
})
