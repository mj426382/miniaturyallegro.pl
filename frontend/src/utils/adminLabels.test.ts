import { describe, expect, it } from 'vitest'
import { ratingReasonLabel } from './adminLabels'

describe('ratingReasonLabel', () => {
  it('[AC-ADM-009] shows the Polish reason and the user comment', () => {
    expect(ratingReasonLabel('artifacts')).toBe('Błędy / artefakty na grafice')
    expect(ratingReasonLabel('other: kolor: zły odcień')).toBe('Inny powód – „kolor: zły odcień”')
    expect(ratingReasonLabel('nowy-powod')).toBe('nowy-powod')
    expect(ratingReasonLabel(null)).toBeNull()
  })
})
