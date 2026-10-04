import { AdjustmentsHorizontalIcon, ArrowDownTrayIcon, ArrowPathIcon, ListBulletIcon, ShoppingBagIcon, SparklesIcon } from '@heroicons/react/24/outline'
import ActionMenu, { ActionMenuItem } from '../ActionMenu'
import FeedbackButtons from '../FeedbackButtons'
import type { Generation } from '../../hooks/useGenerations'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Oczekuje',
  PROCESSING: 'Generowanie...',
  COMPLETED: 'Gotowe',
  FAILED: 'Błąd',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
}

interface Props {
  generation: Generation
  styleName: string
  onPrefetch: () => void
  onDownload: () => void
  onExport: () => void
  /** Spec 14: features / dimensions infographic for an additional offer photo. */
  onInfographic: () => void
  onRework: () => void
  reworking: boolean
  /** Only offered once a seller account is connected. */
  onPublish?: () => void
  onRetry: () => void
  onRated: (rating: number) => void
}

/** One generated graphic: preview, status, primary download, secondary actions in a menu, feedback. */
export default function ResultCard({ generation: gen, styleName, onPrefetch, onDownload, onExport, onInfographic, onRework, reworking, onPublish, onRetry, onRated }: Props) {
  const ready = gen.status === 'COMPLETED' && Boolean(gen.url)
  const items: ActionMenuItem[] = [
    { label: 'Eksport i edycja', icon: <AdjustmentsHorizontalIcon className="h-4 w-4" />, onSelect: onExport },
    { label: 'Infografika', icon: <ListBulletIcon className="h-4 w-4" />, onSelect: onInfographic },
    { label: 'Przeróbka', icon: <ArrowPathIcon className="h-4 w-4" />, disabled: reworking, onSelect: onRework },
    ...(onPublish ? [{ label: 'Opublikuj na Allegro', icon: <ShoppingBagIcon className="h-4 w-4" />, onSelect: onPublish }] : []),
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200" onPointerEnter={() => ready && onPrefetch()} onTouchStart={() => ready && onPrefetch()}>
      <div className="aspect-square bg-gray-100 relative rounded-t-xl overflow-hidden">
        {ready ? (
          <img src={gen.url!} alt={styleName} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {gen.status === 'PROCESSING' ? <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /> : <SparklesIcon className="h-12 w-12 text-gray-300" />}
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-xs font-medium text-gray-700 truncate">{gen.style === 'custom' ? '✨ Własny styl' : styleName}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[gen.status]}`}>{STATUS_LABELS[gen.status]}</span>
        </div>
        {ready && (
          <>
            <div className="flex items-center gap-2 mt-2">
              <button onClick={onDownload} className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm py-1.5">
                <ArrowDownTrayIcon className="h-4 w-4" />
                Pobierz
              </button>
              <ActionMenu label="Więcej akcji" items={items} />
            </div>
            <FeedbackButtons generationId={gen.id} style={gen.style} initialRating={gen.rating} onRated={onRated} />
          </>
        )}
        {gen.status === 'FAILED' && (
          <button onClick={onRetry} className="flex items-center justify-center gap-1 w-full text-xs text-red-600 hover:text-red-700 py-1.5 rounded hover:bg-red-50 transition-colors mt-1">
            <ArrowPathIcon className="h-3.5 w-3.5" />
            Ponów (kredyt zwrócony)
          </button>
        )}
      </div>
    </div>
  )
}
