import { useState, useCallback, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { imagesApi, generationApi, GenerationStyleInfo, notificationsApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { track } from '../services/analytics'
import { usePageTitle } from '../hooks/usePageTitle'
import { describeRejection } from '../utils/dropzone'
import BulkDescriptionsModal, { BulkPhoto } from '../components/BulkDescriptionsModal'
import { useZipDownload } from '../hooks/useZipDownload'
import { groupStartsOpen, groupStyles } from '../utils/styles'
import { countLabel } from '../utils/plural'
import PaywallModal from '../components/PaywallModal'
import {
  ArrowUpTrayIcon,
  PhotoIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  ArchiveBoxArrowDownIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'

type FileStatus = 'queued' | 'uploading' | 'generating' | 'done' | 'error'
/** upload: store only; shared: one style set for the batch; perFile: each photo picks its own. */
type Mode = 'upload' | 'shared' | 'perFile'

const MAX_START_RETRIES = 12
const RETRY_DELAY_MS = 20_000

interface FileItem {
  id: string
  file: File
  preview: string
  status: FileStatus
  error?: string
  imageId?: string
  /** Styles chosen for this file in the per-file mode. */
  styles: string[]
}

function creditsWord(n: number) {
  if (n === 1) return 'kredyt'
  if (n >= 2 && n <= 4) return 'kredyty'
  return 'kredytów'
}

export default function BulkUpload() {
  usePageTitle('Masowe przesyłanie')
  const { user, refreshUser } = useAuth()
  const [files, setFiles] = useState<FileItem[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [mode, setMode] = useState<Mode>('shared')
  const [styles, setStyles] = useState<GenerationStyleInfo[]>([])
  const [defaultStyleIds, setDefaultStyleIds] = useState<string[]>([])
  const [sharedStyles, setSharedStyles] = useState<string[]>([])
  /** Mode of the last finished batch – decides which follow-up actions make sense. */
  const [lastRunMode, setLastRunMode] = useState<Mode | null>(null)
  const [bulkPhotos, setBulkPhotos] = useState<BulkPhoto[] | null>(null)
  const zip = useZipDownload()

  useEffect(() => {
    generationApi
      .getStyles()
      .then(({ data }) => {
        setStyles(data.styles)
        setDefaultStyleIds(data.defaultStyleIds)
        setSharedStyles(data.defaultStyleIds)
      })
      .catch(() => toast.error('Nie udało się pobrać listy stylów'))
  }, [])

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newItems: FileItem[] = acceptedFiles.map((file) => ({
        id: Math.random().toString(36).slice(2),
        file,
        preview: URL.createObjectURL(file),
        status: 'queued',
        styles: defaultStyleIds,
      }))
      setFiles((prev) => [...prev, ...newItems])
    },
    [defaultStyleIds],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejections) => toast.error(describeRejection(rejections)),
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 50,
    maxSize: 10 * 1024 * 1024,
  })

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id))
  const updateFile = (id: string, patch: Partial<FileItem>) => setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))

  const toggleShared = (styleId: string) => setSharedStyles((prev) => (prev.includes(styleId) ? prev.filter((s) => s !== styleId) : [...prev, styleId]))
  const toggleFileStyle = (fileId: string, styleId: string) =>
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, styles: f.styles.includes(styleId) ? f.styles.filter((s) => s !== styleId) : [...f.styles, styleId] } : f)))

  /** Styles a given file will be generated with in the current mode (empty = upload only). */
  const stylesFor = (item: FileItem): string[] => (mode === 'upload' ? [] : mode === 'shared' ? sharedStyles : item.styles)
  const orderedStyles = (ids: string[]) => styles.map((s) => s.id).filter((id) => ids.includes(id))

  const queued = files.filter((f) => f.status === 'queued')
  const totalCredits = useMemo(() => queued.reduce((sum, f) => sum + stylesFor(f).length, 0), [queued, mode, sharedStyles]) // eslint-disable-line react-hooks/exhaustive-deps
  const freeLeft = Math.max(0, (user?.freeCreditsLimit ?? 10) - (user?.freeCreditsUsed ?? 0))
  const paidCredits = user?.credits ?? 0
  const unlimited = Boolean(user?.unlimitedCredits)
  const canAfford = unlimited || totalCredits <= freeLeft + paidCredits
  const missingStyles = mode !== 'upload' && queued.some((f) => stylesFor(f).length === 0)

  /** Spec 19, AC-MON-003: not enough credits opens the offer (with the welcome pack) instead of blocking. */
  const [paywallMissing, setPaywallMissing] = useState<number | null>(null)

  const startAll = async () => {
    if (!queued.length || missingStyles) return
    if (mode !== 'upload' && !canAfford) {
      setPaywallMissing(totalCredits - freeLeft - paidCredits)
      return
    }
    setIsRunning(true)
    const snapshotMode = mode

    const startedIds: string[] = []
    for (const item of queued) {
      const chosen = orderedStyles(stylesFor(item))
      updateFile(item.id, { status: 'uploading' })
      let imageId: string
      try {
        const { data } = await imagesApi.upload(item.file)
        imageId = data.id
      } catch (err: any) {
        updateFile(item.id, { status: 'error', error: err.response?.data?.message || 'Błąd przesyłania' })
        continue
      }
      if (!chosen.length) {
        updateFile(item.id, { status: 'done', imageId, error: undefined })
        continue
      }

      // The backend caps in-flight generations per user – on 429 wait for a free slot and retry.
      updateFile(item.id, { status: 'generating', imageId, error: undefined })
      for (let attempt = 0; attempt < MAX_START_RETRIES; attempt++) {
        try {
          await generationApi.startGeneration(imageId, { styles: chosen })
          startedIds.push(imageId)
          updateFile(item.id, { status: 'done', imageId, error: undefined })
          break
        } catch (err: any) {
          if (err.response?.status === 429 && attempt < MAX_START_RETRIES - 1) {
            updateFile(item.id, { status: 'generating', error: `Czekam na wolne miejsce w kolejce (${attempt + 1}/${MAX_START_RETRIES - 1})…` })
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
            continue
          }
          updateFile(item.id, { status: 'error', error: err.response?.data?.message || 'Błąd generowania' })
          break
        }
      }
    }

    setIsRunning(false)
    setLastRunMode(snapshotMode)
    // Spec 16: a batch of >= 3 photos with graphics e-mails its owner when everything is finished.
    if (snapshotMode !== 'upload') {
      const generated = startedIds.filter(Boolean)
      if (generated.length >= 3 && user?.notifyBatchDone !== false) {
        notificationsApi
          .registerBatch(generated)
          .then(() => toast('Wyślemy Ci maila, gdy wszystkie grafiki będą gotowe.', { icon: '✉️', duration: 6000 }))
          .catch(() => undefined)
      }
    }
    track('upload', { source: 'bulk', files: queued.length, mode: snapshotMode })
    refreshUser().catch(() => undefined)
    toast.success(snapshotMode === 'upload' ? 'Zdjęcia przesłane. Style wybierzesz z galerii dla każdego produktu.' : 'Wszystkie pliki zostały przetworzone!')
  }

  const queuedCount = queued.length
  const doneCount = files.filter((f) => f.status === 'done').length
  const errorCount = files.filter((f) => f.status === 'error').length
  const activeCount = files.filter((f) => f.status === 'uploading' || f.status === 'generating').length

  const statusIcon = (status: FileStatus) => {
    if (status === 'done') return <CheckCircleIcon className="h-5 w-5 text-green-500 shrink-0" />
    if (status === 'error') return <ExclamationCircleIcon className="h-5 w-5 text-red-500 shrink-0" />
    if (status === 'uploading') return <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
    if (status === 'generating') return <div className="h-5 w-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin shrink-0" />
    return <div className="h-5 w-5 rounded-full border-2 border-gray-300 shrink-0" />
  }

  const statusLabel = (status: FileStatus) => {
    if (status === 'queued') return <span className="text-xs text-gray-500">Oczekuje</span>
    if (status === 'uploading') return <span className="text-xs text-blue-600 font-medium">Przesyłanie...</span>
    if (status === 'generating') return <span className="text-xs text-purple-600 font-medium">Generowanie grafik...</span>
    if (status === 'done') return <span className="text-xs text-green-600 font-medium">{mode === 'upload' ? 'Przesłane' : 'Gotowe'}</span>
    if (status === 'error') return <span className="text-xs text-red-600 font-medium">Błąd</span>
  }

  const MODES: Array<{ id: Mode; label: string; hint: string }> = [
    { id: 'upload', label: 'Tylko prześlij', hint: 'bez generowania, 0 kredytów – style wybierzesz później z galerii' },
    { id: 'shared', label: 'Wspólne style dla wszystkich', hint: 'jeden zestaw stylów dla całej partii' },
    { id: 'perFile', label: 'Osobne style dla każdego pliku', hint: 'wybierasz style przy każdym zdjęciu' },
  ]

  return (
    <div className="px-4 py-6 sm:p-8 max-w-3xl mx-auto">
      <PaywallModal open={paywallMissing !== null} missing={paywallMissing ?? undefined} onClose={() => setPaywallMissing(null)} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Masowe przesyłanie zdjęć</h1>
        <p className="text-gray-500 mt-1">Prześlij wiele zdjęć naraz. Zdecyduj, czy od razu generować grafiki i w jakich stylach – płacisz tylko za to, co wybierzesz.</p>
      </div>

      {/* Mode */}
      <fieldset className="mb-6">
        <legend className="text-sm font-medium text-gray-700 mb-2">Co zrobić z przesłanymi zdjęciami?</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {MODES.map((m) => (
            <label key={m.id} className={`rounded-lg border p-3 cursor-pointer ${mode === m.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
              <span className="flex items-start gap-2">
                <input type="radio" name="bulk-mode" checked={mode === m.id} onChange={() => setMode(m.id)} disabled={isRunning} className="mt-0.5" />
                <span>
                  <span className="block text-sm text-gray-800">{m.label}</span>
                  <span className="block text-xs text-gray-600">{m.hint}</span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {mode === 'shared' && styles.length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Style dla całej partii</p>
          <div className="space-y-3">
            {groupStyles(styles).map((group) => {
              const grid = (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.styles.map((s) => (
                    <label key={s.id} className={`flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer ${sharedStyles.includes(s.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                      <input type="checkbox" checked={sharedStyles.includes(s.id)} onChange={() => toggleShared(s.id)} disabled={isRunning} className="mt-0.5" />
                      <span>
                        <span className="text-sm text-gray-800">
                          {s.name}
                          {s.starter && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">start</span>}
                          {s.inSeason && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">Teraz</span>}
                        </span>
                        <span className="block text-xs text-gray-600">{s.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )
              return group.id === 'universal' ? (
                <div key={group.id}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{group.label}</p>
                  {grid}
                </div>
              ) : (
                <details key={group.id} open={groupStartsOpen(group, sharedStyles)} className="rounded-lg border border-gray-200">
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-800">
                    {group.label} <span className="text-xs font-normal text-gray-500">({group.styles.length})</span>
                  </summary>
                  <div className="px-3 pb-3">
                    {group.hint && <p className="help-text mb-2">{group.hint}</p>}
                    {grid}
                  </div>
                </details>
              )
            })}
          </div>
        </div>
      )}

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-6 ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} aria-label="Wybierz zdjęcia z dysku" />
        <ArrowUpTrayIcon className={`h-12 w-12 mx-auto mb-3 ${isDragActive ? 'text-blue-500' : 'text-gray-300'}`} />
        <p className="text-base font-medium text-gray-700">{isDragActive ? 'Upuść zdjęcia tutaj' : 'Przeciągnij wiele zdjęć lub kliknij'}</p>
        <p className="text-sm text-gray-500 mt-1">JPG, PNG, WebP • Max 10 MB każde • Do 50 plików</p>
      </div>

      {files.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-sm font-medium text-gray-700">
                {countLabel(files.length, 'plik', 'pliki', 'plików')}
                {doneCount > 0 && (
                  <span className="text-green-600 ml-2">
                    • {doneCount} {mode === 'upload' ? 'przesłane' : 'gotowe'}
                  </span>
                )}
                {errorCount > 0 && <span className="text-red-600 ml-2">• {errorCount} błędów</span>}
                {activeCount > 0 && <span className="text-blue-600 ml-2">• {activeCount} w toku</span>}
              </span>
              {!isRunning && (
                <button onClick={() => setFiles([])} className="text-xs text-gray-500 hover:text-gray-600">
                  Wyczyść wszystko
                </button>
              )}
            </div>

            <ul className="divide-y divide-gray-100 max-h-[32rem] overflow-y-auto">
              {files.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={item.preview} alt={item.file.name} className="h-12 w-12 object-cover rounded-lg border border-gray-200 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.file.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {statusLabel(item.status)}
                        {item.error && <span className="text-xs text-red-500">— {item.error}</span>}
                        {item.status === 'queued' && mode !== 'upload' && (
                          <span className="text-xs text-gray-500">
                            {stylesFor(item).length} {creditsWord(stylesFor(item).length)}
                          </span>
                        )}
                      </div>
                    </div>
                    {statusIcon(item.status)}
                    {item.status === 'done' && item.imageId && (
                      <Link to={`/generate/${item.imageId}`} className="text-blue-600 hover:text-blue-700 shrink-0" title="Otwórz generator">
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      </Link>
                    )}
                    {(item.status === 'queued' || item.status === 'error') && !isRunning && (
                      <button onClick={() => removeFile(item.id)} className="text-gray-300 hover:text-red-400 shrink-0" aria-label={`Usuń ${item.file.name}`}>
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {mode === 'perFile' && item.status === 'queued' && (
                    <div className="mt-2 pl-[60px] space-y-1.5">
                      {groupStyles(styles).map((group) => {
                        const chips = (
                          <div className="flex flex-wrap gap-1.5">
                            {group.styles.map((s) => {
                              const on = item.styles.includes(s.id)
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => toggleFileStyle(item.id, s.id)}
                                  disabled={isRunning}
                                  aria-pressed={on}
                                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${on ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                >
                                  {s.name}
                                </button>
                              )
                            })}
                          </div>
                        )
                        return group.id === 'universal' ? (
                          <div key={group.id}>{chips}</div>
                        ) : (
                          <details key={group.id} open={groupStartsOpen(group, item.styles)}>
                            <summary className="cursor-pointer select-none text-xs text-gray-600">{group.label}</summary>
                            <div className="mt-1.5">{chips}</div>
                          </details>
                        )
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Cost + action */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button onClick={startAll} disabled={isRunning || queuedCount === 0 || missingStyles} className="btn-primary flex items-center justify-center gap-2 flex-1">
              {mode === 'upload' ? <ArrowUpTrayIcon className="h-5 w-5" /> : <SparklesIcon className="h-5 w-5" />}
              {isRunning ? `Przetwarzanie... (${activeCount} w toku)` : mode === 'upload' ? `Prześlij (${queuedCount})` : `Prześlij i generuj (${queuedCount})`}
            </button>
            {queuedCount > 0 && (
              <p className="text-sm text-gray-500">
                {mode === 'upload' ? (
                  <>
                    Koszt: <span className="font-medium text-gray-700">0 kredytów</span>
                  </>
                ) : missingStyles ? (
                  <span className="text-amber-600">Wybierz co najmniej jeden styl{mode === 'perFile' ? ' dla każdego pliku' : ''}</span>
                ) : (
                  <>
                    Koszt:{' '}
                    <span className="font-medium text-gray-700">
                      {totalCredits} {creditsWord(totalCredits)}
                    </span>
                    {canAfford ? (
                      <span className="text-gray-500"> {unlimited ? '· konto administratora – bez limitu' : `· masz ${freeLeft} darmowych + ${paidCredits} zakupionych`}</span>
                    ) : (
                      <span className="text-red-600">
                        {' '}
                        · brakuje {totalCredits - freeLeft - paidCredits} –{' '}
                        <Link to="/credits" className="underline">
                          doładuj konto
                        </Link>
                      </span>
                    )}
                  </>
                )}
              </p>
            )}
          </div>

          {!isRunning && doneCount > 0 && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-sm font-medium text-green-800 mb-2">
                ✅ {countLabel(doneCount, 'produkt', 'produkty', 'produktów')} {mode === 'upload' ? 'przesłano – wybierz style dla każdego z nich' : 'gotowe — generowanie grafik trwa w tle'}
              </p>
              <div className="flex flex-wrap gap-2">
                {files
                  .filter((f) => f.status === 'done' && f.imageId)
                  .map((f) => (
                    <Link
                      key={f.id}
                      to={`/generate/${f.imageId}`}
                      className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 bg-green-100 hover:bg-green-200 px-2 py-1 rounded-md transition-colors"
                    >
                      <PhotoIcon className="h-3.5 w-3.5" />
                      {f.file.name.replace(/\.[^.]+$/, '')}
                    </Link>
                  ))}
              </div>
              {lastRunMode && lastRunMode !== 'upload' && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => zip.download(files.filter((f) => f.status === 'done' && f.imageId).map((f) => f.imageId!))}
                    disabled={zip.isPreparing}
                    className="btn-secondary text-sm flex items-center gap-1.5"
                  >
                    <ArchiveBoxArrowDownIcon className="h-4 w-4" />
                    {zip.isPreparing ? 'Przygotowuję...' : 'Pobierz wszystko (ZIP)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkPhotos(files.filter((f) => f.status === 'done' && f.imageId).map((f) => ({ id: f.imageId!, label: f.file.name })))}
                    className="btn-primary text-sm flex items-center gap-1.5"
                  >
                    <DocumentTextIcon className="h-4 w-4" />
                    Napisz opisy dla wszystkich
                  </button>
                </div>
              )}
              {lastRunMode && lastRunMode !== 'upload' && <p className="help-text mt-2">Paczka zawiera grafiki gotowe w chwili pobrania – resztę dopakujesz później z galerii.</p>}
            </div>
          )}
        </>
      )}

      {files.length === 0 && <div className="text-center py-8 text-gray-500 text-sm">Brak wybranych plików. Przeciągnij zdjęcia lub kliknij w strefę powyżej.</div>}
      {bulkPhotos && <BulkDescriptionsModal photos={bulkPhotos} onClose={() => setBulkPhotos(null)} />}
    </div>
  )
}
