import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { XMarkIcon, ArrowDownTrayIcon, EyeIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { descriptionsApi, infographicApi, InfographicOptions } from '../services/api'
import { track } from '../services/analytics'
import { downloadBlob } from '../utils/download'
import { featuresFromDescription, MAX_FEATURE_TEXT, MAX_FEATURES, MAX_TITLE, parseMeasure } from '../utils/infographic'
import FormAlert from './FormAlert'

interface Props {
  generationId: string
  imageId: string
  styleName: string
  onClose: () => void
}

type Template = InfographicOptions['template']
type Accent = NonNullable<InfographicOptions['accent']>

const ACCENTS: Array<{ id: Accent; className: string; name: string }> = [
  { id: 'blue', className: 'bg-blue-600', name: 'niebieski' },
  { id: 'green', className: 'bg-green-600', name: 'zielony' },
  { id: 'orange', className: 'bg-orange-600', name: 'pomarańczowy' },
  { id: 'red', className: 'bg-red-600', name: 'czerwony' },
  { id: 'black', className: 'bg-gray-900', name: 'czarny' },
]

const FALLBACK_ICONS = [{ id: 'check', name: 'Zaleta' }]

/**
 * Spec 14: free infographic for an additional offer photo – features with icons or dimension arrows,
 * rendered by the API (correct Polish text, no AI cost). Preview first, then download.
 */
export default function InfographicModal({ generationId, imageId, styleName, onClose }: Props) {
  const [template, setTemplate] = useState<Template>('features')
  const [title, setTitle] = useState('')
  const [features, setFeatures] = useState<Array<{ icon: string; text: string }>>([{ icon: 'check', text: '' }])
  const [dims, setDims] = useState({ width: '', height: '', depth: '', unit: 'cm' as 'mm' | 'cm' | 'm', weight: '', weightUnit: 'kg' as 'g' | 'kg' })
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [accent, setAccent] = useState<Accent>('blue')
  const [icons, setIcons] = useState(FALLBACK_ICONS)
  const [preview, setPreview] = useState<{ url: string; blob: Blob; key: string } | null>(null)
  const [busy, setBusy] = useState<'preview' | 'download' | null>(null)
  const [error, setError] = useState('')
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    infographicApi
      .icons()
      .then((r) => setIcons(r.data))
      .catch(() => undefined)
    // Prefill from the offer copy when the photo has one (the user edits them anyway).
    descriptionsApi
      .get(imageId)
      .then((r) => {
        const prefill = featuresFromDescription(r.data.description?.body)
        if (prefill.length) setFeatures((current) => (current.length === 1 && !current[0].text ? prefill.map((text) => ({ icon: 'check', text })) : current))
      })
      .catch(() => undefined)
  }, [imageId])

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url)
    },
    [preview],
  )

  const buildOptions = (): InfographicOptions | string => {
    const base = { title: title.trim() || undefined, theme, accent, format: 'png' as const }
    if (template === 'features') {
      const cleaned = features.map((f) => ({ icon: f.icon, text: f.text.trim() })).filter((f) => f.text)
      if (!cleaned.length) return 'Dodaj co najmniej jedną cechę.'
      return { ...base, template, features: cleaned }
    }
    const width = parseMeasure(dims.width)
    const height = parseMeasure(dims.height)
    const depth = parseMeasure(dims.depth)
    const weight = parseMeasure(dims.weight)
    if (width === undefined && height === undefined) return 'Podaj co najmniej szerokość albo wysokość.'
    if ([width, height, depth, weight].some((v) => v !== undefined && !(v > 0))) return 'Wymiary i waga muszą być liczbami większymi od zera (np. 12,5).'
    return {
      ...base,
      template,
      dimensions: { width, height, depth, unit: dims.unit, ...(weight !== undefined ? { weight, weightUnit: dims.weightUnit } : {}) },
    }
  }

  const render = async (purpose: 'preview' | 'download'): Promise<Blob | null> => {
    const options = buildOptions()
    if (typeof options === 'string') {
      setError(options)
      return null
    }
    const key = JSON.stringify(options)
    if (preview?.key === key) return preview.blob
    setBusy(purpose)
    setError('')
    try {
      const { data } = await infographicApi.render(generationId, options)
      // The previous object URL is revoked by the effect cleanup when `preview` changes.
      setPreview({ url: URL.createObjectURL(data), blob: data, key })
      return data
    } catch (err: any) {
      // Errors arrive as a Blob because the request asked for one.
      let message = 'Nie udało się przygotować infografiki'
      const body = err.response?.data
      if (body instanceof Blob) {
        try {
          const parsed = JSON.parse(await body.text())
          message = Array.isArray(parsed.message) ? parsed.message.join('. ') : parsed.message || message
        } catch {
          // keep the generic message
        }
      }
      setError(message)
      return null
    } finally {
      setBusy(null)
    }
  }

  const download = async () => {
    const blob = await render('download')
    if (!blob) return
    const method = await downloadBlob(blob, `infografika-${template}-${styleName}.png`)
    if (method !== 'cancelled') track('infographic_download', { template, features: features.length })
    if (method === 'open-tab' || method === 'anchor-ios') toast('Przytrzymaj obraz i wybierz „Zapisz obraz”, aby zapisać go w Zdjęciach.', { duration: 6000 })
  }

  const updateFeature = (index: number, patch: Partial<{ icon: string; text: string }>) => setFeatures((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)))

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <button type="button" aria-label="Zamknij okno" tabIndex={-1} onClick={onClose} className="absolute inset-0 w-full h-full cursor-default" />
      <div role="dialog" aria-modal="true" aria-labelledby="infographic-title" className="relative bg-white rounded-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 id="infographic-title" className="text-lg font-semibold text-gray-900">
            Infografika – zdjęcie dodatkowe
          </h2>
          <button ref={closeRef} onClick={onClose} aria-label="Zamknij" className="text-gray-500 hover:text-gray-700">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="help-text mb-4">Allegro nie pozwala na tekst na zdjęciu głównym – dodaj infografikę jako kolejne zdjęcie oferty. Bezpłatnie.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-2">Szablon</legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['features', 'Cechy z ikonami'],
                    ['dimensions', 'Wymiary'],
                  ] as const
                ).map(([id, label]) => (
                  <label key={id} className={`rounded-lg border p-2.5 cursor-pointer text-sm ${template === id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                    <input type="radio" name="infographic-template" checked={template === id} onChange={() => setTemplate(id)} className="mr-2" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="infographic-title-input" className="block text-sm font-medium text-gray-700 mb-1">
                Tytuł <span className="text-gray-500 font-normal">(opcjonalnie)</span>
              </label>
              <input
                id="infographic-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={MAX_TITLE}
                className="input-field text-sm"
                placeholder="np. Kubek termiczny 450 ml"
              />
            </div>

            {template === 'features' ? (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Cechy (1–{MAX_FEATURES})</p>
                <ul className="space-y-2">
                  {features.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <label className="sr-only" htmlFor={`feature-icon-${i}`}>
                        Ikona cechy {i + 1}
                      </label>
                      <select id={`feature-icon-${i}`} value={f.icon} onChange={(e) => updateFeature(i, { icon: e.target.value })} className="input-field text-sm w-36 shrink-0">
                        {icons.map((icon) => (
                          <option key={icon.id} value={icon.id}>
                            {icon.name}
                          </option>
                        ))}
                      </select>
                      <label className="sr-only" htmlFor={`feature-text-${i}`}>
                        Cecha {i + 1}
                      </label>
                      <input
                        id={`feature-text-${i}`}
                        value={f.text}
                        onChange={(e) => updateFeature(i, { text: e.target.value })}
                        maxLength={MAX_FEATURE_TEXT}
                        className="input-field text-sm"
                        placeholder="np. 2 lata gwarancji"
                      />
                      <button
                        type="button"
                        onClick={() => setFeatures((prev) => prev.filter((_, j) => j !== i))}
                        disabled={features.length === 1}
                        aria-label={`Usuń cechę ${i + 1}`}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-30"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                {features.length < MAX_FEATURES && (
                  <button type="button" onClick={() => setFeatures((prev) => [...prev, { icon: 'check', text: '' }])} className="mt-2 text-sm text-blue-600 hover:underline flex items-center gap-1">
                    <PlusIcon className="h-4 w-4" /> Dodaj cechę
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['width', 'Szerokość'],
                      ['height', 'Wysokość'],
                      ['depth', 'Głębokość'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <label htmlFor={`dim-${key}`} className="block text-xs font-medium text-gray-700 mb-1">
                        {label}
                      </label>
                      <input
                        id={`dim-${key}`}
                        inputMode="decimal"
                        value={dims[key]}
                        onChange={(e) => setDims((d) => ({ ...d, [key]: e.target.value }))}
                        className="input-field text-sm"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <label htmlFor="dim-unit" className="block text-xs font-medium text-gray-700 mb-1">
                      Jednostka
                    </label>
                    <select id="dim-unit" value={dims.unit} onChange={(e) => setDims((d) => ({ ...d, unit: e.target.value as 'mm' | 'cm' | 'm' }))} className="input-field text-sm">
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="dim-weight" className="block text-xs font-medium text-gray-700 mb-1">
                      Waga <span className="text-gray-500 font-normal">(opcj.)</span>
                    </label>
                    <input
                      id="dim-weight"
                      inputMode="decimal"
                      value={dims.weight}
                      onChange={(e) => setDims((d) => ({ ...d, weight: e.target.value }))}
                      className="input-field text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label htmlFor="dim-weight-unit" className="sr-only">
                      Jednostka wagi
                    </label>
                    <select id="dim-weight-unit" value={dims.weightUnit} onChange={(e) => setDims((d) => ({ ...d, weightUnit: e.target.value as 'g' | 'kg' }))} className="input-field text-sm">
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                </div>
                <p className="help-text">Przy grafice na białym tle strzałki przylegają do produktu.</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <fieldset className="flex items-center gap-2">
                <legend className="sr-only">Motyw</legend>
                {(
                  [
                    ['light', 'Jasny'],
                    ['dark', 'Ciemny'],
                  ] as const
                ).map(([id, label]) => (
                  <label key={id} className="text-sm text-gray-700 flex items-center gap-1">
                    <input type="radio" name="infographic-theme" checked={theme === id} onChange={() => setTheme(id)} /> {label}
                  </label>
                ))}
              </fieldset>
              <fieldset className="flex items-center gap-1.5">
                <legend className="sr-only">Kolor akcentu</legend>
                {ACCENTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAccent(a.id)}
                    aria-label={`Akcent ${a.name}`}
                    aria-pressed={accent === a.id}
                    className={`h-6 w-6 rounded-full ${a.className} ${accent === a.id ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                  />
                ))}
              </fieldset>
            </div>
          </div>

          <div>
            <div className="w-full aspect-square rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
              {preview ? (
                <img src={preview.url} alt="Podgląd infografiki" className="w-full h-full object-contain" />
              ) : (
                <p className="text-sm text-gray-500 px-6 text-center">Kliknij „Podgląd”, aby zobaczyć infografikę.</p>
              )}
            </div>
            {error && <FormAlert className="mt-3">{error}</FormAlert>}
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => render('preview')} disabled={busy !== null} className="btn-secondary flex-1 flex items-center justify-center gap-1.5">
                <EyeIcon className="h-4 w-4" />
                {busy === 'preview' ? 'Przygotowuję...' : 'Podgląd'}
              </button>
              <button type="button" onClick={download} disabled={busy !== null} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
                <ArrowDownTrayIcon className="h-4 w-4" />
                {busy === 'download' ? 'Przygotowuję...' : 'Pobierz PNG'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
