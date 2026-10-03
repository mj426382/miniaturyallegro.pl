import { useState } from 'react'
import toast from 'react-hot-toast'
import { HandThumbUpIcon, HandThumbDownIcon } from '@heroicons/react/24/outline'
import { HandThumbUpIcon as ThumbUpSolid, HandThumbDownIcon as ThumbDownSolid } from '@heroicons/react/24/solid'
import { feedbackApi, FeedbackReason } from '../services/api'
import { track } from '../services/analytics'

const REASONS: Array<{ id: FeedbackReason; label: string }> = [
  { id: 'product-changed', label: 'Produkt wygląda inaczej niż w oryginale' },
  { id: 'artifacts', label: 'Błędy / artefakty na grafice' },
  { id: 'wrong-style', label: 'Nie pasuje do wybranego stylu' },
  { id: 'composition', label: 'Zła kompozycja lub kadr' },
  { id: 'text-or-logo', label: 'Dodany tekst, logo lub znak wodny' },
  { id: 'other', label: 'Inny powód' },
]

interface Props {
  generationId: string
  style: string
  initialRating: number | null | undefined
  onRated?: (rating: 1 | -1) => void
}

export default function FeedbackButtons({ generationId, style, initialRating, onRated }: Props) {
  const [rating, setRating] = useState<number | null>(initialRating ?? null)
  const [showReasons, setShowReasons] = useState(false)
  const [comment, setComment] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const submit = async (value: 1 | -1, reason?: FeedbackReason) => {
    setIsSaving(true)
    try {
      await feedbackApi.submit(generationId, value, reason, comment.trim() || undefined)
      setRating(value)
      setShowReasons(false)
      setComment('')
      onRated?.(value)
      track('feedback', { style, rating: value, reason: reason || '' })
      if (value === -1) toast.success('Dzięki! Twoja opinia pomaga nam poprawiać style.')
    } catch {
      toast.error('Nie udało się zapisać oceny')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mt-1">
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={() => submit(1)}
          disabled={isSaving}
          title="Dobra grafika"
          className={`p-1.5 rounded hover:bg-green-50 ${rating === 1 ? 'text-green-600' : 'text-gray-500 hover:text-green-600'}`}
        >
          {rating === 1 ? <ThumbUpSolid className="h-4 w-4" /> : <HandThumbUpIcon className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setShowReasons((v) => !v)}
          disabled={isSaving}
          title="Coś jest nie tak"
          className={`p-1.5 rounded hover:bg-red-50 ${rating === -1 ? 'text-red-600' : 'text-gray-500 hover:text-red-600'}`}
        >
          {rating === -1 ? <ThumbDownSolid className="h-4 w-4" /> : <HandThumbDownIcon className="h-4 w-4" />}
        </button>
      </div>
      {showReasons && (
        <div className="mt-1 border border-gray-200 rounded-lg p-2 space-y-1 bg-gray-50">
          <p className="text-[11px] text-gray-500 mb-1">Co było nie tak?</p>
          {REASONS.map((r) => (
            <button key={r.id} onClick={() => submit(-1, r.id)} disabled={isSaving} className="block w-full text-left text-xs text-gray-700 hover:text-red-700 hover:bg-white rounded px-1.5 py-1">
              {r.label}
            </button>
          ))}
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={300}
            placeholder="Komentarz (opcjonalnie)"
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 mt-1"
          />
        </div>
      )}
    </div>
  )
}
