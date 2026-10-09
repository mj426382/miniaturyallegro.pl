import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { paymentsApi, type CreditPackageInfo } from '../services/api'
import { startPackageCheckout } from '../utils/checkout'
import { countLabel } from '../utils/plural'
import { track } from '../services/analytics'

interface Props {
  open: boolean
  onClose: () => void
  /** How many more credits the user needs for what they wanted to generate (shown in the heading). */
  missing?: number
}

/**
 * Spec 19, AC-MON-003: shown at the moment the balance runs out – instead of an error. Offers the
 * first-purchase welcome pack (when the server says the account qualifies) and the regular packs.
 * The consumer-law consent (art. 38 pkt 13) is collected here, before any payment button.
 */
export default function PaywallModal({ open, onClose, missing }: Props) {
  const [consent, setConsent] = useState(false)
  const [buying, setBuying] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const packages = useQuery({ queryKey: ['payments', 'packages'], queryFn: () => paymentsApi.getPackages().then((r) => r.data as CreditPackageInfo[]), enabled: open })
  const welcome = useQuery({ queryKey: ['payments', 'welcome-offer'], queryFn: () => paymentsApi.welcomeOffer().then((r) => r.data), enabled: open })

  useEffect(() => {
    if (!open) return
    track('paywall_open', { missing: missing ?? 0 })
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, missing])

  if (!open) return null

  const offers: CreditPackageInfo[] = [...(welcome.data?.available && welcome.data.package ? [welcome.data.package] : []), ...(packages.data ?? [])]

  const buy = async (pkg: CreditPackageInfo) => {
    if (!consent) {
      toast.error('Zaznacz zgodę na natychmiastowe udostępnienie kredytów, aby przejść do płatności.')
      return
    }
    setBuying(pkg.id)
    track('paywall_checkout', { packageId: pkg.id })
    try {
      const redirected = await startPackageCheckout(pkg.id)
      if (!redirected) setBuying(null)
    } catch (err: any) {
      const message = err.response?.data?.message
      toast.error(Array.isArray(message) ? message.join('. ') : message || 'Nie udało się przejść do płatności')
      setBuying(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" aria-label="Zamknij okno" tabIndex={-1} onClick={onClose} className="absolute inset-0 w-full h-full cursor-default" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        className="relative bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
      >
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Zamknij" className="absolute top-3 right-3 p-1.5 rounded-md text-gray-500 hover:bg-gray-100">
          <XMarkIcon className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-blue-600 mb-2">
          <SparklesIcon className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 id="paywall-title" className="text-xl font-bold text-gray-900 pr-8">
          {missing && missing > 0 ? `Brakuje Ci ${countLabel(missing, 'kredytu', 'kredytów', 'kredytów')}` : 'Skończyły się kredyty'}
        </h2>
        <p className="text-sm text-gray-600 mt-1">1 kredyt = 1 grafika. Kredyty nie wygasają, a opis oferty pod SEO jest gratis do każdego zdjęcia.</p>

        <label className="flex items-start gap-2 mt-4 rounded-xl border border-gray-200 p-3 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600" />
          <span>
            Żądam natychmiastowego udostępnienia kredytów po opłaceniu zamówienia i przyjmuję do wiadomości, że z chwilą ich udostępnienia tracę prawo do odstąpienia od umowy (art. 38 pkt 13 ustawy o
            prawach konsumenta). Szczegóły w{' '}
            <Link to="/regulamin" target="_blank" className="text-blue-600 underline">
              regulaminie
            </Link>
            .
          </span>
        </label>

        <ul className="mt-4 space-y-2" aria-label="Pakiety kredytów">
          {packages.isLoading || welcome.isLoading ? (
            <li className="text-sm text-gray-500">Ładowanie pakietów…</li>
          ) : (
            offers.map((pkg) => (
              <li key={pkg.id}>
                <button
                  type="button"
                  onClick={() => buy(pkg)}
                  disabled={buying !== null}
                  className={`w-full flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors disabled:opacity-60 ${
                    pkg.welcome ? 'border-yellow-400 bg-yellow-50 hover:bg-yellow-100' : 'border-gray-200 hover:border-blue-400'
                  }`}
                >
                  <span>
                    <span className="block font-semibold text-gray-900">{pkg.label}</span>
                    <span className="block text-xs text-gray-500">
                      {(pkg.priceGrosze / 100 / pkg.credits).toFixed(2).replace('.', ',')} zł / grafika{pkg.savingLabel ? ` · ${pkg.savingLabel}` : ''}
                    </span>
                  </span>
                  <span className="text-lg font-bold text-blue-600 whitespace-nowrap">{buying === pkg.id ? 'Przekierowuję…' : pkg.priceLabel}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="text-xs text-gray-500 mt-3">Płacisz BLIK-iem, kartą lub innymi metodami Stripe. Faktura VAT – NIP podasz w formularzu płatności.</p>
        <p className="text-sm text-gray-700 mt-3 border-t border-gray-100 pt-3">
          Wolisz za darmo?{' '}
          <Link to="/account#polecenia" onClick={onClose} className="text-blue-600 underline">
            Poleć AllGrafika znajomemu
          </Link>{' '}
          – oboje dostaniecie po 3 grafiki.
        </p>
      </div>
    </div>
  )
}
