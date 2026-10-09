import { useEffect, useState } from 'react'
import { adsEnabled, COOKIE_SETTINGS_EVENT, needsDecision, setAdsConsent } from './googleAds'

/**
 * Cookie consent for Google Ads (spec 21, AC-ADS-001..004). Renders nothing on the server and on the first
 * client render, so the prerendered HTML and hydration are unaffected. Both choices are equally easy.
 * Identical copies: landing-page/src/consent/CookieBanner.tsx and frontend/src/consent/CookieBanner.tsx.
 */
export default function CookieBanner() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(needsDecision())
    const reopen = () => {
      if (adsEnabled()) setOpen(true)
    }
    window.addEventListener(COOKIE_SETTINGS_EVENT, reopen)
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen)
  }, [])

  if (!open) return null

  const decide = (granted: boolean) => {
    setAdsConsent(granted)
    setOpen(false)
  }

  return (
    <div role="region" aria-label="Zgoda na pliki cookies" className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white shadow-lg">
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-gray-700 flex-1">
          Używamy plików cookies Google Ads, aby mierzyć skuteczność naszych reklam. Włączymy je tylko za Twoją zgodą. Zmienisz ją w każdej chwili w „Ustawieniach cookies”.{' '}
          <a href="https://allgrafika.pl/polityka-prywatnosci" className="text-blue-600 underline">
            Polityka prywatności
          </a>
        </p>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={() => decide(false)} className="flex-1 sm:flex-none min-w-[8rem] px-5 py-2.5 rounded-xl bg-gray-800 text-white font-semibold text-sm hover:bg-gray-700">
            Odrzucam
          </button>
          <button type="button" onClick={() => decide(true)} className="flex-1 sm:flex-none min-w-[8rem] px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700">
            Akceptuję
          </button>
        </div>
      </div>
    </div>
  )
}
