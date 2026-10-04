import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { allegroApi, AllegroOffer } from '../services/api'

/** Loads the seller's active offers (with search) and tells whether the account is connected. */
export function useAllegroOffers() {
  const [offers, setOffers] = useState<AllegroOffer[]>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [connected, setConnected] = useState<boolean | null>(null)

  const load = useCallback(async (name = '') => {
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
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { offers, query, setQuery, isLoading, connected, load }
}

interface Props {
  state: ReturnType<typeof useAllegroOffers>
  selected: string | null
  onSelect: (offerId: string) => void
}

/** Search box + radio list of offers; a hint with a link when no seller account is connected. */
export default function AllegroOfferPicker({ state, selected, onSelect }: Props) {
  const { offers, query, setQuery, isLoading, connected, load } = state

  if (connected === false) {
    return (
      <p className="text-sm text-gray-600">
        Najpierw połącz konto Allegro w zakładce{' '}
        <Link to="/allegro" className="text-blue-600 underline">
          Allegro
        </Link>
        .
      </p>
    )
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          load(query)
        }}
        className="flex gap-2 mb-3"
      >
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj oferty" aria-label="Szukaj oferty" className="input-field text-sm" />
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
              <input type="radio" name="offer" checked={selected === o.id} onChange={() => onSelect(o.id)} />
              {o.primaryImage && <img src={o.primaryImage} alt="" className="h-10 w-10 rounded object-cover border border-gray-200" />}
              <span className="text-sm text-gray-800 line-clamp-2">{o.name}</span>
            </label>
          ))
        )}
      </div>
    </>
  )
}
