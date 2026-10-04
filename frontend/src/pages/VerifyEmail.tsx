import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { usePageTitle } from '../hooks/usePageTitle'
import AuthLayout from '../components/AuthLayout'
import FormAlert from '../components/FormAlert'

type State = 'loading' | 'success' | 'error'

/** Spec 13: target of the link from the verification e-mail. Public – works logged in or out. */
export default function VerifyEmail() {
  usePageTitle('Potwierdzenie adresu e-mail')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { user, refreshUser } = useAuth()
  const [state, setState] = useState<State>(token ? 'loading' : 'error')
  const [message, setMessage] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    authApi
      .verifyEmail(token)
      .then(() => {
        setState('success')
        refreshUser().catch(() => undefined)
      })
      .catch((err) => {
        const msg = err.response?.data?.message
        setMessage(Array.isArray(msg) ? msg.join('. ') : msg || '')
        setState('error')
      })
  }, [token, refreshUser])

  return (
    <AuthLayout title="Potwierdzenie adresu e-mail">
      {state === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-4" role="status">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <p className="text-sm text-gray-600">Potwierdzam adres…</p>
        </div>
      )}
      {state === 'success' && (
        <div className="space-y-4 text-center">
          <FormAlert kind="success" className="text-left">
            Adres potwierdzony – możesz generować grafiki. Darmowe kredyty są już dostępne.
          </FormAlert>
          {user ? (
            <Link to="/" className="btn-primary inline-block">
              Przejdź do aplikacji
            </Link>
          ) : (
            <Link to="/login" className="btn-primary inline-block">
              Zaloguj się
            </Link>
          )}
        </div>
      )}
      {state === 'error' && (
        <div className="space-y-4 text-center">
          <FormAlert className="text-left">{message || 'Link jest nieprawidłowy lub wygasł.'}</FormAlert>
          <p className="text-sm text-gray-600">Nowy link wyślesz z banera u góry aplikacji po zalogowaniu.</p>
          <Link to={user ? '/' : '/login'} className="btn-primary inline-block">
            {user ? 'Przejdź do aplikacji' : 'Zaloguj się'}
          </Link>
        </div>
      )}
    </AuthLayout>
  )
}
