import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { imagesApi, generationApi } from '../services/api'
import toast from 'react-hot-toast'
import { SparklesIcon, ArrowDownTrayIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Oczekuje',
  PROCESSING: 'Generowanie...',
  COMPLETED: 'Gotowe',
  FAILED: 'Błąd',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  PROCESSING: 'bg-blue-100 text-blue-600',
  COMPLETED: 'bg-green-100 text-green-600',
  FAILED: 'bg-red-100 text-red-600',
}

export default function Generate() {
  const { imageId } = useParams<{ imageId: string }>()
  const [image, setImage] = useState<any>(null)
  const [generations, setGenerations] = useState<any[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [pollInterval, setPollInterval] = useState<number | null>(null)

  useEffect(() => {
    loadData()
    return () => { if (pollInterval) clearInterval(pollInterval) }
  }, [imageId])

  const loadData = async () => {
    try {
      const { data } = await imagesApi.getById(imageId!)
      setImage(data)
      setGenerations(data.generations || [])
    } catch {
      toast.error('Nie udało się załadować zdjęcia')
    } finally {
      setIsLoading(false)
    }
  }

  const startGeneration = async () => {
    setIsGenerating(true)
    try {
      await generationApi.startGeneration(imageId!)
      toast.success('Generowanie rozpoczęte! To może potrwać kilka minut.')
      startPolling()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Błąd generowania')
      setIsGenerating(false)
    }
  }

  const startPolling = () => {
    const interval = window.setInterval(async () => {
      const { data } = await generationApi.getResults(imageId!)
      setGenerations(data)
      const allDone = data.every(
        (g: any) => g.status === 'COMPLETED' || g.status === 'FAILED',
      )
      if (allDone) {
        clearInterval(interval)
        setPollInterval(null)
        setIsGenerating(false)
        toast.success('Generowanie zakończone!')
      }
    }, 3000)
    setPollInterval(interval)
  }

  const downloadImage = async (url: string, styleName: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `miniaturka-${styleName}.jpg`
    link.click()
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const completedCount = generations.filter((g) => g.status === 'COMPLETED').length
  const hasResults = generations.length > 0

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start gap-6">
        {image && (
          <img
            src={image.originalUrl}
            alt="Product"
            className="w-32 h-32 object-cover rounded-xl border border-gray-200"
          />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Generator miniaturek</h1>
          <p className="text-gray-500 mt-1">
            Wygeneruj 12 profesjonalnych wariantów miniaturek dla Allegro
          </p>

          {hasResults ? (
            <div className="mt-3 flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
              <span className="text-sm text-gray-600">
                {completedCount} z {generations.length} wygenerowanych
              </span>
            </div>
          ) : (
            <button
              onClick={startGeneration}
              disabled={isGenerating}
              className="mt-4 btn-primary flex items-center gap-2"
            >
              <SparklesIcon className="h-5 w-5" />
              {isGenerating ? 'Generowanie...' : 'Generuj 12 miniaturek'}
            </button>
          )}
        </div>
      </div>

      {hasResults && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {generations.map((gen) => (
            <div key={gen.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="aspect-square bg-gray-100 relative">
                {gen.status === 'COMPLETED' && gen.url ? (
                  <img
                    src={gen.url}
                    alt={gen.style}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {gen.status === 'PROCESSING' ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    ) : (
                      <SparklesIcon className="h-12 w-12 text-gray-300" />
                    )}
                  </div>
                )}
              </div>

              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700">{gen.style}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[gen.status]}`}>
                    {STATUS_LABELS[gen.status]}
                  </span>
                </div>

                {gen.status === 'COMPLETED' && gen.url && (
                  <button
                    onClick={() => downloadImage(gen.url, gen.style)}
                    className="w-full flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-700 py-1"
                  >
                    <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                    Pobierz
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasResults && !isGenerating && (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <SparklesIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            Kliknij "Generuj 12 miniaturek" aby rozpocząć
          </p>
        </div>
      )}
    </div>
  )
}
