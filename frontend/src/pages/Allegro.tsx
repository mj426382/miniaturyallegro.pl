import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ShoppingBagIcon, ArrowDownTrayIcon, LinkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { allegroApi, AllegroOffer } from '../services/api'
import { track } from '../services/analytics'
import { usePageTitle } from '../hooks/usePageTitle'
import { useConfirm } from '../hooks/useConfirm'
import { isNativeApp, openInSystemBrowser, webUrl } from '../platform/native'

const PAGE_SIZE = 20

export default function Allegro() {
  usePageTitle('Integracja z Allegro')
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean; sellerLogin: string | null } | null>(null)
  const [offers, setOffers] = useState<AllegroOffer[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [importingId, setImportingId] = useState<string | null>(null)

  const loadStatus = async () => {
    try {
      const { data } = await allegroApi.status()
      setStatus(data)
      return data
    } catch {
      toast.error('Nie udało się sprawdzić połączenia z Allegro')
      return null
    }
  }

  const loadOffers = async (nextOffset = 0, name = query) => {
    setIsLoading(true)
    try {
      const { data } = await allegroApi.offers({ offset: nextOffset, limit: PAGE_SIZE, name: name.trim() || undefined })
      setOffers(data.offers)
      setTotal(data.total)
      setOffset(nextOffset)
    } catch (err: any) {
      const message = err.response?.data?.message
      toast.error(Array.isArray(message) ? message.join('. ') : message || 'Nie udało się pobrać ofert')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStatus().then((s) => {
      if (s?.connected) loadOffers(0, '')
      else setIsLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connect = async () => {
    // Spec 18: the OAuth callback returns to the web domain, so the app connects Allegro in the browser.
    if (isNativeApp()) {
      openInSystemBrowser(webUrl('/allegro')).catch(() => toast.error('Nie udało się otworzyć przeglądarki'))
      return
    }
    try {
      const { data } = await allegroApi.authUrl()
      track('allegro_connect_start')
      window.location.href = data.url
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Integracja z Allegro nie jest dostępna')
    }
  }

  const disconnect = async () => {
    const ok = await confirm({ title: 'Odłączyć konto Allegro?', message: 'Zapisane tokeny dostępu zostaną usunięte. Zaimportowane zdjęcia i grafiki zostają.', confirmLabel: 'Odłącz', danger: true })
    if (!ok) return
    try {
      await allegroApi.disconnect()
      setStatus((s) => (s ? { ...s, connected: false, sellerLogin: null } : s))
      setOffers([])
      toast.success('Konto Allegro odłączone')
    } catch {
      toast.error('Nie udało się odłączyć konta. Spróbuj ponownie.')
    }
  }

  const importOffer = async (offer: AllegroOffer) => {
    setImportingId(offer.id)
    try {
      const { data } = await allegroApi.importOffer(offer.id)
      track('allegro_import')
      toast.success('Zdjęcie zaimportowane. Wybierz style do wygenerowania.')
      navigate(`/generate/${data.id}`)
    } catch (err: any) {
      const message = err.response?.data?.message
      toast.error(Array.isArray(message) ? message.join('. ') : message || 'Nie udało się zaimportować zdjęcia')
    } finally {
      setImportingId(null)
    }
  }

  if (!status) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integracja z Allegro</h1>
          <p className="text-gray-500 mt-1">Pobierz zdjęcia ze swoich ofert, wygeneruj grafiki i opublikuj je z powrotem jednym kliknięciem.</p>
        </div>
        {status.connected && (
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-500">Połączono jako</p>
            <p className="text-sm font-medium text-gray-900">{status.sellerLogin || 'konto Allegro'}</p>
            <button onClick={disconnect} className="text-xs text-red-500 hover:text-red-700 mt-1">
              Odłącz
            </button>
          </div>
        )}
      </div>

      {!status.configured && (
        <div className="card text-center py-12">
          <ShoppingBagIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">Integracja z Allegro nie jest jeszcze włączona</p>
          <p className="text-sm text-gray-500 mt-1">Wróć wkrótce albo napisz do nas na kontakt@allgrafika.pl.</p>
        </div>
      )}

      {status.configured && !status.connected && (
        <div className="card text-center py-12">
          <LinkIcon className="h-12 w-12 text-blue-500 mx-auto mb-3" />
          <p className="text-gray-900 font-semibold text-lg">Połącz konto sprzedawcy Allegro</p>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            Zostaniesz przekierowany do Allegro, gdzie zalogujesz się i wyrazisz zgodę na dostęp do ofert. Nie przechowujemy Twojego hasła, a dostęp możesz cofnąć w każdej chwili.
          </p>
          <button onClick={connect} className="btn-primary mt-6">
            Połącz z Allegro
          </button>
        </div>
      )}

      {status.connected && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              loadOffers(0, query)
            }}
            className="flex gap-2 mb-4"
          >
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj oferty po nazwie" className="input-field pl-9" />
            </div>
            <button type="submit" className="btn-secondary">
              Szukaj
            </button>
          </form>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-xl aspect-square animate-pulse" />
              ))}
            </div>
          ) : offers.length === 0 ? (
            <div className="card text-center py-12 text-gray-500">Brak aktywnych ofert do wyświetlenia.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {offers.map((offer) => (
                  <div key={offer.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                    <div className="aspect-square bg-gray-100">
                      {offer.primaryImage ? (
                        <img src={offer.primaryImage} alt={offer.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <ShoppingBagIcon className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex-1 flex flex-col">
                      <p className="text-sm font-medium text-gray-800 line-clamp-2 flex-1">{offer.name}</p>
                      {offer.price && <p className="text-xs text-gray-500 mt-1">{offer.price}</p>}
                      <button
                        onClick={() => importOffer(offer)}
                        disabled={importingId === offer.id || !offer.primaryImage}
                        className="mt-3 flex items-center justify-center gap-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg px-2 py-1.5 disabled:opacity-50"
                      >
                        <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                        {importingId === offer.id ? 'Importuję...' : 'Importuj i generuj'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {total > PAGE_SIZE && (
                <div className="flex justify-center gap-2 mt-6">
                  <button disabled={offset === 0} onClick={() => loadOffers(Math.max(0, offset - PAGE_SIZE))} className="btn-secondary disabled:opacity-50">
                    Poprzednie
                  </button>
                  <span className="text-sm text-gray-500 self-center">
                    {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} z {total}
                  </span>
                  <button disabled={offset + PAGE_SIZE >= total} onClick={() => loadOffers(offset + PAGE_SIZE)} className="btn-secondary disabled:opacity-50">
                    Następne
                  </button>
                </div>
              )}
            </>
          )}
          <p className="text-xs text-gray-500 mt-6">
            Po wygenerowaniu grafik użyj przycisku „Opublikuj w Allegro” przy grafice. Styl „Białe tło” spełnia wymagania zdjęcia głównego; pozostałe style dodawaj jako kolejne zdjęcia galerii. Zobacz
            też{' '}
            <Link to="/upload" className="underline">
              zwykłe przesyłanie
            </Link>
            .
          </p>
        </>
      )}
    </div>
  )
}
