import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { notificationsApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { usePageTitle } from '../hooks/usePageTitle'
import AuthLayout from '../components/AuthLayout'
import FormAlert from '../components/FormAlert'

/** Spec 16: target of the unsubscribe link in tips and reminders. Public – the token is the credential. */
export default function Unsubscribe() {
  usePageTitle('Wypisanie z wiadomości')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { user, refreshUser } = useAuth()
  const [state, setState] = useState<'loading' | 'done' | 'error'>(token ? 'loading' : 'error')
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    notificationsApi
      .unsubscribe(token)
      .then(() => {
        setState('done')
        if (user) refreshUser().catch(() => undefined)
      })
      .catch(() => setState('error'))
  }, [token, user, refreshUser])

  return (
    <AuthLayout title="Wypisanie z wiadomości">
      {state === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-4" role="status">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <p className="text-sm text-gray-600">Wypisuję…</p>
        </div>
      )}
      {state === 'done' && (
        <div className="space-y-4 text-center">
          <FormAlert kind="success" className="text-left">
            Gotowe – nie będziesz już dostawać wskazówek ani przypomnień. Powiadomienia o Twoich paczkach i maile dotyczące konta przychodzą dalej.
          </FormAlert>
          <p className="text-sm text-gray-600">Zgodę możesz włączyć ponownie w ustawieniach konta.</p>
          <Link to={user ? '/account' : '/login'} className="btn-primary inline-block">
            {user ? 'Ustawienia konta' : 'Zaloguj się'}
          </Link>
        </div>
      )}
      {state === 'error' && (
        <div className="space-y-4 text-center">
          <FormAlert className="text-left">Link wypisania jest nieprawidłowy.</FormAlert>
          <p className="text-sm text-gray-600">Po zalogowaniu wyłączysz wiadomości w ustawieniach konta.</p>
          <Link to={user ? '/account' : '/login'} className="btn-primary inline-block">
            {user ? 'Ustawienia konta' : 'Zaloguj się'}
          </Link>
        </div>
      )}
    </AuthLayout>
  )
}
