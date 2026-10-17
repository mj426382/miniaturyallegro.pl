import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { XMarkIcon, ArrowDownTrayIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { exportApi, ExportFormat, ExportOptions, ExportRatio, ImageAdjustments, PlatformId, PlatformPreset } from '../services/api'
import { usePlatformPresets } from '../hooks/usePlatformPresets'
import { track } from '../services/analytics'
import { downloadBlob, shareBlob } from '../utils/download'
import { CropRect, ratioToAspect } from '../utils/crop'
import CropEditor, { Rotation } from './CropEditor'
import Modal from './Modal'
import { useConfirm } from '../hooks/useConfirm'

interface Props {
  /** The AI graphic opened from its card; omitted when only the original photo is exported. */
  generation?: { id: string; style: string; styleName: string; url: string }
  /** The seller's own uploaded photo – exported without AI for platforms that want real photos (Vinted, spec 08). */
  original: { imageId: string; url: string }
  /** Starting platform (e.g. Vinted for „Eksportuj oryginał”). */
  initialPlatform?: PlatformId
  onClose: () => void
}

type Source = 'generation' | 'original'

const BADGE_POSITION_LABELS: Record<NonNullable<ExportOptions['badgePosition']>, string> = {
  'top-left': 'w lewym górnym rogu',
  'top-right': 'w prawym górnym rogu',
  'bottom-left': 'w lewym dolnym rogu',
  'bottom-right': 'w prawym dolnym rogu',
}

const RATIO_HINTS: Record<ExportRatio, string> = {
  '1:1': 'kwadrat – zdjęcie główne',
  '4:3': 'poziome – galeria',
  '3:4': 'pionowe',
  '16:9': 'panorama – baner',
}
const FORMAT_LABELS: Record<ExportFormat, string> = { jpeg: 'JPG', png: 'PNG', webp: 'WebP' }

/** Canvas size for a ratio at the preset's long edge – same maths as the server. */
function canvasSize(ratio: ExportRatio, size: number): string {
  const [w, h] = ratio.split(':').map(Number)
  const width = w >= h ? size : Math.round((size * w) / h)
  const height = w >= h ? Math.round((size * h) / w) : size
  return `${width}×${height} px`
}

const isUrl = (value: string) => /^https:\/\//.test(value)

const COLORS: Array<{ id: NonNullable<ExportOptions['badgeColor']>; className: string; name: string }> = [
  { id: 'red', className: 'bg-red-600', name: 'czerwony' },
  { id: 'orange', className: 'bg-orange-600', name: 'pomarańczowy' },
  { id: 'green', className: 'bg-green-600', name: 'zielony' },
  { id: 'blue', className: 'bg-blue-600', name: 'niebieski' },
  { id: 'black', className: 'bg-gray-900', name: 'czarny' },
]

/** "crop": the user frames the graphic (no bars). "fit": the whole graphic on a white canvas. */
type Framing = 'crop' | 'fit'
type Step = 1 | 2

/**
 * Generated graphics are square, so any other ratio needs a decision – default to framing it.
 * Original photos have any shape: framing (no white bars) is the default for every ratio.
 */
const defaultFraming = (ratio: ExportOptions['ratio'], source: Source = 'generation'): Framing => (source === 'original' || (ratio && ratio !== '1:1') ? 'crop' : 'fit')

const DEFAULT_ADJUST: Required<ImageAdjustments> = { brightness: 1, contrast: 1, saturation: 1, sharpen: false }
const isDefaultAdjust = (a: Required<ImageAdjustments>) => a.brightness === 1 && a.contrast === 1 && a.saturation === 1 && !a.sharpen
/** Same maths as the server (sharp modulate/linear), so the preview matches the file. */
const cssFilter = (a: Required<ImageAdjustments>) => `brightness(${a.brightness}) contrast(${a.contrast}) saturate(${a.saturation})`

const SLIDERS: Array<{ key: 'brightness' | 'contrast' | 'saturation'; label: string; min: number; max: number }> = [
  { key: 'brightness', label: 'Jasność', min: 0.5, max: 1.5 },
  { key: 'contrast', label: 'Kontrast', min: 0.5, max: 1.5 },
  { key: 'saturation', label: 'Nasycenie', min: 0, max: 2 },
]

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 1, label: 'Format i kadr' },
  { id: 2, label: 'Korekta i plakietka' },
]

export default function ExportModal({ generation, original, initialPlatform = 'generic', onClose }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [source, setSource] = useState<Source>(generation ? 'generation' : 'original')
  const isOriginal = source === 'original' || !generation
  const previewUrl = isOriginal ? original.url : generation.url
  const previewAlt = isOriginal ? 'Oryginalne zdjęcie produktu' : generation.styleName
  const { presets, failed: presetsFailed, retry: retryPresets } = usePlatformPresets()
  const [platformId, setPlatformId] = useState<PlatformPreset['id']>(initialPlatform)
  const preset = presets?.find((p) => p.id === platformId) ?? null
  const [ratio, setRatio] = useState<ExportRatio>('1:1')
  const [format, setFormat] = useState<ExportFormat>('jpeg')
  const [framing, setFraming] = useState<Framing>(defaultFraming('1:1', generation ? 'generation' : 'original'))
  const [crop, setCrop] = useState<CropRect | null>(null)
  const [rotation, setRotation] = useState<Rotation>(0)
  const [adjust, setAdjust] = useState<Required<ImageAdjustments>>(DEFAULT_ADJUST)
  const [badgeText, setBadgeText] = useState('')
  const [badgeColor, setBadgeColor] = useState<NonNullable<ExportOptions['badgeColor']>>('red')
  const [badgePosition, setBadgePosition] = useState<NonNullable<ExportOptions['badgePosition']>>('top-left')
  const [isExporting, setIsExporting] = useState(false)
  const [readyToShare, setReadyToShare] = useState<{ blob: Blob; name: string } | null>(null)
  /** The current settings were downloaded – closing needs no confirmation. */
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const confirm = useConfirm()

  const chooseRatio = (next: ExportRatio, nextSource: Source = source) => {
    setRatio(next)
    setFraming(defaultFraming(next, nextSource))
    setCrop(null)
  }

  const choosePlatform = (p: PlatformPreset) => {
    setPlatformId(p.id)
    setFormat(p.defaultFormat)
    chooseRatio(p.defaultRatio)
  }

  // A starting platform other than the default (e.g. Vinted) takes its ratio and format once presets load.
  const appliedInitial = useRef(false)
  useEffect(() => {
    if (appliedInitial.current || !presets) return
    appliedInitial.current = true
    const start = presets.find((p) => p.id === initialPlatform)
    if (start && initialPlatform !== 'generic') choosePlatform(start)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets])

  /** Spec 08, AC-PLT-010: the original photo is exported with framing, rotation and format only. */
  const switchSource = (next: Source) => {
    setSource(next)
    setStep(1)
    setRotation(0)
    setAdjust(DEFAULT_ADJUST)
    chooseRatio(ratio, next)
  }

  const onCropChange = useCallback((next: CropRect) => setCrop(next), [])
  const rotateBy = (delta: 90 | -90) => {
    setRotation((r) => ((r + delta + 360) % 360) as Rotation)
    setCrop(null)
  }

  const shareReady = () => {
    if (!readyToShare) return
    const { blob, name } = readyToShare
    setReadyToShare(null)
    shareBlob(blob, name).then((ok) => {
      if (!ok) downloadBlob(blob, name)
    })
  }

  /**
   * Spec 11, AC-UI-011: rotation, corrections and a badge are work the user would lose – closing asks first
   * (a confirmation on top of this dialog). Untouched settings or settings already downloaded close at once.
   */
  const editsKey = JSON.stringify({ rotation, adjust, badge: badgeText.trim() })
  const hasUnsavedEdits = (rotation !== 0 || !isDefaultAdjust(adjust) || Boolean(badgeText.trim())) && savedKey !== editsKey
  const confirmingClose = useRef(false)
  const requestClose = async () => {
    if (!hasUnsavedEdits) return onClose()
    if (confirmingClose.current) return
    confirmingClose.current = true
    const discard = await confirm({
      title: 'Zamknąć bez pobierania?',
      message: 'Obrót, korekta i plakietka nie zostaną zapisane – grafika na koncie się nie zmieni.',
      confirmLabel: 'Zamknij bez pobierania',
      cancelLabel: 'Wróć do edycji',
      danger: true,
    })
    confirmingClose.current = false
    if (discard) onClose()
  }

  const isSquare = ratio === '1:1'
  const cropPending = framing === 'crop' && !crop
  const badgeForbidden = preset?.badge === 'forbidden'
  const filter = isDefaultAdjust(adjust) ? undefined : cssFilter(adjust)

  const download = async () => {
    setIsExporting(true)
    try {
      if (!preset) return
      const options: ExportOptions = { platform: preset.id, ratio, size: preset.targetSize, format }
      if (framing === 'crop' && crop) options.crop = crop
      if (rotation !== 0) options.rotate = rotation
      if (!isOriginal && !isDefaultAdjust(adjust)) options.adjust = adjust
      if (!isOriginal && badgeText.trim() && !badgeForbidden) {
        options.badgeText = badgeText.trim()
        options.badgeColor = badgeColor
        options.badgePosition = badgePosition
      }
      const { data } = isOriginal ? await exportApi.exportOriginal(original.imageId, options) : await exportApi.export(generation.id, options)
      const ext = options.format === 'png' ? 'png' : options.format === 'webp' ? 'webp' : 'jpg'
      const name = isOriginal ? `zdjecie-${preset.id}-${ratio.replace(':', 'x')}.${ext}` : `grafika-${generation.style}-${preset.id}-${ratio.replace(':', 'x')}.${ext}`
      const method = await downloadBlob(data, name)
      if (method !== 'cancelled') setSavedKey(editsKey)
      if (method !== 'cancelled')
        track('export', { platform: preset.id, ratio, framing, source, rotated: rotation !== 0, adjusted: Boolean(options.adjust), badge: Boolean(options.badgeText), method })
      if (method === 'share-rejected') setReadyToShare({ blob: data, name })
      if (method === 'open-tab' || method === 'anchor-ios') toast('Przytrzymaj obraz i wybierz „Zapisz obraz”, aby zapisać go w Zdjęciach.', { duration: 6000 })
    } catch (err: any) {
      const message = err.response?.data?.message
      toast.error(Array.isArray(message) ? message.join('. ') : message || 'Nie udało się wyeksportować grafiki')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Modal onClose={requestClose} labelledBy="export-modal-title" initialFocus={closeRef} className="rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <h2 id="export-modal-title" className="text-lg font-semibold text-gray-900">
          {isOriginal ? 'Eksportuj oryginalne zdjęcie' : 'Eksportuj grafikę'}
        </h2>
        <button ref={closeRef} type="button" onClick={requestClose} aria-label="Zamknij" className="text-gray-500 hover:text-gray-700">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {isOriginal ? (
        <p className="help-text mb-5">Twoje zdjęcie bez AI – zmienisz tylko kadr, obrót, proporcje i format pliku.</p>
      ) : (
        <ol className="flex items-center gap-2 text-xs mb-5" aria-label="Kroki eksportu">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2" aria-current={step === s.id ? 'step' : undefined}>
              <span className={`h-5 w-5 rounded-full flex items-center justify-center font-semibold ${step >= s.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{s.id}</span>
              <span className={step === s.id ? 'text-gray-900 font-medium' : 'text-gray-500'}>{s.label}</span>
              {i < STEPS.length - 1 && <span className="w-6 border-t border-gray-300" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Preview column – stays on both steps so corrections are visible live. */}
        <div>
          {framing === 'crop' ? (
            <CropEditor image={previewUrl} aspect={ratioToAspect(ratio)} rotation={rotation} filter={filter} onChange={onCropChange} />
          ) : (
            <>
              <div className="w-full rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden" style={{ aspectRatio: ratioToAspect(ratio) }}>
                <img src={previewUrl} alt={previewAlt} className="max-w-full max-h-full object-contain" style={{ transform: `rotate(${rotation}deg)`, filter }} />
              </div>
              <p className="help-text mt-2">
                {preset?.productFill
                  ? `Produkt wypełni ok. ${Math.round(preset.productFill * 100)} % kadru na czysto białym tle (białe marginesy grafiki zostaną przycięte).`
                  : isOriginal
                    ? 'Całe zdjęcie na białym tle – puste pasy wypełnią brakującą część formatu.'
                    : isSquare
                      ? 'Cała grafika bez zmian.'
                      : 'Cała grafika na białym tle – puste pasy wypełnią brakującą część formatu.'}
              </p>
            </>
          )}

          {step === 1 && (
            <div className="flex items-center gap-2 mt-3">
              <button type="button" onClick={() => rotateBy(-90)} className="btn-secondary text-xs flex items-center gap-1 px-2.5 py-1.5" aria-label="Obróć w lewo o 90 stopni">
                <ArrowUturnLeftIcon className="h-4 w-4" /> Obróć w lewo
              </button>
              <button type="button" onClick={() => rotateBy(90)} className="btn-secondary text-xs flex items-center gap-1 px-2.5 py-1.5" aria-label="Obróć w prawo o 90 stopni">
                <ArrowUturnRightIcon className="h-4 w-4" /> Obróć w prawo
              </button>
              <span className="text-xs text-gray-500 ml-auto" data-testid="rotation-label">
                {rotation}°
              </span>
            </div>
          )}
          {badgeText.trim() && !badgeForbidden && step === 2 && (
            <p className="help-text mt-2">
              Plakietka „{badgeText.trim()}” zostanie dodana {BADGE_POSITION_LABELS[badgePosition]}.
            </p>
          )}
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            {presetsFailed && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                Nie udało się pobrać ustawień platform.{' '}
                <button type="button" onClick={retryPresets} className="underline font-medium">
                  Spróbuj ponownie
                </button>
              </div>
            )}
            {!presets && !presetsFailed && <p className="help-text">Ładowanie ustawień platform...</p>}
            {presets && preset && (
              <>
                <fieldset>
                  <legend className="text-sm font-medium text-gray-700 mb-2">Platforma</legend>
                  <div className="grid grid-cols-2 gap-1.5">
                    {presets.map((p) => (
                      <label
                        key={p.id}
                        className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer text-sm text-gray-800 ${p.id === 'generic' ? 'col-span-2' : ''} ${platformId === p.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                      >
                        <input type="radio" name="platform" checked={platformId === p.id} onChange={() => choosePlatform(p)} />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-sm font-medium text-gray-700 mb-2">Proporcje</legend>
                  <div className="space-y-1.5">
                    {preset.ratios.map((r) => (
                      <label key={r} className={`flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer ${ratio === r ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                        <input type="radio" name="ratio" checked={ratio === r} onChange={() => chooseRatio(r)} className="mt-0.5" />
                        <span>
                          <span className="block text-sm text-gray-800">{r}</span>
                          <span className="block text-xs text-gray-600">
                            {RATIO_HINTS[r]} · {canvasSize(r, preset.targetSize)}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {preset.formats.length > 1 && (
                  <fieldset>
                    <legend className="text-sm font-medium text-gray-700 mb-2">Plik</legend>
                    <div className="flex flex-wrap gap-3">
                      {preset.formats.map((f) => (
                        <label key={f} className="flex items-center gap-1.5 text-sm text-gray-800">
                          <input type="radio" name="file-format" checked={format === f} onChange={() => setFormat(f)} />
                          {FORMAT_LABELS[f]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3" data-testid="platform-rules">
                  <p className="text-xs font-medium text-gray-700 mb-1.5">Zasady zdjęć: {preset.label}</p>
                  <ul className="space-y-1">
                    {preset.rules.map((rule) => (
                      <li key={rule.text} className="text-xs text-gray-700 flex items-start gap-1.5">
                        <span className={`shrink-0 rounded px-1.5 py-px font-medium ${rule.official ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-700'}`}>
                          {rule.official ? 'wymóg platformy' : 'zalecane'}
                        </span>
                        <span>{rule.text}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Źródło:{' '}
                    {isUrl(preset.source) ? (
                      <a href={preset.source} target="_blank" rel="noopener noreferrer" className="underline">
                        pomoc {preset.label}
                      </a>
                    ) : (
                      preset.source
                    )}
                  </p>
                  {preset.productFill && !isOriginal && (
                    <p className="text-xs text-amber-700 mt-1.5">Na zdjęcie główne wybierz grafikę w stylu „Białe tło” – tła sceny AI nie zmienia przy eksporcie.</p>
                  )}
                </div>

                {preset.id === 'vinted' && !isOriginal && (
                  <div role="note" data-testid="vinted-original" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <p>Vinted wymaga własnych zdjęć przedmiotu – sceny i tła wygenerowane przez AI mogą zostać odrzucone. Na Vinted wyeksportuj oryginalne zdjęcie: tylko kadr i format.</p>
                    <button type="button" onClick={() => switchSource('original')} className="btn-primary text-sm mt-2">
                      Użyj oryginalnego zdjęcia
                    </button>
                  </div>
                )}
                {isOriginal && generation && (
                  <button type="button" onClick={() => switchSource('generation')} className="text-xs text-blue-700 hover:underline">
                    Wróć do grafiki AI
                  </button>
                )}
              </>
            )}

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Kadr</p>
              <div className="grid grid-cols-2 gap-2">
                <label className={`rounded-lg border p-2.5 cursor-pointer ${framing === 'crop' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                  <span className="flex items-start gap-2">
                    <input type="radio" name="framing" checked={framing === 'crop'} onChange={() => setFraming('crop')} className="mt-0.5" />
                    <span>
                      <span className="block text-sm text-gray-800">Kadruj</span>
                      <span className="block text-xs text-gray-600">{isSquare ? 'przybliż wybrany fragment' : 'wybierz fragment, bez pasów'}</span>
                    </span>
                  </span>
                </label>
                <label className={`rounded-lg border p-2.5 cursor-pointer ${framing === 'fit' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                  <span className="flex items-start gap-2">
                    <input type="radio" name="framing" checked={framing === 'fit'} onChange={() => setFraming('fit')} className="mt-0.5" />
                    <span>
                      <span className="block text-sm text-gray-800">{isOriginal ? 'Całe zdjęcie' : 'Cała grafika'}</span>
                      <span className="block text-xs text-gray-600">{isSquare ? 'bez zmian' : 'białe pasy po bokach'}</span>
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {isOriginal ? (
              readyToShare ? (
                <button type="button" onClick={shareReady} className="btn-primary w-full flex items-center justify-center gap-2">
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  Zapisz w Zdjęciach
                </button>
              ) : (
                <button type="button" onClick={download} disabled={isExporting || cropPending || !preset} className="btn-primary w-full flex items-center justify-center gap-2">
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  {isExporting ? 'Przygotowuję...' : cropPending ? 'Ładowanie podglądu...' : 'Pobierz zdjęcie'}
                </button>
              )
            ) : (
              <button type="button" onClick={() => setStep(2)} disabled={cropPending || !preset} className="btn-primary w-full flex items-center justify-center gap-2">
                {cropPending ? 'Ładowanie podglądu...' : 'Dalej'}
                {!cropPending && <ArrowRightIcon className="h-4 w-4" />}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Korekta obrazu <span className="text-gray-500 font-normal">(opcjonalnie)</span>
              </p>
              <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                {SLIDERS.map((s) => (
                  <div key={s.key} className="flex items-center gap-3">
                    <label htmlFor={`adjust-${s.key}`} className="text-xs text-gray-700 w-20 shrink-0">
                      {s.label}
                    </label>
                    <input
                      id={`adjust-${s.key}`}
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={0.05}
                      value={adjust[s.key]}
                      onChange={(e) => setAdjust((a) => ({ ...a, [s.key]: Number(e.target.value) }))}
                      className="flex-1 accent-blue-600"
                    />
                    <span className="text-xs text-gray-500 w-10 text-right">{Math.round(adjust[s.key] * 100)}%</span>
                  </div>
                ))}
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" checked={adjust.sharpen} onChange={(e) => setAdjust((a) => ({ ...a, sharpen: e.target.checked }))} />
                  Lekko wyostrz (bez podglądu, widoczne w pobranym pliku)
                </label>
                <button type="button" onClick={() => setAdjust(DEFAULT_ADJUST)} disabled={isDefaultAdjust(adjust)} className="text-xs text-blue-700 hover:underline disabled:text-gray-500">
                  Przywróć oryginał
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="badge-text" className="block text-sm font-medium text-gray-700 mb-1">
                Plakietka promocyjna <span className="text-gray-500 font-normal">(opcjonalnie)</span>
              </label>
              <input
                id="badge-text"
                type="text"
                value={badgeForbidden ? '' : badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                disabled={badgeForbidden}
                aria-describedby="badge-note"
                maxLength={24}
                placeholder="np. -20%, NOWOŚĆ, DARMOWA DOSTAWA"
                className="input-field text-sm"
              />
              <p id="badge-note" className="text-xs text-amber-700 mt-1">
                {badgeForbidden
                  ? `${preset?.label} nie dopuszcza napisów ani plakietek na zdjęciu (wymóg platformy).`
                  : preset?.badge === 'discouraged'
                    ? `${preset.label}: lepiej bez napisów na zdjęciach (zalecane).`
                    : 'Uwaga: marketplace’y zwykle nie dopuszczają napisów na zdjęciu głównym. Plakietki używaj na kolejnych zdjęciach w galerii.'}
              </p>
              {badgeText.trim() && !badgeForbidden && (
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <div className="flex gap-1.5" role="radiogroup" aria-label="Kolor plakietki">
                    {COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={badgeColor === c.id}
                        onClick={() => setBadgeColor(c.id)}
                        className={`h-6 w-6 rounded-full ${c.className} ${badgeColor === c.id ? 'ring-2 ring-offset-2 ring-gray-800' : ''}`}
                        aria-label={c.name}
                      />
                    ))}
                  </div>
                  <label htmlFor="badge-position" className="sr-only">
                    Pozycja plakietki
                  </label>
                  <select id="badge-position" value={badgePosition} onChange={(e) => setBadgePosition(e.target.value as any)} className="text-sm border border-gray-300 rounded-lg px-2 py-1">
                    <option value="top-left">lewy górny róg</option>
                    <option value="top-right">prawy górny róg</option>
                    <option value="bottom-left">lewy dolny róg</option>
                    <option value="bottom-right">prawy dolny róg</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)} className="btn-secondary flex items-center gap-1">
                <ArrowLeftIcon className="h-4 w-4" /> Wstecz
              </button>
              {readyToShare ? (
                <button onClick={shareReady} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  Zapisz w Zdjęciach
                </button>
              ) : (
                <button onClick={download} disabled={isExporting || cropPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  {isExporting ? 'Przygotowuję...' : 'Pobierz'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
