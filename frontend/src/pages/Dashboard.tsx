import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { imagesApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import ImageCard from '../components/ImageCard'
import ConsentPrompt from '../components/ConsentPrompt'
import { usePageTitle } from '../hooks/usePageTitle'
import { ArrowUpTrayIcon, SparklesIcon } from '@heroicons/react/24/outline'

const RECENT_LIMIT = 8

export default function Dashboard() {
  usePageTitle('Dashboard')
  const { user } = useAuth()
  const images = useQuery({
    queryKey: ['images', { page: 1, limit: RECENT_LIMIT }],
    queryFn: () => imagesApi.getAll(1, RECENT_LIMIT).then((r) => r.data),
  })

  return (
    <div className="px-4 py-6 sm:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Witaj, {user?.name || 'Użytkowniku'}! 👋</h1>
        <p className="text-gray-500 mt-1">Generuj profesjonalne grafiki produktowe dla swoich ofert na Allegro</p>
      </div>

      <ConsentPrompt />

      {/* Stats – the call-to-action takes its own row until the screen fits three cards (tablets, spec 17). */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 mb-8 items-start" data-testid="dashboard-stats">
        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
              <ArrowUpTrayIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{user?._count?.images ?? images.data?.pagination.total ?? 0}</p>
              <p className="text-sm text-gray-500">Przesłane zdjęcia</p>
            </div>
          </div>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
              <SparklesIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{user?.totalGenerations ?? 0}</p>
              <p className="text-sm text-gray-500">Wygenerowane grafiki</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-r from-blue-600 to-indigo-600 border-0 col-span-2 xl:col-span-1">
          <div className="text-white flex flex-col sm:flex-row xl:flex-col sm:items-center xl:items-start gap-3 sm:gap-6 xl:gap-3">
            <div className="flex-1">
              <p className="font-semibold mb-1">Dodaj nowe zdjęcie</p>
              <p className="text-blue-100 text-sm">Prześlij zdjęcie produktu i wygeneruj profesjonalne grafiki w wybranych stylach</p>
            </div>
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 bg-white text-blue-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-50 transition-colors self-start sm:self-auto xl:self-start whitespace-nowrap"
            >
              <ArrowUpTrayIcon className="h-4 w-4" />
              Prześlij zdjęcie
            </Link>
          </div>
        </div>
      </div>

      {/* Recent images */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Ostatnie zdjęcia</h2>
          <Link to="/gallery" className="text-sm text-blue-600 hover:text-blue-700">
            Zobacz wszystkie →
          </Link>
        </div>

        {images.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-xl aspect-square animate-pulse" />
            ))}
          </div>
        ) : images.isError ? (
          <div role="alert" className="text-center py-12 bg-white rounded-xl border border-red-200">
            <p className="text-gray-700 mb-3">Nie udało się pobrać Twoich zdjęć.</p>
            <button onClick={() => images.refetch()} className="btn-secondary">
              Spróbuj ponownie
            </button>
          </div>
        ) : images.data && images.data.images.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
            <ArrowUpTrayIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">Nie masz jeszcze żadnych zdjęć</p>
            <Link to="/upload" className="btn-primary">
              Prześlij pierwsze zdjęcie
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {images.data?.images.map((image) => (
              <ImageCard key={image.id} image={image} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
