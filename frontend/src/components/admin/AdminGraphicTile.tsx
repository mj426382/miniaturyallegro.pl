import { HandThumbDownIcon, HandThumbUpIcon, PhotoIcon } from '@heroicons/react/24/outline'
import type { AdminGraphic } from '../../services/api'
import { GENERATION_STATUS_LABELS, ratingReasonLabel } from '../../utils/adminLabels'
import { formatDateTime } from '../../utils/format'

interface Props {
  graphic: AdminGraphic
  /** Style id → display name (from the styles catalogue). */
  styleName: string
  /** Extra content under the tile (e.g. the account in the global feed). */
  children?: React.ReactNode
}

/** One graphic in the admin views: thumbnail linking to the full size, status, style and rating. */
export default function AdminGraphicTile({ graphic, styleName, children }: Props) {
  const reason = ratingReasonLabel(graphic.ratingReason)
  return (
    <figure className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {graphic.url ? (
        <a href={graphic.url} target="_blank" rel="noopener noreferrer" aria-label={`Pełny rozmiar: ${styleName}`} className="block aspect-square bg-gray-100">
          <img src={graphic.url} alt={styleName} loading="lazy" className="w-full h-full object-cover" />
        </a>
      ) : (
        <div className="aspect-square bg-gray-100 flex items-center justify-center">
          <PhotoIcon className="h-8 w-8 text-gray-300" aria-hidden="true" />
        </div>
      )}
      <figcaption className="p-2 text-xs space-y-0.5">
        <p className="font-medium text-gray-800 truncate">{styleName}</p>
        <p className="text-gray-500">
          {GENERATION_STATUS_LABELS[graphic.status] ?? graphic.status} · {formatDateTime(graphic.createdAt)}
        </p>
        {graphic.rating === 1 && (
          <p className="text-green-700 flex items-center gap-1">
            <HandThumbUpIcon className="h-3.5 w-3.5" aria-hidden="true" /> ocena pozytywna
          </p>
        )}
        {graphic.rating === -1 && (
          <p className="text-red-700 flex items-start gap-1">
            <HandThumbDownIcon className="h-3.5 w-3.5 shrink-0 mt-px" aria-hidden="true" /> {reason ?? 'ocena negatywna'}
          </p>
        )}
        {children}
      </figcaption>
    </figure>
  )
}
