import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { GiftIcon } from '@heroicons/react/24/outline'
import { usersApi } from '../services/api'
import { countLabel } from '../utils/plural'
import { track } from '../services/analytics'

/** Spec 20, AC-REF-006: the user's referral link with copy/share and the results so far. */
export default function ReferralCard() {
  const referral = useQuery({ queryKey: ['referral'], queryFn: () => usersApi.referral().then((r) => r.data) })
  const [copied, setCopied] = useState(false)
  const data = referral.data
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = async () => {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.link)
      setCopied(true)
      track('referral_copy')
      toast.success('Link skopiowany')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Nie udało się skopiować – zaznacz link i skopiuj ręcznie.')
    }
  }

  const share = async () => {
    if (!data) return
    try {
      await navigator.share({
        title: 'AllGrafika – miniaturki Allegro z AI',
        text: `Robię miniaturki na Allegro w AllGrafika. Zarejestruj się z mojego linku, a dostaniesz ${data.bonus} grafiki gratis na start:`,
        url: data.link,
      })
      track('referral_share')
    } catch {
      // the user closed the share sheet
    }
  }

  return (
    <section id="polecenia" aria-labelledby="referral-title" className="card">
      <h2 id="referral-title" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <GiftIcon className="h-5 w-5 text-blue-600" aria-hidden="true" />
        Poleć znajomym – zdobądź darmowe grafiki
      </h2>
      {referral.isLoading ? (
        <p className="text-sm text-gray-500 mt-2">Ładowanie…</p>
      ) : referral.isError || !data ? (
        <p role="alert" className="text-sm text-red-600 mt-2">
          Nie udało się pobrać linku.{' '}
          <button type="button" onClick={() => referral.refetch()} className="underline">
            Spróbuj ponownie
          </button>
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-600 mt-1">
            Za każdą osobę, która założy konto z Twojego linku i potwierdzi e-mail, Ty i ona dostajecie po {countLabel(data.bonus, 'grafikę', 'grafiki', 'grafik')} gratis (do {data.maxRewards}{' '}
            poleceń).
          </p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <label htmlFor="referral-link" className="sr-only">
              Twój link polecający
            </label>
            <input id="referral-link" readOnly value={data.link} onFocus={(e) => e.target.select()} className="input-field text-sm flex-1 min-w-0" />
            <div className="flex gap-2">
              <button type="button" onClick={copy} className="btn-primary text-sm whitespace-nowrap">
                {copied ? 'Skopiowano ✓' : 'Kopiuj link'}
              </button>
              {canShare && (
                <button type="button" onClick={share} className="btn-secondary text-sm whitespace-nowrap">
                  Udostępnij
                </button>
              )}
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-gray-50 p-3">
              <dt className="text-gray-500">Polecone konta</dt>
              <dd className="text-xl font-bold text-gray-900">{data.referred}</dd>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <dt className="text-gray-500">Zdobyte grafiki</dt>
              <dd className="text-xl font-bold text-gray-900">{data.creditsEarned}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  )
}
