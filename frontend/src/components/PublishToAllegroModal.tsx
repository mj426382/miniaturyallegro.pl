import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { XMarkIcon, ShoppingBagIcon } from '@heroicons/react/24/outline'
import { allegroApi } from '../services/api'
import { track } from '../services/analytics'
import AllegroOfferPicker, { useAllegroOffers } from './AllegroOfferPicker'

interface Props {
  generationId: string
  style: string
  /** Offer the source photo was imported from (if any) – preselected. */
  defaultOfferId?: string | null
  onClose: () => void
}

export default function PublishToAllegroModal({ generationId, style, defaultOfferId, onClose }: Props) {
  const offers = useAllegroOffers()
  const [selected, setSelected] = useState<string | null>(defaultOfferId ?? null)
  const [position, setPosition] = useState<'first' | 'last'>(style === 'white-bg' ? 'first' : 'last')
  const [isPublishing, setIsPublishing] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

        <AllegroOfferPicker state={offers} selected={selected} onSelect={setSelected} />

        {offers.connected !== false && (
          <>
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
