import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { imagesApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import ImageCard from '../components/ImageCard'
import { ArrowUpTrayIcon, SparklesIcon } from '@heroicons/react/24/outline'

export default function Dashboard() {
  const { user } = useAuth()
  const [images, setImages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 })

  useEffect(() => {
    loadImages()
  }, [])

  const loadImages = async (page = 1) => {
    try {
      const { data } = await imagesApi.getAll(page, 8)
      setImages(data.images)
      setPagination(data.pagination)
    } catch {
      // handle error
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Witaj, {user?.name || 'Użytkowniku'}! 👋
        </h1>
        <p className="text-gray-500 mt-1">
          Generuj profesjonalne grafiki produktowe dla swoich ofert na Allegro
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <ArrowUpTrayIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{user?._count?.images ?? pagination.total}</p>
              <p className="text-sm text-gray-500">Przesłane zdjęcia</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <SparklesIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {user?.totalGenerations ?? 0}
              </p>
              <p className="text-sm text-gray-500">Wygenerowane grafiki</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-r from-blue-600 to-indigo-600 border-0">
          <div className="text-white">
            <p className="font-semibold mb-1">Dodaj nowe zdjęcie</p>
            <p className="text-blue-100 text-sm mb-3">
              Prześlij zdjęcie produktu i wygeneruj profesjonalne grafiki w 6 stylach
            </p>
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 bg-white text-blue-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-50 transition-colors"
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

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-xl aspect-square animate-pulse" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
            <ArrowUpTrayIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">Nie masz jeszcze żadnych zdjęć</p>
            <Link to="/upload" className="btn-primary">
              Prześlij pierwsze zdjęcie
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {images.map((image) => (
              <ImageCard key={image.id} image={image} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
