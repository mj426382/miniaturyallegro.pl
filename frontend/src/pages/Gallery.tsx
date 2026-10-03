import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { imagesApi, ImageSummary } from '../services/api'
import ImageCard from '../components/ImageCard'
import { usePageTitle } from '../hooks/usePageTitle'
import { useConfirm } from '../hooks/useConfirm'
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline'

const PAGE_SIZE = 12

export default function Gallery() {
  usePageTitle('Galeria')
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const images = useQuery({
    queryKey: ['images', { page, limit: PAGE_SIZE }],
    queryFn: () => imagesApi.getAll(page, PAGE_SIZE).then((r) => r.data),
  })

  const remove = useMutation({
    mutationFn: (id: string) => imagesApi.delete(id),
    onSuccess: () => {
      toast.success('Zdjęcie usunięte')
      queryClient.invalidateQueries({ queryKey: ['images'] })
    },
    onError: () => toast.error('Nie udało się usunąć zdjęcia'),
  })

  const deleteImage = async (image: ImageSummary) => {
    const ok = await confirm({
      title: 'Usunąć to zdjęcie?',
      message: 'Zdjęcie, wszystkie wygenerowane dla niego grafiki i opis oferty zostaną trwale usunięte. Wykorzystanych kredytów nie zwracamy.',
      confirmLabel: 'Usuń zdjęcie',
      danger: true,
    })
    if (ok) remove.mutate(image.id)
  }

  const total = images.data?.pagination.total ?? 0
  const pages = images.data?.pagination.pages ?? 1

  return (
    <div className="px-4 py-6 sm:p-8">
      <div className="flex items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Galeria zdjęć</h1>
          <p className="text-gray-500 mt-1">{total} przesłanych zdjęć</p>
        </div>
        <Link to="/upload" className="btn-primary flex items-center gap-2">
          <ArrowUpTrayIcon className="h-5 w-5" />
          Prześlij nowe
        </Link>
      </div>

      {images.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-xl aspect-square animate-pulse" />
          ))}
        </div>
      ) : images.isError ? (
        <div role="alert" className="text-center py-12 bg-white rounded-xl border border-red-200">
          <p className="text-gray-700 mb-3">Nie udało się pobrać galerii.</p>
          <button onClick={() => images.refetch()} className="btn-secondary">
            Spróbuj ponownie
          </button>
        </div>
      ) : images.data && images.data.images.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <ArrowUpTrayIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">Brak zdjęć w galerii</p>
          <p className="text-gray-500 mb-6">Prześlij pierwsze zdjęcie produktu, aby zacząć</p>
          <Link to="/upload" className="btn-primary">
            Prześlij zdjęcie
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.data?.images.map((image) => (
              <ImageCard key={image.id} image={image} onDelete={() => deleteImage(image)} />
            ))}
          </div>

          {pages > 1 && (
            <nav aria-label="Strony galerii" className="flex justify-center gap-2 mt-8">
              {Array.from({ length: pages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  aria-current={page === i + 1 ? 'page' : undefined}
                  className={`w-9 h-9 rounded-lg text-sm font-medium ${page === i + 1 ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
                >
                  {i + 1}
                </button>
              ))}
            </nav>
          )}
        </>
      )}
    </div>
  )
}
