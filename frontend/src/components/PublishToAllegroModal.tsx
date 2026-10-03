import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { XMarkIcon, ShoppingBagIcon } from '@heroicons/react/24/outline'
import { allegroApi, AllegroOffer } from '../services/api'
import { track } from '../services/analytics'

interface Props {
  generationId: string
  style: string
  /** Offer the source photo was imported from (if any) – preselected. */
  defaultOfferId?: string | null
  onClose: () => void
}

export default function PublishToAllegroModal({ generationId, style, defaultOfferId, onClose }: Props) {
  const [offers, setOffers] = useState<AllegroOffer[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(defaultOfferId ?? null)
  const [position, setPosition] = useState<'first' | 'last'>(style === 'white-bg' ? 'first' : 'last')
  const [isLoading, setIsLoading] = useState(true)
  const [isPublishing, setIsPublishing] = useState(false)
  const [connected, setConnected] = useState<boolean | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const load = async (name = '') => {
    setIsLoading(true)
    try {
      const status = await allegroApi.status()
      setConnected(status.data.connected)
      if (!status.data.connected) return
      const { data } = await allegroApi.offers({ limit: 50, name: name.trim() || undefined })
      setOffers(data.offers)
    } catch {
      toast.error('Nie udało się pobrać ofert z Allegro')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const publish = async () => {
    if (!selected) return
    setIsPublishing(true)
    try {
      await allegroApi.publish(selected, generationId, position)
      track('allegro_publish', { style, position })
      toast.success(position === 'first' ? 'Grafika ustawiona jako zdjęcie główne oferty.' : 'Grafika dodana do galerii oferty.')
      onClose()
    } catch (err: any) {
      const message = err.response?.data?.message
      toast.error(Array.isArray(message) ? message.join('. ') : message || 'Publikacja nie powiodła się')
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <button type="button" aria-label="Zamknij okno" tabIndex={-1} onClick={onClose} className="absolute inset-0 w-full h-full cursor-default" />
      <div role="dialog" aria-modal="true" aria-labelledby="publish-modal-title" className="relative bg-white rounded-2xl w-full max-w-xl p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 id="publish-modal-title" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingBagIcon className="h-5 w-5 text-blue-600" /> Opublikuj w Allegro
          </h2>
          <button ref={closeRef} onClick={onClose} aria-label="Zamknij" className="text-gray-500 hover:text-gray-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {connected === false ? (
          <p className="text-sm text-gray-600">
            Najpierw połącz konto Allegro w zakładce{' '}
            <Link to="/allegro" className="text-blue-600 underline">
              Allegro
            </Link>
            .
          </p>
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                load(query)
              }}
              className="flex gap-2 mb-3"
            >
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj oferty" className="input-field text-sm" />
              <button type="submit" className="btn-secondary text-sm">
                Szukaj
              </button>
            </form>
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 min-h-[160px]">
              {isLoading ? (
                <p className="p-4 text-sm text-gray-500">Ładowanie ofert...</p>
              ) : offers.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Brak ofert.</p>
              ) : (
                offers.map((o) => (
                  <label key={o.id} className={`flex items-center gap-3 p-2 cursor-pointer ${selected === o.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <input type="radio" name="offer" checked={selected === o.id} onChange={() => setSelected(o.id)} />
                    {o.primaryImage && <img src={o.primaryImage} alt="" className="h-10 w-10 rounded object-cover border border-gray-200" />}
                    <span className="text-sm text-gray-800 line-clamp-2">{o.name}</span>
                  </label>
                ))
              )}
            </div>

            <div className="mt-4 space-y-2">
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="radio" name="position" checked={position === 'first'} onChange={() => setPosition('first')} className="mt-0.5" />
                <span>
                  Ustaw jako <strong>zdjęcie główne</strong> <span className="text-xs text-gray-500">(tylko białe tło, bez napisów – wymóg Allegro)</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="radio" name="position" checked={position === 'last'} onChange={() => setPosition('last')} className="mt-0.5" />
                <span>
                  Dodaj na <strong>końcu galerii</strong>
                </span>
              </label>
            </div>

            <button onClick={publish} disabled={!selected || isPublishing} className="btn-primary w-full mt-4">
              {isPublishing ? 'Publikuję...' : 'Opublikuj'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
