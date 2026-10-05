import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePageTitle } from '../hooks/usePageTitle'
import GoogleLoginButton from '../components/GoogleLoginButton'
import AuthLayout from '../components/AuthLayout'
import PasswordInput from '../components/PasswordInput'
import FormAlert from '../components/FormAlert'
import { googleSignInAvailable } from '../platform/native'

export default function Login() {
  const showGoogle = googleSignInAvailable()
  usePageTitle('Logowanie')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState({ email: false })
  const [needsTerms, setNeedsTerms] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<string | null>(null)
  const { login, googleLogin } = useAuth()
  const navigate = useNavigate()

  const emailError = useMemo(() => {
    if (!touched.email || !email) return ''
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return 'Podaj prawidłowy adres email'
    return ''
  }, [email, touched.email])

  const describeError = (err: any, fallback: string) => {
    const message = err.response?.data?.message
    if (err.response?.status === 429) return 'Zbyt wiele prób logowania. Spróbuj ponownie za chwilę.'
    return Array.isArray(message) ? message.join('. ') : message || fallback
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Wypełnij wszystkie pola')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      await login(email.trim().toLowerCase(), password)
      navigate('/')
    } catch (err: any) {
      setError(describeError(err, 'Nieprawidłowy email lub hasło'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Zaloguj się"
      subtitle="do swojego konta AllGrafika"
      footer={
        <>
          Nie masz konta?{' '}
          <Link to="/register" className="text-blue-600 font-medium hover:text-blue-700">
            Zarejestruj się
          </Link>
        </>
      }
    >
      {/* Spec 18: Google sign-in needs native OAuth client ids – hidden in the Android/iOS app for now. */}
      {showGoogle && (
        <>
          <GoogleLoginButton
            onSuccess={async (credentialResponse: { credential?: string }) => {
              if (!credentialResponse.credential) return
              setError('')
              setIsLoading(true)
              try {
                await googleLogin(credentialResponse.credential, acceptedTerms || undefined)
                navigate('/')
              } catch (err: any) {
                if (err.response?.data?.code === 'TERMS_REQUIRED') {
                  // New account: the backend refuses to create it without explicit acceptance.
                  setPendingGoogleCredential(credentialResponse.credential)
                  setNeedsTerms(true)
                } else {
                  setError(describeError(err, 'Logowanie Google nie powiodło się'))
                }
              } finally {
                setIsLoading(false)
              }
            }}
            onError={() => setError('Logowanie Google nie powiodło się. Spróbuj ponownie.')}
          />
          {needsTerms && (
            <div className="mt-4 alert-info flex-col">
              <p className="font-medium">To Twoje pierwsze logowanie – założymy Ci konto.</p>
              <label className="flex items-start gap-2 text-sm text-gray-700 mt-2">
                <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5" />
                <span>
                  Akceptuję{' '}
                  <Link to="/regulamin" target="_blank" className="underline">
                    regulamin
                  </Link>{' '}
                  oraz{' '}
                  <Link to="/polityka-prywatnosci" target="_blank" className="underline">
                    politykę prywatności
                  </Link>
                  .
                </span>
              </label>
              <button
                type="button"
                disabled={!acceptedTerms || isLoading || !pendingGoogleCredential}
                onClick={async () => {
                  if (!pendingGoogleCredential) return
                  setIsLoading(true)
                  try {
                    await googleLogin(pendingGoogleCredential, true)
                    navigate('/')
                  } catch (err: any) {
                    setError(describeError(err, 'Nie udało się założyć konta. Zaloguj się przez Google ponownie.'))
                    setPendingGoogleCredential(null)
                    setNeedsTerms(false)
                  } finally {
                    setIsLoading(false)
                  }
                }}
                className="btn-primary w-full mt-3"
              >
                Załóż konto przez Google
              </button>
            </div>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">lub</span>
            </div>
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <FormAlert>{error}</FormAlert>}

        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            className={`input-field ${emailError ? 'border-red-400 focus:ring-red-400' : ''}`}
            placeholder="twoj@email.pl"
            required
          />
          <p className="mt-1 text-sm text-red-600 min-h-[20px]" aria-live="polite">
            {emailError}
          </p>
        </div>

        <PasswordInput id="login-password" label="Hasło" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />

        <div className="flex items-center justify-end">
          <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
            Zapomniałeś hasła?
          </Link>
        </div>

        <button type="submit" disabled={isLoading || !email || !password} className="btn-primary w-full py-3">
          {isLoading ? 'Logowanie...' : 'Zaloguj się'}
        </button>
      </form>
    </AuthLayout>
  )
}
