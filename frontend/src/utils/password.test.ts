import { describe, expect, it } from 'vitest'
import { getPasswordErrors, getPasswordStrength } from './password'

describe('password rules', () => {
  it('[AC-AUTH-023] lists every missing requirement', () => {
    expect(getPasswordErrors('abc')).toEqual(['Min. 8 znaków', 'Wielka litera', 'Cyfra', 'Znak specjalny'])
    expect(getPasswordErrors('Dobre!Haslo1')).toEqual([])
  })

  it('[AC-AUTH-023] scores strength from weak to very strong', () => {
    expect(getPasswordStrength('abc').label).toBe('Bardzo słabe')
    expect(getPasswordStrength('Dobre!Haslo1').label).toBe('Bardzo silne')
    expect(getPasswordStrength('Haslo123').label).toBe('Średnie')
  })
})
