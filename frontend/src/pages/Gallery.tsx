import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { imagesApi, ImageSummary } from '../services/api'
import ImageCard from '../components/ImageCard'
import BulkDescriptionsModal, { BulkPhoto } from '../components/BulkDescriptionsModal'
import { useZipDownload } from '../hooks/useZipDownload'
import { usePageTitle } from '../hooks/usePageTitle'
import { useConfirm } from '../hooks/useConfirm'
import { ArrowUpTrayIcon, ArchiveBoxArrowDownIcon, CheckCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { countLabel } from '../utils/plural'

const PAGE_SIZE = 12

export default function Gallery() {
  usePageTitle('Galeria')
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  /** Spec 15: selection survives paging – id → label for the progress list. */
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Map<string, string>>(new Map())
  const [bulkPhotos, setBulkPhotos] = useState<BulkPhoto[] | null>(null)
  const zip = useZipDownload()

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

  const photoLabel = (image: ImageSummary) => `Zdjęcie z ${new Date(image.createdAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}`
  const toggle = (image: ImageSummary) =>
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(image.id)) next.delete(image.id)
      else next.set(image.id, photoLabel(image))
      return next
    })
  const selectPage = () =>
    setSelected((prev) => {
      const next = new Map(prev)
      for (const image of images.data?.images ?? []) next.set(image.id, photoLabel(image))
      return next
    })
  const stopSelecting = () => {
    setSelecting(false)
    setSelected(new Map())
  }
  const selectedIds = [...selected.keys()]

  return (
    <div className="px-4 py-6 sm:p-8">
      <div className="flex items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Galeria zdjęć</h1>
          <p className="text-gray-500 mt-1">{countLabel(total, 'przesłane zdjęcie', 'przesłane zdjęcia', 'przesłanych zdjęć')}</p>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && !selecting && (
            <button type="button" onClick={() => setSelecting(true)} className="btn-secondary flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5" />
              Zaznacz
            </button>
          )}
          <Link to="/upload" aria-label="Prześlij nowe" className="btn-primary flex items-center gap-2">
            <ArrowUpTrayIcon className="h-5 w-5" aria-hidden="true" />
            <span className="hidden sm:inline">Prześlij nowe</span>
          </Link>
        </div>
      </div>

      {selecting && (
        <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
          <span className="text-gray-700">
            Zaznaczono: <strong>{selected.size}</strong>
          </span>
          <button type="button" onClick={selectPage} className="text-blue-600 hover:underline">
            Zaznacz wszystkie na stronie
          </button>
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Map())} className="text-gray-500 hover:underline">
              Wyczyść zaznaczenie
            </button>
          )}
        </div>
      )}

      {images.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
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
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {images.data?.images.map((image) => (
              <ImageCard key={image.id} image={image} onDelete={() => deleteImage(image)} selectable={selecting} selected={selected.has(image.id)} onToggleSelect={() => toggle(image)} />
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

      {selecting && (
        <div
          className="sticky bottom-0 z-30 -mx-4 sm:-mx-8 mt-6 px-4 sm:px-8 py-3 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] flex flex-wrap items-center gap-2"
          role="toolbar"
          aria-label="Akcje dla zaznaczonych zdjęć"
        >
          <span className="text-sm text-gray-700 mr-auto">Zaznaczono {selected.size}</span>
          <button type="button" onClick={() => zip.download(selectedIds)} disabled={!selected.size || zip.isPreparing} className="btn-secondary flex items-center gap-1.5 text-sm">
            <ArchiveBoxArrowDownIcon className="h-4 w-4" />
            {zip.isPreparing ? 'Przygotowuję...' : 'Pobierz ZIP'}
          </button>
          <button
            type="button"
            onClick={() => setBulkPhotos(selectedIds.map((id) => ({ id, label: selected.get(id)! })))}
            disabled={!selected.size}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <DocumentTextIcon className="h-4 w-4" />
            Napisz opisy
          </button>
          <button type="button" onClick={stopSelecting} className="btn-ghost text-sm">
            Anuluj
          </button>
        </div>
      )}

      {bulkPhotos && <BulkDescriptionsModal photos={bulkPhotos} onClose={() => setBulkPhotos(null)} onFinished={() => queryClient.invalidateQueries({ queryKey: ['images'] })} />}
    </div>
  )
}
