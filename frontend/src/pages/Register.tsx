import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import GoogleLoginButton from '../components/GoogleLoginButton'

interface PasswordStrength {
  score: number
  label: string
  color: string
  bgColor: string
}

function getPasswordStrength(password: string): PasswordStrength {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++

  if (score <= 2) return { score, label: 'Bardzo słabe', color: 'text-red-600', bgColor: 'bg-red-500' }
  if (score <= 3) return { score, label: 'Słabe', color: 'text-orange-600', bgColor: 'bg-orange-500' }
  if (score <= 4) return { score, label: 'Średnie', color: 'text-yellow-600', bgColor: 'bg-yellow-500' }
  if (score <= 5) return { score, label: 'Silne', color: 'text-green-600', bgColor: 'bg-green-500' }
  return { score, label: 'Bardzo silne', color: 'text-emerald-600', bgColor: 'bg-emerald-500' }
}

function getPasswordErrors(password: string): string[] {
  const errors: string[] = []
  if (password.length < 8) errors.push('Min. 8 znaków')
  if (!/[A-Z]/.test(password)) errors.push('Wielka litera')
  if (!/[a-z]/.test(password)) errors.push('Mała litera')
  if (!/\d/.test(password)) errors.push('Cyfra')
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Znak specjalny')
  return errors
}

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [touched, setTouched] = useState({ email: false, password: false, confirmPassword: false })
  const { register, googleLogin } = useAuth()
  const navigate = useNavigate()

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password])
  const passwordErrors = useMemo(() => getPasswordErrors(password), [password])

  const emailError = useMemo(() => {
    if (!touched.email || !email) return ''
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return 'Podaj prawidłowy adres email'
    return ''
  }, [email, touched.email])

  const confirmPasswordError = useMemo(() => {
    if (!touched.confirmPassword || !confirmPassword) return ''
    if (password !== confirmPassword) return 'Hasła nie są identyczne'
    return ''
  }, [password, confirmPassword, touched.confirmPassword])

  const isFormValid = useMemo(() => {
    return (
      email &&
      !emailError &&
      password &&
      passwordErrors.length === 0 &&
      confirmPassword === password &&
      !isLoading
    )
  }, [email, emailError, password, passwordErrors, confirmPassword, isLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordErrors.length > 0) {
      toast.error('Hasło nie spełnia wymagań bezpieczeństwa')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Hasła nie są identyczne')
      return
    }

    setIsLoading(true)
    try {
      await register(email.trim().toLowerCase(), password, name.trim() || undefined)
      navigate('/')
      toast.success('Konto zostało utworzone!')
    } catch (err: any) {
      const message = err.response?.data?.message
      if (Array.isArray(message)) {
        message.forEach((msg: string) => toast.error(msg))
      } else {
        toast.error(message || 'Błąd rejestracji')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Utwórz konto</h1>
          <p className="text-gray-500 mt-2">Zacznij generować grafiki Allegro</p>
        </div>

        <GoogleLoginButton
          onSuccess={async (credentialResponse) => {
            if (!credentialResponse.credential) return
            setIsLoading(true)
            try {
              await googleLogin(credentialResponse.credential)
              navigate('/')
              toast.success('Zalogowano przez Google!')
            } catch (err: any) {
              const message = err.response?.data?.message
              toast.error(Array.isArray(message) ? message.join('. ') : message || 'Logowanie Google nie powiodło się')
            } finally {
              setIsLoading(false)
            }
          }}
          onError={() => toast.error('Logowanie Google nie powiodło się. Spróbuj ponownie.')}
        />

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">lub</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Imię i nazwisko
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="Jan Kowalski"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              className={`input-field ${emailError ? 'border-red-400 focus:ring-red-400' : ''}`}
              placeholder="twoj@email.pl"
              required
            />
            {emailError && (
              <p className="mt-1 text-sm text-red-600">{emailError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hasło
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                className="input-field pr-10"
                placeholder="Min. 8 znaków"
                required
                maxLength={64}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Wskaźnik siły hasła */}
            {password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i <= passwordStrength.score ? passwordStrength.bgColor : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs font-medium ${passwordStrength.color}`}>
                  Siła hasła: {passwordStrength.label}
                </p>
              </div>
            )}

            {/* Wymagania hasła */}
            {touched.password && password && passwordErrors.length > 0 && (
              <div className="mt-2 space-y-1">
                {passwordErrors.map((err) => (
                  <p key={err} className="text-xs text-red-500 flex items-center gap-1">
                    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {err}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Potwierdź hasło
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
                className={`input-field pr-10 ${confirmPasswordError ? 'border-red-400 focus:ring-red-400' : ''}`}
                placeholder="Powtórz hasło"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {confirmPasswordError && (
              <p className="mt-1 text-sm text-red-600">{confirmPasswordError}</p>
            )}
            {touched.confirmPassword && confirmPassword && !confirmPasswordError && password === confirmPassword && (
              <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Hasła są identyczne
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!isFormValid}
            className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Tworzenie konta...' : 'Zarejestruj się'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Masz już konto?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:text-blue-700">
            Zaloguj się
          </Link>
        </p>
      </div>
    </div>
  )
}
