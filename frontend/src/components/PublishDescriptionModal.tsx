import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { XMarkIcon, ShoppingBagIcon } from '@heroicons/react/24/outline'
import { allegroApi } from '../services/api'
import { track } from '../services/analytics'
import AllegroOfferPicker from './AllegroOfferPicker'
import { useAllegroOffers } from '../hooks/useAllegroOffers'

interface Props {
  imageId: string
  /** Offer the photo was imported from (if any) – preselected. */
  defaultOfferId?: string | null
  onClose: () => void
}

/** Spec 08: sends the saved offer copy (description, optionally the title) to an Allegro offer. */
export default function PublishDescriptionModal({ imageId, defaultOfferId, onClose }: Props) {
  const offers = useAllegroOffers()
  const [selected, setSelected] = useState<string | null>(defaultOfferId ?? null)
  // "Prepend" keeps whatever the seller already has in the description (images, tables).
  const [mode, setMode] = useState<'replace' | 'prepend'>('prepend')
  const [updateTitle, setUpdateTitle] = useState(false)
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
      await allegroApi.publishDescription(selected, imageId, mode, updateTitle)
      track('allegro_publish_description', { mode, title: updateTitle })
      toast.success(updateTitle ? 'Tytuł i opis zaktualizowane w ofercie Allegro.' : 'Opis zaktualizowany w ofercie Allegro.')
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
      <div role="dialog" aria-modal="true" aria-labelledby="publish-description-title" className="relative bg-white rounded-2xl w-full max-w-xl p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 id="publish-description-title" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingBagIcon className="h-5 w-5 text-blue-600" /> Opublikuj opis w Allegro
          </h2>
          <button ref={closeRef} onClick={onClose} aria-label="Zamknij" className="text-gray-500 hover:text-gray-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <AllegroOfferPicker state={offers} selected={selected} onSelect={setSelected} />

        {offers.connected !== false && (
          <>
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">Sposób publikacji opisu</legend>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="radio" name="description-mode" checked={mode === 'prepend'} onChange={() => setMode('prepend')} className="mt-0.5" />
                <span>
                  <strong>Dodaj na początku</strong> <span className="text-xs text-gray-500">(obecny opis oferty zostaje pod spodem)</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="radio" name="description-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} className="mt-0.5" />
                <span>
                  <strong>Zastąp opis</strong> <span className="text-xs text-gray-500">(cały obecny opis, także zdjęcia w opisie, zostanie usunięty)</span>
                </span>
              </label>
            </fieldset>
            <label className="flex items-start gap-2 text-sm text-gray-700 mt-3">
              <input type="checkbox" checked={updateTitle} onChange={(e) => setUpdateTitle(e.target.checked)} className="mt-0.5" />
              <span>Zmień też tytuł oferty</span>
            </label>

            <button onClick={publish} disabled={!selected || isPublishing} className="btn-primary w-full mt-4">
              {isPublishing ? 'Publikuję...' : 'Opublikuj opis'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
