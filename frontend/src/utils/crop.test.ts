import { describe, expect, it } from 'vitest'
import { isFullFrame, ratioToAspect, toCropRect } from './crop'

describe('toCropRect', () => {
  it('[AC-EXP-020] converts percentages to fractions rounded to 4 decimals', () => {
    expect(toCropRect({ x: 0, y: 12.5, width: 100, height: 75 })).toEqual({ left: 0, top: 0.125, width: 1, height: 0.75 })
    expect(toCropRect({ x: 33.33333, y: 0, width: 33.33333, height: 100 })).toEqual({ left: 0.3333, top: 0, width: 0.3333, height: 1 })
  })

  it('[AC-EXP-021] clamps rectangles that would leave the image', () => {
    expect(toCropRect({ x: 80, y: -5, width: 50, height: 120 })).toEqual({ left: 0.5, top: 0, width: 0.5, height: 1 })
    expect(toCropRect({ x: NaN, y: 0, width: 100, height: 100 })).toEqual({ left: 0, top: 0, width: 1, height: 1 })
  })
})

describe('helpers', () => {
  it('detects a full-frame crop', () => {
    expect(isFullFrame({ left: 0, top: 0, width: 1, height: 1 })).toBe(true)
    expect(isFullFrame({ left: 0, top: 0.125, width: 1, height: 0.75 })).toBe(false)
  })

  it('maps ratio strings to numeric aspects', () => {
    expect(ratioToAspect('4:3')).toBeCloseTo(4 / 3)
    expect(ratioToAspect('3:4')).toBeCloseTo(0.75)
    expect(ratioToAspect('nonsense')).toBe(1)
  })
})
