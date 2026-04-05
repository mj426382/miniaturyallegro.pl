import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { imagesApi, generationApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  SparklesIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XMarkIcon,
  PhotoIcon,
  CreditCardIcon,
  Squares2X2Icon,
  PencilSquareIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

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

type Tab = 'auto' | 'custom'

export default function Generate() {
  const { imageId } = useParams<{ imageId: string }>()
  const navigate = useNavigate()
  const [image, setImage] = useState<any>(null)
  const [generations, setGenerations] = useState<any[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('auto')
  const [basePrompt, setBasePrompt] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [isCustomGenerating, setIsCustomGenerating] = useState(false)
  const [referenceFile, setReferenceFile] = useState<File | null>(null)
  const [referencePreview, setReferencePreview] = useState<string | null>(null)
  const [reworkingId, setReworkingId] = useState<string | null>(null)
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
      if (err.response?.status === 402) {
        toast.error(err.response.data?.message || 'Brak kredytów', { duration: 6000 })
        navigate('/credits')
      } else {
        toast.error(err.response?.data?.message || 'Błąd generowania')
      }
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
      if (err.response?.status === 402) {
        toast.error(err.response.data?.message || 'Brak kredytów', { duration: 6000 })
        navigate('/credits')
      } else {
        toast.error(err.response?.data?.message || 'Błąd generowania')
      }
    } finally {
      setIsCustomGenerating(false)
    }
  }

  const startPolling = () => {
    if (pollIntervalRef.current) return
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
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `miniaturka-${styleName}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(objectUrl)
    } catch {
      toast.error('Nie udało się pobrać zdjęcia')
    }
  }

  const startRework = async (gen: any) => {
    setReworkingId(gen.id)
    try {
      const response = await fetch(gen.url)
      const blob = await response.blob()
      const file = new File([blob], `generated-${gen.style}.png`, { type: blob.type || 'image/png' })
      handleReferenceFile(file)
      setActiveTab('custom')
      setCustomPrompt('')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      toast.success('Załadowano jako referencję. Opisz jak chcesz przerobić zdjęcie.')
    } catch {
      toast.error('Nie udało się załadować zdjęcia do przeróbki')
    } finally {
      setReworkingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  const completedCount = generations.filter((g) => g.status === 'COMPLETED').length
  const hasResults = generations.length > 0

  return (
    <div className="p-8 max-w-5xl">

      {/* Header: product image + title */}
      <div className="flex items-center gap-4 mb-6">
        {image && (
          <img
            src={image.originalUrl}
            alt="Product"
            className="w-20 h-20 object-cover rounded-xl border border-gray-200 shrink-0"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Generator miniaturek</h1>
          <p className="text-gray-500 text-sm mt-0.5">{image?.filename}</p>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('auto')}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'auto'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Squares2X2Icon className="h-4 w-4" />
            6 stylów automatycznych
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'custom'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <PencilSquareIcon className="h-4 w-4" />
            Własny styl
          </button>
        </div>

        {/* Tab: 6 auto styles */}
        {activeTab === 'auto' && (
          <div className="p-5">
            <p className="text-sm text-gray-500 mb-4">
              AI wygeneruje 6 profesjonalnych wariantów Twojego produktu: białe tło, gradient, lifestyle, minimalistyczny, dark luxury, styl Allegro.
            </p>

            {hasResults ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                {completedCount} z {generations.length} wygenerowanych
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Dodatkowe wskazówki dla AI{' '}
                    <span className="text-gray-400 font-normal">(opcjonalnie)</span>
                  </label>
                  <textarea
                    value={basePrompt}
                    onChange={(e) => setBasePrompt(e.target.value)}
                    placeholder="np. elegancki wygląd, produkt w centrum kadru, bez cieni"
                    rows={2}
                    maxLength={400}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Wskazówki zostaną zastosowane do wszystkich 6 stylów.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={startGeneration}
                    disabled={isGenerating}
                    className="btn-primary flex items-center gap-2"
                  >
                    <SparklesIcon className="h-5 w-5" />
                    {isGenerating ? 'Generowanie...' : 'Generuj 6 miniaturek'}
                  </button>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <CreditCardIcon className="h-3.5 w-3.5" />
                    6 × 2 zł = 12 zł (lub z darmowej puli)
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab: custom */}
        {activeTab === 'custom' && (
          <div className="p-5">
            <p className="text-sm text-gray-500 mb-4">
              Opisz dokładnie jak ma wyglądać miniaturka. Możesz też dołączyć zdjęcie referencyjne stylu.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Opis stylu <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startCustomGeneration()}
                placeholder="np. na drewnianym stole, w plenerze, ciepłe kolory, bokeh w tle"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={500}
              />
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Zdjęcie referencyjne stylu{' '}
                <span className="text-gray-400 font-normal">(opcjonalnie)</span>
              </label>
              <input
                ref={referenceInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleReferenceFile(e.target.files?.[0] ?? null)}
              />
              {referencePreview ? (
                <div className="flex items-center gap-3">
                  <img
                    src={referencePreview}
                    alt="Referencja"
                    className="h-16 w-16 object-cover rounded-lg border border-gray-300"
                  />
                  <div>
                    <p className="text-sm text-gray-700">Zdjęcie referencyjne dodane</p>
                    <button
                      onClick={() => {
                        handleReferenceFile(null)
                        if (referenceInputRef.current) referenceInputRef.current.value = ''
                      }}
                      className="text-xs text-red-500 hover:text-red-700 mt-0.5 flex items-center gap-1"
                    >
                      <XMarkIcon className="h-3.5 w-3.5" />
                      Usuń
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => referenceInputRef.current?.click()}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 border border-dashed border-gray-300 rounded-lg px-4 py-2.5 hover:border-blue-400 transition-colors"
                >
                  <PhotoIcon className="h-4 w-4" />
                  Dodaj zdjęcie referencyjne
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={startCustomGeneration}
                disabled={isCustomGenerating || !customPrompt.trim()}
                className="btn-primary flex items-center gap-2"
              >
                <SparklesIcon className="h-5 w-5" />
                {isCustomGenerating ? 'Generowanie...' : 'Generuj miniaturkę'}
              </button>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <CreditCardIcon className="h-3.5 w-3.5" />
                1 × 2 zł (lub z darmowej puli)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Results grid */}
      {hasResults && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {generations.map((gen) => (
            <div key={gen.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="aspect-square bg-gray-100 relative">
                {gen.status === 'COMPLETED' && gen.url ? (
                  <img src={gen.url} alt={gen.style} className="w-full h-full object-cover" />
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
                  <span className="text-xs font-medium text-gray-700">
                    {gen.style === 'custom' ? '✨ Własny styl' : gen.style}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[gen.status]}`}>
                    {STATUS_LABELS[gen.status]}
                  </span>
                </div>
                {gen.status === 'COMPLETED' && gen.url && (
                  <div className="flex gap-1 mt-1">
                    <button
                      onClick={() => downloadImage(gen.url, gen.style)}
                      className="flex-1 flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-700 py-1.5 rounded hover:bg-blue-50 transition-colors"
                    >
                      <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                      Pobierz
                    </button>
                    <div className="w-px bg-gray-100" />
                    <button
                      onClick={() => startRework(gen)}
                      disabled={reworkingId === gen.id}
                      title="Użyj tego zdjęcia jako bazy do dalszej edycji"
                      className="flex-1 flex items-center justify-center gap-1 text-xs text-purple-600 hover:text-purple-700 py-1.5 rounded hover:bg-purple-50 transition-colors disabled:opacity-50"
                    >
                      <ArrowPathIcon className={`h-3.5 w-3.5 ${reworkingId === gen.id ? 'animate-spin' : ''}`} />
                      Przeróbka
                    </button>
                  </div>
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
            {activeTab === 'auto'
              ? 'Kliknij "Generuj 6 miniaturek" aby rozpocząć'
              : 'Opisz styl i kliknij "Generuj miniaturkę"'}
          </p>
        </div>
      )}
    </div>
  )
}
