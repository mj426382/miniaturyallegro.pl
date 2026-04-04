import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { imagesApi, generationApi } from '../services/api'
import toast from 'react-hot-toast'
import { SparklesIcon, ArrowDownTrayIcon, CheckCircleIcon, XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline'

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
  const [basePrompt, setBasePrompt] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [isCustomGenerating, setIsCustomGenerating] = useState(false)
  const [referenceFile, setReferenceFile] = useState<File | null>(null)
  const [referencePreview, setReferencePreview] = useState<string | null>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)
  const pollIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    loadData()
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
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
      await generationApi.startGeneration(imageId!, basePrompt.trim() || undefined)
      toast.success('Generowanie rozpoczęte! To może potrwać kilka minut.')
      startPolling()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Błąd generowania')
      setIsGenerating(false)
    }
  }

  const handleReferenceFile = (file: File | null) => {
    if (!file) {
      setReferenceFile(null)
      setReferencePreview(null)
      return
    }
    setReferenceFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setReferencePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const startCustomGeneration = async () => {
    if (!customPrompt.trim()) return
    setIsCustomGenerating(true)
    try {
      await generationApi.startCustomGeneration(imageId!, customPrompt, referenceFile || undefined)
      toast.success('Generowanie własnego zdjęcia rozpoczęte!')
      setCustomPrompt('')
      setReferenceFile(null)
      setReferencePreview(null)
      startPolling()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Błąd generowania')
    } finally {
      setIsCustomGenerating(false)
    }
  }

  const startPolling = () => {
    if (pollIntervalRef.current) return // already polling
    const interval = window.setInterval(async () => {
      const { data } = await generationApi.getResults(imageId!)
      setGenerations(data)
      const allDone = data.every(
        (g: any) => g.status === 'COMPLETED' || g.status === 'FAILED',
      )
      if (allDone) {
        clearInterval(interval)
        pollIntervalRef.current = null
        setIsGenerating(false)
        toast.success('Generowanie zakończone!')
      }
    }, 3000)
    pollIntervalRef.current = interval
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

          {/* Custom prompt */}
          <div className="mt-4 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startCustomGeneration()}
                placeholder="Opisz własny styl, np. 'na drewnianym stole w lesie'"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={500}
              />
              <button
                onClick={startCustomGeneration}
                disabled={isCustomGenerating || !customPrompt.trim()}
                className="btn-primary flex items-center gap-1 whitespace-nowrap"
              >
                <SparklesIcon className="h-4 w-4" />
                {isCustomGenerating ? 'Generowanie...' : 'Generuj własne'}
              </button>
            </div>

            {/* Reference image picker */}
            <div className="flex items-center gap-3">
              <input
                ref={referenceInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleReferenceFile(e.target.files?.[0] ?? null)}
              />
              {referencePreview ? (
                <div className="relative inline-flex items-center gap-2">
                  <img src={referencePreview} alt="Referencja" className="h-12 w-12 object-cover rounded-lg border border-gray-300" />
                  <span className="text-xs text-gray-500">Zdjęcie referencyjne</span>
                  <button
                    onClick={() => { handleReferenceFile(null); if (referenceInputRef.current) referenceInputRef.current.value = '' }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => referenceInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 border border-dashed border-gray-300 rounded-lg px-3 py-1.5 hover:border-blue-400 transition-colors"
                >
                  <PhotoIcon className="h-4 w-4" />
                  Dodaj zdjęcie referencyjne (opcjonalnie)
                </button>
              )}
            </div>
          </div>

          {hasResults ? (
            <div className="mt-3 flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
              <span className="text-sm text-gray-600">
                {completedCount} z {generations.length} wygenerowanych
              </span>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Bazowy prompt dla wszystkich 12 stylów <span className="text-gray-400 font-normal">(opcjonalnie)</span>
                </label>
                <textarea
                  value={basePrompt}
                  onChange={(e) => setBasePrompt(e.target.value)}
                  placeholder="np. 'zdjęcie na jasnym tle, produkt w centrum kadru, elegancki wygląd'"
                  rows={2}
                  maxLength={400}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                {basePrompt.trim() && (
                  <p className="text-xs text-blue-600 mt-1">Ten opis zostanie dołączony do każdego z 12 stylów generacji.</p>
                )}
              </div>
              <button
                onClick={startGeneration}
                disabled={isGenerating}
                className="btn-primary flex items-center gap-2"
              >
                <SparklesIcon className="h-5 w-5" />
                {isGenerating ? 'Generowanie...' : 'Generuj 12 miniaturek'}
              </button>
            </div>
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
                  <span className="text-xs font-medium text-gray-700">{gen.style === 'custom' ? '✨ Własny styl' : gen.style}</span>
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
