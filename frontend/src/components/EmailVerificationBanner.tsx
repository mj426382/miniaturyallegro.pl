import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { EnvelopeIcon } from '@heroicons/react/24/outline'
import { authApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'

/**
 * Spec 13: shown on every app screen until the owner confirms the address. The profile is re-read
 * when the tab regains focus, so the banner disappears right after the link was clicked elsewhere.
 */
export default function EmailVerificationBanner() {
  const { user, refreshUser } = useAuth()
  const [sending, setSending] = useState(false)
  const unverified = user?.emailVerified === false

  useEffect(() => {
    if (!unverified) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshUser().catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [unverified, refreshUser])

  if (!unverified) return null

  const resend = async () => {
    setSending(true)
    try {
      const { data } = await authApi.resendVerification()
      if (data.alreadyVerified) {
        toast.success('Adres jest już potwierdzony.')
        refreshUser().catch(() => undefined)
      } else {
        toast.success('Wysłaliśmy nowy link. Sprawdź skrzynkę, także folder spam.')
      }
    } catch (err: any) {
      const message = err.response?.data?.message
      toast.error(Array.isArray(message) ? message.join('. ') : message || 'Nie udało się wysłać linku')
    } finally {
      setSending(false)
    }
  }

  return (
    <div role="status" className="bg-amber-50 border-b border-amber-200 px-4 py-3 sm:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 max-w-5xl">
        <EnvelopeIcon className="hidden sm:block h-6 w-6 text-amber-700 shrink-0" aria-hidden="true" />
        <p className="text-sm text-amber-900 flex-1">
          <strong>Potwierdź adres e-mail</strong> – wysłaliśmy link na <strong className="break-all">{user!.email}</strong>. Do tego czasu nie możesz generować grafik ani kupować kredytów.
        </p>
        <button type="button" onClick={resend} disabled={sending} className="btn-secondary text-sm whitespace-nowrap self-start sm:self-auto">
          {sending ? 'Wysyłam...' : 'Wyślij link ponownie'}
        </button>
      </div>
    </div>
  )
}
