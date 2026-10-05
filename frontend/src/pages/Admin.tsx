import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { adminApi, AdminUserRow } from '../services/api'
import { usePageTitle } from '../hooks/usePageTitle'
import AdminUserModal from '../components/AdminUserModal'
import { formatDateTime as dateTime, formatZl as zl } from '../utils/format'

const PAGE_SIZE = 20

const PROVIDER: Record<AdminUserRow['provider'], string> = { password: 'e-mail', google: 'Google', 'google+password': 'e-mail + Google' }

/** Spec 16: operator panel – accounts, usage, plans and an individual message to a user. */
export default function Admin() {
  usePageTitle('Panel administratora')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [openUserId, setOpenUserId] = useState<string | null>(null)

  // Search as you type, but not on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => adminApi.overview().then((r) => r.data) })
  const users = useQuery({
    queryKey: ['admin', 'users', { query, page }],
    queryFn: () => adminApi.users({ search: query || undefined, page, limit: PAGE_SIZE }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  const o = overview.data
  const tiles = o
    ? [
        { label: 'Konta', value: o.users.total, hint: `+${o.users.last30d} w 30 dni` },
        { label: 'Gotowe grafiki', value: o.generations.COMPLETED ?? 0, hint: `${o.staleGenerations} zawieszonych` },
        { label: 'Przychód', value: zl(o.revenue.totalGrosze), hint: `${zl(o.revenue.last30dGrosze)} w 30 dni` },
        { label: 'Aktywne abonamenty', value: o.subscriptions.active ?? 0, hint: `${o.demo.leads} leadów z demo` },
      ]
    : []

  return (
    <div className="px-4 py-6 sm:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Panel administratora</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {overview.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)
          : tiles.map((t) => (
              <div key={t.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500">{t.label}</p>
                <p className="text-xl font-semibold text-gray-900">{t.value}</p>
                <p className="text-xs text-gray-500">{t.hint}</p>
              </div>
            ))}
      </div>

      <div className="relative mb-4 max-w-md">
        <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Szukaj po adresie e-mail lub imieniu"
          aria-label="Szukaj użytkownika"
          className="input-field pl-9"
        />
      </div>

      {users.isError ? (
        <div role="alert" className="text-center py-10 bg-white rounded-xl border border-red-200">
          <p className="text-gray-700 mb-3">Nie udało się pobrać listy użytkowników.</p>
          <button onClick={() => users.refetch()} className="btn-secondary">
            Spróbuj ponownie
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-100 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Użytkownik</th>
                <th className="px-4 py-3 font-medium">Rejestracja</th>
                <th className="px-4 py-3 font-medium">Grafiki</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Kredyty</th>
                <th className="px-4 py-3 font-medium">Wpłaty</th>
                <th className="px-4 py-3 font-medium">Zgoda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Ładowanie…
                  </td>
                </tr>
              ) : users.data?.users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Brak użytkowników{query ? ` dla „${query}”` : ''}.
                  </td>
                </tr>
              ) : (
                users.data?.users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setOpenUserId(u.id)} className="text-left">
                        <span className="block font-medium text-blue-700 hover:underline break-all">{u.email}</span>
                        <span className="block text-xs text-gray-500">
                          {u.name ? `${u.name} · ` : ''}
                          {PROVIDER[u.provider]}
                          {!u.emailVerified && <span className="ml-1 text-amber-700">· niepotwierdzony</span>}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{dateTime(u.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {u.completedGenerations}
                      <span className="text-xs text-gray-500"> / {u.images} zdj.</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{u.plan ? `${u.plan.name} (${u.plan.status})` : 'brak'}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {u.credits} <span className="text-xs text-gray-500">+ {u.freeCreditsLeft} darm.</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{zl(u.paidTotalGrosze)}</td>
                    <td className="px-4 py-3">{u.marketingConsent ? <span className="text-green-700">tak</span> : <span className="text-gray-500">nie</span>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {users.data && users.data.pagination.pages > 1 && (
        <nav aria-label="Strony listy użytkowników" className="flex items-center justify-center gap-3 mt-4 text-sm">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm">
            Poprzednia
          </button>
          <span className="text-gray-600">
            Strona {users.data.pagination.page} z {users.data.pagination.pages} · {users.data.pagination.total} kont
          </span>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= users.data.pagination.pages} className="btn-secondary text-sm">
            Następna
          </button>
        </nav>
      )}

      {openUserId && <AdminUserModal userId={openUserId} onClose={() => setOpenUserId(null)} />}
    </div>
  )
}
