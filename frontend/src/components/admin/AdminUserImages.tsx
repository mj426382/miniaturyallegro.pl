import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../../services/api'
import { formatDateTime } from '../../utils/format'
import AdminGraphicTile from './AdminGraphicTile'
import { countLabel } from '../../utils/plural'

interface Props {
  userId: string
  styleNames: Record<string, string>
}

/** Spec 16: photos of one account with all their graphics (each view is logged on the server). */
export default function AdminUserImages({ userId, styleNames }: Props) {
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['admin', 'user-images', userId, page],
    queryFn: () => adminApi.userImages(userId, page).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  if (query.isLoading) return <p className="text-sm text-gray-500">Ładowanie zdjęć…</p>
  if (query.isError) return <p className="text-sm text-red-600">Nie udało się pobrać zdjęć.</p>
  const data = query.data!
  if (data.images.length === 0) return <p className="text-sm text-gray-500">Ten użytkownik nie przesłał jeszcze zdjęć.</p>

  return (
    <div className="space-y-5">
      {data.images.map((image) => (
        <section key={image.id} aria-label={`Zdjęcie z ${formatDateTime(image.createdAt)}`} className="border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-3 mb-3">
            <a href={image.originalUrl} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label="Oryginał w pełnym rozmiarze">
              <img src={image.originalUrl} alt="Oryginał" loading="lazy" className="h-14 w-14 rounded-md object-cover border border-gray-200" />
            </a>
            <div className="min-w-0 text-sm">
              <p className="text-gray-800">Oryginał · {formatDateTime(image.createdAt)}</p>
              <p className="text-xs text-gray-500 truncate">
                {countLabel(image.generations.length, 'grafika', 'grafiki', 'grafik')}
                {image.descriptionTitle ? ` · opis: ${image.descriptionTitle}` : ' · bez opisu'}
                {image.allegroOfferId ? ` · oferta Allegro ${image.allegroOfferId}` : ''}
              </p>
            </div>
          </div>
          {image.generations.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {image.generations.map((g) => (
                <AdminGraphicTile key={g.id} graphic={g} styleName={g.style === 'custom' ? 'Własny styl' : (styleNames[g.style ?? ''] ?? g.style ?? '–')} />
              ))}
            </div>
          )}
        </section>
      ))}
      {data.pagination.pages > 1 && (
        <nav aria-label="Strony zdjęć użytkownika" className="flex items-center justify-center gap-3 text-sm">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm">
            Poprzednie
          </button>
          <span className="text-gray-600">
            {data.pagination.page} / {data.pagination.pages}
          </span>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= data.pagination.pages} className="btn-secondary text-sm">
            Następne
          </button>
        </nav>
      )}
    </div>
  )
}
