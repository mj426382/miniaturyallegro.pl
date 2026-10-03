/** Password rules – mirrored by the API's PasswordRules() validator. */
export interface PasswordStrength {
  score: number
  label: string
  color: string
  bgColor: string
}

const SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/

export function getPasswordStrength(password: string): PasswordStrength {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (SPECIAL.test(password)) score++

  if (score <= 2) return { score, label: 'Bardzo słabe', color: 'text-red-600', bgColor: 'bg-red-500' }
  if (score <= 3) return { score, label: 'Słabe', color: 'text-orange-600', bgColor: 'bg-orange-500' }
  if (score <= 4) return { score, label: 'Średnie', color: 'text-yellow-700', bgColor: 'bg-yellow-500' }
  if (score <= 5) return { score, label: 'Silne', color: 'text-green-700', bgColor: 'bg-green-500' }
  return { score, label: 'Bardzo silne', color: 'text-emerald-700', bgColor: 'bg-emerald-500' }
}

export function getPasswordErrors(password: string): string[] {
  const errors: string[] = []
  if (password.length < 8) errors.push('Min. 8 znaków')
  if (!/[A-Z]/.test(password)) errors.push('Wielka litera')
  if (!/[a-z]/.test(password)) errors.push('Mała litera')
  if (!/\d/.test(password)) errors.push('Cyfra')
  if (!SPECIAL.test(password)) errors.push('Znak specjalny')
  return errors
}
