import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { XMarkIcon, ArrowDownTrayIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { exportApi, ExportOptions, ImageAdjustments } from '../services/api'
import { track } from '../services/analytics'
import { downloadBlob, shareBlob } from '../utils/download'
import { CropRect, ratioToAspect } from '../utils/crop'
import CropEditor, { Rotation } from './CropEditor'

interface Props {
  generationId: string
  styleName: string
  previewUrl: string
  onClose: () => void
}

const PRESETS: Array<{ id: string; label: string; hint: string; options: ExportOptions }> = [
  { id: 'allegro-main', label: 'Allegro – zdjęcie główne', hint: '1:1, 1600 px, bez plakietki', options: { ratio: '1:1', size: 1600, format: 'jpeg' } },
  { id: 'allegro-gallery', label: 'Allegro – galeria 4:3', hint: '1600×1200 px', options: { ratio: '4:3', size: 1600, format: 'jpeg' } },
  { id: 'ads', label: 'Allegro Ads / baner 16:9', hint: '1920×1080 px', options: { ratio: '16:9', size: 1920, format: 'jpeg' } },
  { id: 'social', label: 'Social / stories 3:4', hint: '1350×1800 px', options: { ratio: '3:4', size: 1800, format: 'jpeg' } },
  { id: 'png', label: 'PNG wysokiej jakości', hint: '1:1, 2000 px, bezstratnie', options: { ratio: '1:1', size: 2000, format: 'png' } },
]

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

/** Generated graphics are square, so any other ratio needs a decision – default to framing it. */
const defaultFraming = (ratio: ExportOptions['ratio']): Framing => (ratio && ratio !== '1:1' ? 'crop' : 'fit')

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

export default function ExportModal({ generationId, styleName, previewUrl, onClose }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [preset, setPreset] = useState(PRESETS[0])
  const [framing, setFraming] = useState<Framing>(defaultFraming(PRESETS[0].options.ratio))
  const [crop, setCrop] = useState<CropRect | null>(null)
  const [rotation, setRotation] = useState<Rotation>(0)
  const [adjust, setAdjust] = useState<Required<ImageAdjustments>>(DEFAULT_ADJUST)
  const [badgeText, setBadgeText] = useState('')
  const [badgeColor, setBadgeColor] = useState<NonNullable<ExportOptions['badgeColor']>>('red')
  const [badgePosition, setBadgePosition] = useState<NonNullable<ExportOptions['badgePosition']>>('top-left')
  const [isExporting, setIsExporting] = useState(false)
  const [readyToShare, setReadyToShare] = useState<{ blob: Blob; name: string } | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const choosePreset = (p: (typeof PRESETS)[number]) => {
    setPreset(p)
    setFraming(defaultFraming(p.options.ratio))
    setCrop(null)
  }

  const onCropChange = useCallback((next: CropRect) => setCrop(next), [])
  const rotateBy = (delta: 90 | -90) => {
    setRotation((r) => ((r + delta + 360) % 360) as Rotation)
    setCrop(null)
  }

  const ratio = preset.options.ratio ?? '1:1'
  const isSquare = ratio === '1:1'
  const cropPending = framing === 'crop' && !crop
  const filter = isDefaultAdjust(adjust) ? undefined : cssFilter(adjust)

  const download = async () => {
    setIsExporting(true)
    try {
      const options: ExportOptions = { ...preset.options }
      if (framing === 'crop' && crop) options.crop = crop
      if (rotation !== 0) options.rotate = rotation
      if (!isDefaultAdjust(adjust)) options.adjust = adjust
      if (badgeText.trim()) {
        options.badgeText = badgeText.trim()
        options.badgeColor = badgeColor
        options.badgePosition = badgePosition
      }
      const { data } = await exportApi.export(generationId, options)
      const ext = options.format === 'png' ? 'png' : options.format === 'webp' ? 'webp' : 'jpg'
      const name = `grafika-${styleName}-${ratio.replace(':', 'x')}.${ext}`
      const method = await downloadBlob(data, name)
      if (method !== 'cancelled') track('export', { preset: preset.id, framing, rotated: rotation !== 0, adjusted: Boolean(options.adjust), badge: Boolean(options.badgeText), method })
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <button type="button" aria-label="Zamknij okno" tabIndex={-1} onClick={onClose} className="absolute inset-0 w-full h-full cursor-default" />
      <div role="dialog" aria-modal="true" aria-labelledby="export-modal-title" className="relative bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 id="export-modal-title" className="text-lg font-semibold text-gray-900">
            Eksportuj grafikę
          </h2>
          <button ref={closeRef} onClick={onClose} aria-label="Zamknij" className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <ol className="flex items-center gap-2 text-xs mb-5" aria-label="Kroki eksportu">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2" aria-current={step === s.id ? 'step' : undefined}>
              <span className={`h-5 w-5 rounded-full flex items-center justify-center font-semibold ${step >= s.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{s.id}</span>
              <span className={step === s.id ? 'text-gray-900 font-medium' : 'text-gray-500'}>{s.label}</span>
              {i < STEPS.length - 1 && <span className="w-6 border-t border-gray-300" aria-hidden="true" />}
            </li>
          ))}
        </ol>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Preview column – stays on both steps so corrections are visible live. */}
          <div>
            {framing === 'crop' ? (
              <CropEditor image={previewUrl} aspect={ratioToAspect(ratio)} rotation={rotation} filter={filter} onChange={onCropChange} />
            ) : (
              <>
                <div className="w-full rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden" style={{ aspectRatio: ratioToAspect(ratio) }}>
                  <img src={previewUrl} alt={styleName} className="max-w-full max-h-full object-contain" style={{ transform: `rotate(${rotation}deg)`, filter }} />
                </div>
                <p className="help-text mt-2">{isSquare ? 'Cała grafika bez zmian.' : 'Cała grafika na białym tle – puste pasy wypełnią brakującą część formatu.'}</p>
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
            {badgeText.trim() && step === 2 && (
              <p className="help-text mt-2">
                Plakietka „{badgeText.trim()}” zostanie dodana w rogu: {badgePosition}.
              </p>
            )}
          </div>

          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Format</p>
                <div className="space-y-1.5">
                  {PRESETS.map((p) => (
                    <label key={p.id} className={`flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer ${preset.id === p.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                      <input type="radio" name="preset" checked={preset.id === p.id} onChange={() => choosePreset(p)} className="mt-0.5" />
                      <span>
                        <span className="block text-sm text-gray-800">{p.label}</span>
                        <span className="block text-xs text-gray-600">{p.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

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
                        <span className="block text-sm text-gray-800">Cała grafika</span>
                        <span className="block text-xs text-gray-600">{isSquare ? 'bez zmian' : 'białe pasy po bokach'}</span>
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <button type="button" onClick={() => setStep(2)} disabled={cropPending} className="btn-primary w-full flex items-center justify-center gap-2">
                {cropPending ? 'Ładowanie podglądu...' : 'Dalej'}
                {!cropPending && <ArrowRightIcon className="h-4 w-4" />}
              </button>
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
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value)}
                  maxLength={24}
                  placeholder="np. -20%, NOWOŚĆ, DARMOWA DOSTAWA"
                  className="input-field text-sm"
                />
                <p className="text-xs text-amber-700 mt-1">Uwaga: Allegro nie dopuszcza napisów na zdjęciu głównym. Plakietki używaj na kolejnych zdjęciach w galerii.</p>
                {badgeText.trim() && (
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
                  <button
                    onClick={() => {
                      const { blob, name } = readyToShare
                      setReadyToShare(null)
                      shareBlob(blob, name).then((ok) => {
                        if (!ok) downloadBlob(blob, name)
                      })
                    }}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
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
      </div>
    </div>
  )
}
