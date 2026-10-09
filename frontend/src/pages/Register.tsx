import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePageTitle } from '../hooks/usePageTitle'
import toast from 'react-hot-toast'
import GoogleLoginButton from '../components/GoogleLoginButton'
import AuthLayout from '../components/AuthLayout'
import PasswordInput from '../components/PasswordInput'
import FormAlert from '../components/FormAlert'
import { track } from '../services/analytics'
import { getPasswordErrors, getPasswordStrength } from '../utils/password'
import { googleSignInAvailable } from '../platform/native'
import { captureReferralFromUrl } from '../utils/referral'

export default function Register() {
  const showGoogle = googleSignInAvailable()
  usePageTitle('Rejestracja')
  // Spec 20: /register?ref=<code> – remembered until the account exists (also across the login page and Google).
  const [referralCode] = useState(() => captureReferralFromUrl())
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  /** Spec 16: optional, never preselected (marketing consent must be freely given). */
  const [marketingConsent, setMarketingConsent] = useState(false)
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

  const isFormValid = Boolean(email && !emailError && password && passwordErrors.length === 0 && confirmPassword === password && acceptedTerms && !isLoading)

  const describeError = (err: any, fallback: string) => {
    const message = err.response?.data?.message
    return Array.isArray(message) ? message.join('. ') : message || fallback
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return
    setIsLoading(true)
    setError('')
    try {
      await register(email.trim().toLowerCase(), password, name.trim() || undefined, acceptedTerms, marketingConsent)
      track('register', { method: 'email' })
      navigate('/')
      toast.success('Konto zostało utworzone!')
    } catch (err: any) {
      setError(describeError(err, 'Błąd rejestracji'))
    } finally {
      setIsLoading(false)
    }
  }

  const passwordHelp = (
    <>
      {password && (
        <span className="block mb-1">
          <span className="flex gap-1 mb-1" aria-hidden="true">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= passwordStrength.score ? passwordStrength.bgColor : 'bg-gray-200'}`} />
            ))}
          </span>
          <span className={`font-medium ${passwordStrength.color}`}>Siła hasła: {passwordStrength.label}</span>
        </span>
      )}
      {touched.password && password && passwordErrors.length > 0 ? (
        <span className="text-red-600">Brakuje: {passwordErrors.join(', ')}</span>
      ) : password && passwordErrors.length === 0 ? (
        <span className="text-green-700">Hasło spełnia wymagania</span>
      ) : (
        <span className="text-gray-500">Min. 8 znaków, wielka i mała litera, cyfra, znak specjalny</span>
      )}
    </>
  )

  return (
    <AuthLayout
      title="Utwórz konto"
      subtitle="5 grafik za darmo, bez karty – odblokujesz je, potwierdzając adres e-mail"
      footer={
        <>
          Masz już konto?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:text-blue-700">
            Zaloguj się
          </Link>
        </>
      }
    >
      {referralCode && (
        <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          🎁 Masz zaproszenie od znajomego: po potwierdzeniu adresu e-mail dostaniesz <strong>3 dodatkowe grafiki</strong> gratis.
        </p>
      )}
      {/* Spec 18: Google sign-in needs native OAuth client ids – hidden in the Android/iOS app for now. */}
      {showGoogle && (
        <>
          {!acceptedTerms && <p className="help-text text-center mb-2">Aby kontynuować przez Google, najpierw zaakceptuj regulamin poniżej.</p>}
          <div className={acceptedTerms ? '' : 'opacity-50 pointer-events-none'} aria-disabled={!acceptedTerms}>
            <GoogleLoginButton
              onSuccess={async (credentialResponse) => {
                if (!credentialResponse.credential) return
                if (!acceptedTerms) {
                  setError('Zaakceptuj regulamin, aby założyć konto')
                  return
                }
                setIsLoading(true)
                setError('')
                try {
                  await googleLogin(credentialResponse.credential, true)
                  track('register', { method: 'google' })
                  navigate('/')
                  toast.success('Zalogowano przez Google!')
                } catch (err: any) {
                  setError(describeError(err, 'Logowanie Google nie powiodło się'))
                } finally {
                  setIsLoading(false)
                }
              }}
              onError={() => setError('Logowanie Google nie powiodło się. Spróbuj ponownie.')}
            />
          </div>

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
          <label htmlFor="register-name" className="block text-sm font-medium text-gray-700 mb-1">
            Imię i nazwisko <span className="text-gray-500 font-normal">(opcjonalnie)</span>
          </label>
          <input id="register-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="Jan Kowalski" maxLength={100} />
        </div>

        <div>
          <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="register-email"
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

        <PasswordInput
          id="register-password"
          label="Hasło"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          placeholder="Min. 8 znaków"
          required
          maxLength={64}
          help={passwordHelp}
        />

        <PasswordInput
          id="register-confirm"
          label="Potwierdź hasło"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
          placeholder="Powtórz hasło"
          required
          error={Boolean(confirmPasswordError)}
          help={
            confirmPasswordError ? (
              <span className="text-red-600">{confirmPasswordError}</span>
            ) : touched.confirmPassword && confirmPassword && password === confirmPassword ? (
              <span className="text-green-700">Hasła są identyczne</span>
            ) : null
          }
        />

        <div className="flex items-start gap-3">
          <input
            id="acceptTerms"
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor="acceptTerms" className="text-sm text-gray-600 cursor-pointer">
            Akceptuję{' '}
            <Link to="/regulamin" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium hover:text-blue-700 underline">
              regulamin świadczenia usług
            </Link>{' '}
            oraz{' '}
            <Link to="/polityka-prywatnosci" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium hover:text-blue-700 underline">
              politykę prywatności
            </Link>
          </label>
        </div>

        <div className="flex items-start gap-3">
          <input
            id="marketingConsent"
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor="marketingConsent" className="text-sm text-gray-600 cursor-pointer">
            Chcę dostawać e-mailem zniżki na kredyty, porady i przypomnienia (np. o stylach sezonowych przed świętami).{' '}
            <span className="text-gray-500">Bez spamu – kilka wiadomości w roku, wypis jednym kliknięciem. Opcjonalne.</span>
          </label>
        </div>

        <button type="submit" disabled={!isFormValid} className="btn-primary w-full py-3">
          {isLoading ? 'Tworzenie konta...' : 'Zarejestruj się'}
        </button>
      </form>
    </AuthLayout>
  )
}
