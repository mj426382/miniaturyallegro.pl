import { useState, useEffect } from 'react'
import { imagesApi } from '../services/api'
import ImageCard from '../components/ImageCard'
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'

export default function Gallery() {
  const [images, setImages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 })

  useEffect(() => {
    loadImages(1)
  }, [])

  const loadImages = async (page: number) => {
    setIsLoading(true)
    try {
      const { data } = await imagesApi.getAll(page, 12)
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
      <div className="flex items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Galeria zdjęć</h1>
          <p className="text-gray-500 mt-1">
            {pagination.total} przesłanych zdjęć
          </p>
        </div>
        <Link to="/upload" className="btn-primary flex items-center gap-2">
          <ArrowUpTrayIcon className="h-5 w-5" />
          Prześlij nowe
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-xl aspect-square animate-pulse" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <ArrowUpTrayIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            Brak zdjęć w galerii
          </p>
          <p className="text-gray-500 mb-6">
            Prześlij pierwsze zdjęcie produktu, aby zacząć
          </p>
          <Link to="/upload" className="btn-primary">
            Prześlij zdjęcie
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image) => (
              <ImageCard key={image.id} image={image} />
            ))}
          </div>

          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: pagination.pages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => loadImages(i + 1)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium ${
                    pagination.page === i + 1
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
