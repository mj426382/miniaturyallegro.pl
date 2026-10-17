import { useEffect, useRef, useState } from 'react'
import { useModalDialog } from '../hooks/useModalDialog'
import { ADS_CONFIGURED, COOKIE_SETTINGS_EVENT, ConsentChoice, GA4_CONFIGURED, consentEnabled, needsDecision, readConsent, setConsent } from './googleTag'

const NONE: ConsentChoice = { analytics: false, ads: false }
const ALL: ConsentChoice = { analytics: true, ads: true }
const BUTTON = 'flex-1 sm:flex-none min-w-[8rem] px-5 py-2.5 rounded-xl font-semibold text-sm'

/**
 * Cookie consent per category (spec 21 + 22): niezbędne (always), analityczne (Google Analytics 4),
 * marketingowe (Google Ads). „Odrzucam” and „Akceptuję” are equally easy; „Dostosuj” and the footer link
 * „Ustawienia cookies” open the per-category choice. Renders nothing on the server and on the first client
 * render, so the prerendered HTML and hydration are unaffected.
 * The per-category choice is a modal dialog (spec 11, AC-UI-010): focus stays inside, the page behind is inert,
 * Escape goes back to the summary (no decision yet) or closes (decision already stored), focus returns to the opener.
 * Identical copies: landing-page/src/consent/CookieBanner.tsx and frontend/src/consent/CookieBanner.tsx
 * (and their hooks/useModalDialog.ts).
 */
export default function CookieBanner() {
  const [view, setView] = useState<'closed' | 'summary' | 'settings'>('closed')
  const [choice, setChoice] = useState<ConsentChoice>(NONE)
  /** A returning visitor asked again because a category was added (e.g. analytics after the Ads-only banner). */
  const [returning, setReturning] = useState(false)
  const customizeRef = useRef<HTMLButtonElement>(null)
  const settingsRef = useModalDialog<HTMLDivElement>({
    active: view === 'settings',
    onClose: () => setView(needsDecision() ? 'summary' : 'closed'),
    returnFocus: () => customizeRef.current,
  })

  useEffect(() => {
    const open = (next: 'summary' | 'settings') => {
      const stored = readConsent()
      // No pre-ticked boxes: only what the visitor already allowed is checked.
      setChoice({ analytics: stored.analytics === true, ads: stored.ads === true })
      setReturning(stored.analytics !== null || stored.ads !== null)
      setView(next)
    }
    if (needsDecision()) open('summary')
    const reopen = () => {
      if (consentEnabled()) open('settings')
    }
    window.addEventListener(COOKIE_SETTINGS_EVENT, reopen)
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, reopen)
  }, [])

  if (view === 'closed') return null

  const decide = (decision: ConsentChoice) => {
    setConsent(decision)
    setView('closed')
  }

  const tools = [GA4_CONFIGURED && 'Google Analytics (statystyki odwiedzin)', ADS_CONFIGURED && 'Google Ads (pomiar skuteczności reklam)'].filter(Boolean).join(' i ')

  const settings = view === 'settings'

  return (
    <div role="region" aria-label="Zgoda na pliki cookies" data-dialog-root={settings ? '' : undefined} className={settings ? 'fixed inset-0 z-50 flex items-end' : 'fixed inset-x-0 bottom-0 z-50'}>
      {settings && <div aria-hidden="true" className="absolute inset-0 bg-black/50" />}
      <div
        ref={settingsRef}
        role={settings ? 'dialog' : undefined}
        aria-modal={settings ? true : undefined}
        aria-labelledby={settings ? 'cookie-settings-title' : undefined}
        tabIndex={settings ? -1 : undefined}
        className="relative w-full max-h-[85vh] overflow-y-auto border-t border-gray-200 bg-white shadow-lg focus:outline-none"
      >
        <div className="max-w-5xl mx-auto px-4 py-4">
          {view === 'summary' ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="text-sm text-gray-700 flex-1">
                {returning && <strong className="block mb-1">Dodaliśmy nową kategorię plików cookies – zdecyduj o niej. Dotychczasowy wybór obowiązuje do tego czasu.</strong>}
                Używamy plików cookies {tools}. Włączymy je tylko za Twoją zgodą; niezbędne pliki działają zawsze. Zmienisz decyzję w każdej chwili w „Ustawieniach cookies”.{' '}
                <a href="https://allgrafika.pl/polityka-prywatnosci" className="text-blue-600 underline">
                  Polityka prywatności
                </a>
              </p>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => decide(NONE)} className={`${BUTTON} bg-gray-800 text-white hover:bg-gray-700`}>
                  Odrzucam
                </button>
                <button ref={customizeRef} type="button" onClick={() => setView('settings')} className={`${BUTTON} border border-gray-300 text-gray-800 hover:bg-gray-50`}>
                  Dostosuj
                </button>
                <button type="button" onClick={() => decide(ALL)} className={`${BUTTON} bg-blue-600 text-white hover:bg-blue-700`}>
                  Akceptuję
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <h2 id="cookie-settings-title" className="font-semibold text-gray-900">
                Ustawienia plików cookies
              </h2>
              <fieldset className="text-sm text-gray-700 space-y-3">
                <legend className="sr-only">Kategorie plików cookies</legend>
                <label className="flex gap-3 items-start">
                  <input type="checkbox" checked disabled className="mt-1" />
                  <span>
                    <strong>Niezbędne</strong> – zapamiętanie Twojej decyzji (plik ag_consent) i logowanie. Działają zawsze.
                  </span>
                </label>
                {GA4_CONFIGURED && (
                  <label className="flex gap-3 items-start">
                    <input type="checkbox" checked={choice.analytics} onChange={(e) => setChoice({ ...choice, analytics: e.target.checked })} className="mt-1" />
                    <span>
                      <strong>Analityczne</strong> – Google Analytics 4: statystyki odwiedzin i skuteczności stron (pliki _ga).
                    </span>
                  </label>
                )}
                {ADS_CONFIGURED && (
                  <label className="flex gap-3 items-start">
                    <input type="checkbox" checked={choice.ads} onChange={(e) => setChoice({ ...choice, ads: e.target.checked })} className="mt-1" />
                    <span>
                      <strong>Marketingowe</strong> – Google Ads: pomiar, czy wizyta z reklamy zakończyła się rejestracją lub zakupem (pliki _gcl_).
                    </span>
                  </label>
                )}
                <p>
                  <a href="https://allgrafika.pl/polityka-prywatnosci" className="text-blue-600 underline">
                    Polityka prywatności
                  </a>
                </p>
              </fieldset>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button type="button" onClick={() => decide(NONE)} className={`${BUTTON} bg-gray-800 text-white hover:bg-gray-700`}>
                  Odrzucam
                </button>
                <button type="button" onClick={() => decide(choice)} className={`${BUTTON} border border-gray-300 text-gray-800 hover:bg-gray-50`}>
                  Zapisz wybór
                </button>
                <button type="button" onClick={() => decide(ALL)} className={`${BUTTON} bg-blue-600 text-white hover:bg-blue-700`}>
                  Akceptuję
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
