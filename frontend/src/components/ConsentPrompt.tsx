import { useState } from 'react'
import toast from 'react-hot-toast'
import { EnvelopeIcon } from '@heroicons/react/24/outline'
import { usersApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { track } from '../services/analytics'

const DISMISSED_KEY = 'allgrafika:consent-prompt'

function wasDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === userId
  } catch {
    return false
  }
}

/**
 * Spec 19, AC-MON-005: a one-time card asking for marketing consent. Consent is given only by the explicit
 * click on "Tak, chcę" (art. 7 RODO) – closing the card is a "no" and it does not come back on this device.
 */
export default function ConsentPrompt() {
  const { user, refreshUser } = useAuth()
  const [hidden, setHidden] = useState(() => !user || wasDismissed(user.id))
  const [saving, setSaving] = useState(false)

  if (!user || user.marketingConsent || user.unlimitedCredits || hidden) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, user.id)
    } catch {
      // storage unavailable – the card simply returns next time
    }
    setHidden(true)
  }

  const accept = async () => {
    setSaving(true)
    try {
      await usersApi.updateProfile({ marketingConsent: true })
      track('marketing_consent', { source: 'dashboard' })
      toast.success('Dzięki! Zniżki i porady trafią na Twój e-mail.')
      dismiss()
      refreshUser().catch(() => undefined)
    } catch {
      toast.error('Nie udało się zapisać zgody. Spróbuj ponownie w ustawieniach konta.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="consent-prompt-title" className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
      <EnvelopeIcon className="h-8 w-8 text-blue-600 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <h2 id="consent-prompt-title" className="font-semibold text-gray-900">
          Chcesz dostawać zniżki na kredyty i porady?
        </h2>
        <p className="text-sm text-gray-600 mt-0.5">Kilka wiadomości w roku: promocje, style sezonowe przed świętami, przypomnienia. Wypis jednym kliknięciem w każdym mailu.</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button type="button" onClick={accept} disabled={saving} className="btn-primary text-sm">
          {saving ? 'Zapisuję…' : 'Tak, chcę'}
        </button>
        <button type="button" onClick={dismiss} className="btn-secondary text-sm">
          Nie, dziękuję
        </button>
      </div>
    </section>
  )
}
