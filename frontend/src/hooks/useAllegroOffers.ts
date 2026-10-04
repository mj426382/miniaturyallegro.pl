import { useCallback, useEffect, useState } from 'react'
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
