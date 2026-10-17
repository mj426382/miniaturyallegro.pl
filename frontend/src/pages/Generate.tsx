import { Suspense, useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { imagesApi, generationApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useGenerations, Generation, BatchSummary } from '../hooks/useGenerations'
import { usePageTitle } from '../hooks/usePageTitle'
import { useConfirm } from '../hooks/useConfirm'
import { track } from '../services/analytics'
import { downloadBlob, shareBlob } from '../utils/download'
import OfferDescriptionPanel from '../components/OfferDescriptionPanel'
import StylePicker from '../components/generate/StylePicker'
import CustomStyleForm from '../components/generate/CustomStyleForm'
import ResultCard from '../components/generate/ResultCard'
import ConsentPrompt from '../components/ConsentPrompt'
import ModalFallback from '../components/ModalFallback'
import { ExportModal, InfographicModal, PaywallModal } from '../components/lazyModals'
import { usePreloadOnInteraction } from '../hooks/usePreloadOnInteraction'
import { SparklesIcon, CreditCardIcon, Squares2X2Icon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'

type Tab = 'auto' | 'custom'

/**
 * Generator screen: orchestrates the photo's generations (useGenerations), the two ways of
 * starting new ones (style batch / custom prompt), per-result actions and the offer description.
 */
export default function Generate() {
  const { imageId } = useParams<{ imageId: string }>()
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const confirm = useConfirm()
  usePageTitle('Generator grafik')
  // Spec 17, AC-PERF-006/007: the dialogs are separate chunks, fetched on the first interaction – not with the screen.
  usePreloadOnInteraction(ExportModal.preload, InfographicModal.preload, PaywallModal.preload)

  const resultsRef = useRef<HTMLDivElement>(null)
  const descriptionRef = useRef<HTMLDivElement>(null)
  const hasDescriptionRef = useRef(false)
  const nudgedRef = useRef(false)
  const referenceInputRef = useRef<HTMLInputElement>(null)
  /** Downloaded blobs by generation id – filled on hover/touch so "Pobierz" needs no network call. */
  const blobCache = useRef(new Map<string, Promise<Blob>>())

  const [activeTab, setActiveTab] = useState<Tab>('auto')
  const [basePrompt, setBasePrompt] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [isCustomGenerating, setIsCustomGenerating] = useState(false)
  const [referenceFile, setReferenceFile] = useState<File | null>(null)
  const [referencePreview, setReferencePreview] = useState<string | null>(null)
  const [reworkingId, setReworkingId] = useState<string | null>(null)
  const [isRework, setIsRework] = useState(false)
  /** A graphic, or 'original' for the seller's own photo (Vinted, spec 08). */
  const [exportTarget, setExportTarget] = useState<Generation | 'original' | null>(null)
  const [infographicTarget, setInfographicTarget] = useState<Generation | null>(null)
  const [pendingShare, setPendingShare] = useState<{ blob: Blob; name: string } | null>(null)
  /** Style picker collapses once results exist so they stay in view (phones especially). */
  const [pickerOpen, setPickerOpen] = useState(true)

  const gens = useGenerations(imageId, {
    onBatchFinished: ({ completed, failed }: BatchSummary) => {
      refreshUser().catch(() => undefined)
      if (completed === 0 && failed > 0) {
        // Nothing to show – say so instead of celebrating (credits are refunded server-side).
        toast.error('Nie udało się wygenerować grafik – kredyty wróciły na konto. Spróbuj ponownie przyciskiem „Ponów” na karcie.', { duration: 8000 })
        return
      }
      if (failed > 0) {
        toast(`Gotowe: ${completed}, nieudane: ${failed}. Kredyty za nieudane grafiki wróciły na konto.`, { duration: 8000 })
      } else if (!hasDescriptionRef.current && !nudgedRef.current) {
        // First finished graphic: offer the SEO copy once, with a one-tap jump to the panel.
        nudgedRef.current = true
        toast(
          (t) => (
            <span className="flex items-center gap-3">
              <span>Grafika gotowa. Dopisz opis oferty pod OLX, Vinted, eBay, Amazon albo sklep.</span>
              <button
                type="button"
                className="btn-primary text-xs px-2.5 py-1 whitespace-nowrap"
                onClick={() => {
                  toast.dismiss(t.id)
                  descriptionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                Dopisz opis
              </button>
            </span>
          ),
          { duration: 10000, icon: '✅' },
        )
      } else {
        toast.success('Generowanie zakończone!')
      }
      setPickerOpen(false)
    },
  })
  const { image, generations, setGenerations, styles, styleNames, generatedStyleIds, selectedStyles, toggleStyle, restartPolling, isLoading, pollTimedOut, hasActive, completedCount, hasResults } =
    gens

  useEffect(() => {
    setPickerOpen(!gens.openedWithResults)
  }, [gens.openedWithResults])

  const freeLeft = Math.max(0, (user?.freeCreditsLimit ?? 5) - (user?.freeCreditsUsed ?? 0))
  const paidCredits = user?.credits ?? 0
  const unlimited = Boolean(user?.unlimitedCredits)
  const locked = hasActive && !pollTimedOut

  const prefetchBlob = (genId: string) => {
    if (blobCache.current.has(genId)) return blobCache.current.get(genId)!
    const promise = generationApi.downloadGeneration(genId).then((r) => r.data as Blob)
    promise.catch(() => blobCache.current.delete(genId))
    if (blobCache.current.size >= 24) {
      const oldest = blobCache.current.keys().next().value
      if (oldest) blobCache.current.delete(oldest)
    }
    blobCache.current.set(genId, promise)
    return promise
  }

  /** Spec 19, AC-MON-003: a missing balance opens the offer instead of an error. */
  const [paywall, setPaywall] = useState<{ missing: number } | null>(null)
  const needsPaywall = (cost: number) => {
    if (unlimited || freeLeft + paidCredits >= cost) return false
    setPaywall({ missing: cost - freeLeft - paidCredits })
    return true
  }

  const handleCreditsError = (err: any, fallback: string) => {
    if (err.response?.status === 402) {
      const body = err.response.data ?? {}
      setPaywall({ missing: Math.max(1, Number(body.creditsRequired ?? 1) - Number(body.creditsAvailable ?? 0)) })
      refreshUser().catch(() => undefined)
    } else {
      const message = err.response?.data?.message
      toast.error(Array.isArray(message) ? message.join('. ') : message || fallback)
    }
  }

  const scrollToResults = () => setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)

  const startGeneration = async () => {
    if (!selectedStyles.length || isStarting || hasActive) return
    if (needsPaywall(selectedStyles.length)) return
    setIsStarting(true)
    try {
      const { data } = await generationApi.startGeneration(imageId!, { styles: selectedStyles, basePrompt: basePrompt.trim() || undefined })
      toast.success(`Generowanie ${data.count} ${data.count === 1 ? 'grafiki' : 'grafik'} rozpoczęte! To może potrwać kilka minut.`)
      const placeholders: Generation[] = (data.generationIds as string[]).map((id, i) => ({ id, style: data.styles?.[i] || selectedStyles[i] || 'custom', status: 'PENDING', url: null }))
      setGenerations((prev) => [...prev, ...placeholders])
      restartPolling()
      track('generation_start', { styles: data.count, mode: 'auto' })
      scrollToResults()
      refreshUser().catch(() => undefined)
    } catch (err: any) {
      handleCreditsError(err, 'Błąd generowania')
    } finally {
      setIsStarting(false)
    }
  }

  const handleReferenceFile = (file: File | null) => {
    if (!file) {
      setReferenceFile(null)
      setReferencePreview(null)
      setIsRework(false)
      return
    }
    setReferenceFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setReferencePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const startCustomGeneration = async () => {
    if (customPrompt.trim().length < 3 || isCustomGenerating) return
    if (needsPaywall(1)) return
    setIsCustomGenerating(true)
    try {
      const { data } = await generationApi.startCustomGeneration(imageId!, customPrompt.trim(), referenceFile || undefined, isRework)
      toast.success('Generowanie własnej grafiki rozpoczęte!')
      setGenerations((prev) => [...prev, { id: data.generationId, style: 'custom', status: 'PENDING', url: null }])
      restartPolling()
      track('generation_start', { styles: 1, mode: isRework ? 'rework' : 'custom' })
      scrollToResults()
      setCustomPrompt('')
      handleReferenceFile(null)
      refreshUser().catch(() => undefined)
    } catch (err: any) {
      handleCreditsError(err, 'Błąd generowania')
    } finally {
      setIsCustomGenerating(false)
    }
  }

  const [retryingId, setRetryingId] = useState<string | null>(null)
  const retryFailed = async (genId: string) => {
    if (retryingId) return
    if (needsPaywall(1)) return
    setRetryingId(genId)
    try {
      await generationApi.retryGeneration(genId)
      toast.success('Ponowienie generowania rozpoczęte!')
      setGenerations((prev) => prev.map((g) => (g.id === genId ? { ...g, status: 'PENDING' } : g)))
      restartPolling()
      refreshUser().catch(() => undefined)
    } catch (err: any) {
      handleCreditsError(err, 'Nie udało się ponowić generowania')
    } finally {
      setRetryingId(null)
    }
  }

  const downloadImage = async (gen: Generation) => {
    try {
      const data = await prefetchBlob(gen.id)
      const name = `grafika-${gen.style}.png`
      const method = await downloadBlob(data, name)
      if (method !== 'cancelled') track('download', { style: gen.style, method })
      if (method === 'share-rejected') {
        // The share sheet needs a fresh tap – offer a one-tap button that calls it synchronously.
        setPendingShare({ blob: data, name })
      } else if (method === 'open-tab' || method === 'anchor-ios') {
        toast('Przytrzymaj obraz i wybierz „Zapisz obraz”, aby zapisać go w Zdjęciach.', { duration: 6000 })
      }
    } catch {
      toast.error('Nie udało się pobrać grafiki')
    }
  }

  const startRework = async (gen: Generation) => {
    setReworkingId(gen.id)
    try {
      const { data } = await generationApi.downloadGeneration(gen.id)
      const file = new File([data], `generated-${gen.style}.png`, { type: data.type || 'image/png' })
      handleReferenceFile(file)
      setIsRework(true)
      setPickerOpen(true)
      setActiveTab('custom')
      setCustomPrompt('')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      toast.success('Załadowano jako bazę do przeróbki. Opisz, co zmienić.')
    } catch {
      toast.error('Nie udało się załadować grafiki do przeróbki')
    } finally {
      setReworkingId(null)
    }
  }

  const deletePhoto = async () => {
    if (!image) return
    const ok = await confirm({
      title: 'Usunąć to zdjęcie?',
      message: 'Zdjęcie, wszystkie wygenerowane dla niego grafiki i opis oferty zostaną trwale usunięte. Wykorzystanych kredytów nie zwracamy.',
      confirmLabel: 'Usuń zdjęcie',
      danger: true,
    })
    if (!ok) return
    try {
      await imagesApi.delete(image.id)
      toast.success('Zdjęcie usunięte')
      refreshUser().catch(() => undefined)
      navigate('/gallery')
    } catch {
      toast.error('Nie udało się usunąć zdjęcia')
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!image && gens.loadError === 'failed') {
    return (
      <div className="p-8 text-center" role="alert">
        <p className="text-gray-700 mb-4">Nie udało się wczytać zdjęcia. Sprawdź połączenie i spróbuj ponownie.</p>
        <div className="flex justify-center gap-2">
          <button type="button" onClick={gens.reload} className="btn-primary">
            Spróbuj ponownie
          </button>
          <Link to="/gallery" className="btn-secondary">
            Galeria
          </Link>
        </div>
      </div>
    )
  }

  if (!image) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-700 mb-4">Nie znaleziono tego zdjęcia – mogło zostać usunięte.</p>
        <Link to="/gallery" className="btn-primary">
          Wróć do galerii
        </Link>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:p-8 max-w-5xl mx-auto">
      {paywall && (
        <Suspense fallback={<ModalFallback />}>
          <PaywallModal open missing={paywall.missing} onClose={() => setPaywall(null)} />
        </Suspense>
      )}
      {/* Header: product image + title */}
      <div className="flex items-center gap-4 mb-6">
        <img src={image.originalUrl} alt="Zdjęcie produktu" className="w-20 h-20 object-cover rounded-xl border border-gray-200 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Generator grafik produktowych</h1>
          <p className="text-gray-500 text-sm mt-0.5 truncate">
            {image.createdAt ? `Zdjęcie przesłane ${new Date(image.createdAt).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Zdjęcie produktu'}
          </p>
          <button type="button" onClick={() => setExportTarget('original')} className="text-xs text-blue-700 hover:underline mt-0.5" title="Twoje zdjęcie bez AI – tylko kadr i format, np. na Vinted">
            Eksportuj oryginał (np. na Vinted)
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <Link to="/credits" className="hidden sm:flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg">
            <CreditCardIcon className="h-4 w-4" />
            {unlimited ? 'Kredyty: bez limitu' : freeLeft > 0 ? `Darmowe: ${freeLeft}` : `Kredyty: ${paidCredits}`}
          </Link>
          <button
            type="button"
            onClick={deletePhoto}
            disabled={locked}
            aria-label="Usuń zdjęcie"
            title={locked ? 'Poczekaj na zakończenie generowania' : 'Usuń zdjęcie i wszystkie jego grafiki'}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mode tabs – collapsed when results exist so they stay in view */}
      {hasResults && !pickerOpen && (
        <div className="bg-white rounded-xl border border-gray-200 mb-6 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">Chcesz więcej wariantów? Dogeneruj kolejne style albo opisz własny.</p>
          <button type="button" onClick={() => setPickerOpen(true)} className="btn-secondary text-sm">
            Pokaż style
          </button>
        </div>
      )}
      <div className={`bg-white rounded-xl border border-gray-200 mb-6 ${hasResults && !pickerOpen ? 'hidden' : ''}`}>
        <div className="flex border-b border-gray-200" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'auto'}
            onClick={() => setActiveTab('auto')}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'auto' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            <Squares2X2Icon className="h-4 w-4" />
            Style automatyczne
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'custom'}
            onClick={() => setActiveTab('custom')}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'custom' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            <PencilSquareIcon className="h-4 w-4" />
            Własny styl
          </button>
        </div>

        {activeTab === 'auto' ? (
          <StylePicker
            styles={styles}
            selectedStyles={selectedStyles}
            generatedStyleIds={generatedStyleIds}
            onToggle={toggleStyle}
            hasResults={hasResults}
            completedCount={completedCount}
            totalCount={generations.length}
            locked={locked}
            basePrompt={basePrompt}
            onBasePromptChange={setBasePrompt}
            onStart={startGeneration}
            isStarting={isStarting}
            freeLeft={freeLeft}
            paidCredits={paidCredits}
            unlimited={unlimited}
          />
        ) : (
          <CustomStyleForm
            prompt={customPrompt}
            onPromptChange={setCustomPrompt}
            referencePreview={referencePreview}
            isRework={isRework}
            inputRef={referenceInputRef}
            onFile={handleReferenceFile}
            onStart={startCustomGeneration}
            isGenerating={isCustomGenerating}
            freeLeft={freeLeft}
            paidCredits={paidCredits}
            unlimited={unlimited}
          />
        )}
      </div>

      {/* Results grid */}
      {hasResults && (
        <div ref={resultsRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 scroll-mt-4">
          {generations.map((gen) => (
            <ResultCard
              key={gen.id}
              generation={gen}
              styleName={styleNames[gen.style] || gen.style}
              onPrefetch={() => prefetchBlob(gen.id)}
              onDownload={() => downloadImage(gen)}
              onExport={() => setExportTarget(gen)}
              onInfographic={() => setInfographicTarget(gen)}
              onRework={() => startRework(gen)}
              reworking={reworkingId === gen.id}
              onRetry={() => retryFailed(gen.id)}
              retrying={retryingId === gen.id}
              onRated={(rating) => setGenerations((prev) => prev.map((g) => (g.id === gen.id ? { ...g, rating } : g)))}
            />
          ))}
        </div>
      )}

      {/* Spec 19, AC-MON-005: ask for marketing consent right after the first finished graphics – never before. */}
      {completedCount > 0 && <ConsentPrompt />}

      {hasResults && (
        <div ref={descriptionRef}>
          <OfferDescriptionPanel
            imageId={imageId!}
            hasCompletedGraphic={completedCount > 0}
            onCreditsChanged={() => refreshUser().catch(() => undefined)}
            onStateChange={(has) => {
              hasDescriptionRef.current = has
            }}
          />
        </div>
      )}

      {pendingShare && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 bg-white border-t border-gray-200 shadow-lg flex items-center justify-between gap-3">
          <p className="text-sm text-gray-700">Grafika jest gotowa. Dotknij, aby zapisać ją w Zdjęciach.</p>
          <div className="flex gap-2">
            <button onClick={() => setPendingShare(null)} className="btn-secondary text-sm">
              Anuluj
            </button>
            <button
              onClick={() => {
                const { blob, name } = pendingShare
                setPendingShare(null)
                shareBlob(blob, name).then((ok) => {
                  if (!ok) downloadBlob(blob, name)
                })
              }}
              className="btn-primary text-sm"
            >
              Zapisz w Zdjęciach
            </button>
          </div>
        </div>
      )}

      <Suspense fallback={<ModalFallback />}>
        {exportTarget === 'original' && <ExportModal original={{ imageId: image.id, url: image.originalUrl }} initialPlatform="vinted" onClose={() => setExportTarget(null)} />}
        {exportTarget && exportTarget !== 'original' && exportTarget.url && (
          <ExportModal
            generation={{
              id: exportTarget.id,
              style: exportTarget.style,
              styleName: exportTarget.style === 'custom' ? 'Własny styl' : styleNames[exportTarget.style] || exportTarget.style,
              url: exportTarget.url,
            }}
            original={{ imageId: image.id, url: image.originalUrl }}
            onClose={() => setExportTarget(null)}
          />
        )}
        {infographicTarget && <InfographicModal generationId={infographicTarget.id} imageId={imageId!} styleName={infographicTarget.style} onClose={() => setInfographicTarget(null)} />}
      </Suspense>

      {!hasResults && (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <SparklesIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{activeTab === 'auto' ? 'Wybierz style i kliknij „Generuj”, aby rozpocząć' : 'Opisz styl i kliknij „Generuj grafikę”'}</p>
        </div>
      )}
    </div>
  )
}
