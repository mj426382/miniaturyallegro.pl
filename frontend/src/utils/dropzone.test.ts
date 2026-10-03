import { describe, expect, it } from 'vitest'
import { describeRejection } from './dropzone'

const file = (name: string) => new File(['x'], name, { type: 'image/png' })

describe('describeRejection', () => {
  it('[AC-UPL-010] explains oversized files', () => {
    expect(describeRejection([{ file: file('big.jpg'), errors: [{ code: 'file-too-large', message: '' }] }])).toBe('Plik jest za duży (max 10 MB): big.jpg')
  })
  it('[AC-UPL-010] explains wrong types and too many files', () => {
    expect(describeRejection([{ file: file('doc.pdf'), errors: [{ code: 'file-invalid-type', message: '' }] }])).toContain('Nieobsługiwany format')
    expect(describeRejection([{ file: file('a.png'), errors: [{ code: 'too-many-files', message: '' }] }])).toContain('maksymalnie 50')
  })
})
