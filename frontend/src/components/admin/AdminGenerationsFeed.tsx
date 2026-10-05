import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../../services/api'
import AdminGraphicTile from './AdminGraphicTile'
import { countLabel } from '../../utils/plural'

interface Props {
  styleNames: Record<string, string>
  onOpenUser: (userId: string) => void
}

type Filter = 'all' | 'down' | 'up' | 'rated' | 'failed'

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'down', label: 'Kciuk w dół' },
  { id: 'up', label: 'Kciuk w górę' },
  { id: 'rated', label: 'Ocenione' },
  { id: 'failed', label: 'Nieudane' },
]

/** Spec 16: latest graphics of all accounts for quality review. */
export default function AdminGenerationsFeed({ styleNames, onOpenUser }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const params = filter === 'failed' ? { status: 'FAILED' } : filter === 'all' ? {} : { rating: filter }
  const query = useQuery({
    queryKey: ['admin', 'generations', filter, page],
    queryFn: () => adminApi.generations({ ...params, page }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label htmlFor="generations-filter" className="text-sm text-gray-700">
          Pokaż
        </label>
        <select
          id="generations-filter"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as Filter)
            setPage(1)
          }}
          className="input-field text-sm w-auto"
        >
          {FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        {query.data && <span className="text-sm text-gray-500">{countLabel(query.data.pagination.total, 'grafika', 'grafiki', 'grafik')}</span>}
      </div>

      {query.isLoading ? (
        <p className="text-sm text-gray-500">Ładowanie grafik…</p>
      ) : query.isError ? (
        <div role="alert" className="text-sm text-red-600">
          Nie udało się pobrać grafik.{' '}
          <button type="button" onClick={() => query.refetch()} className="underline">
            Spróbuj ponownie
          </button>
        </div>
      ) : query.data!.generations.length === 0 ? (
        <p className="text-sm text-gray-500">Brak grafik dla tego filtra.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {query.data!.generations.map((g) => (
            <AdminGraphicTile key={g.id} graphic={g} styleName={g.style === 'custom' ? 'Własny styl' : (styleNames[g.style ?? ''] ?? g.style ?? '–')}>
              <div className="flex items-center gap-1.5 pt-1">
                <a href={g.image.originalUrl} target="_blank" rel="noopener noreferrer" aria-label="Oryginał" className="shrink-0">
                  <img src={g.image.originalUrl} alt="Oryginał" loading="lazy" className="h-6 w-6 rounded object-cover border border-gray-200" />
                </a>
                <button type="button" onClick={() => onOpenUser(g.user.id)} className="text-blue-700 hover:underline truncate text-left">
                  {g.user.email}
                </button>
              </div>
            </AdminGraphicTile>
          ))}
        </div>
      )}

      {query.data && query.data.pagination.pages > 1 && (
        <nav aria-label="Strony grafik" className="flex items-center justify-center gap-3 mt-4 text-sm">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm">
            Poprzednia
          </button>
          <span className="text-gray-600">
            Strona {query.data.pagination.page} z {query.data.pagination.pages}
          </span>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= query.data.pagination.pages} className="btn-secondary text-sm">
            Następna
          </button>
        </nav>
      )}
    </div>
  )
}
