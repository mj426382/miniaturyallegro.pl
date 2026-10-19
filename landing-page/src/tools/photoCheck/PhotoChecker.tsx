import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import RichText from '../../components/RichText'
import { BACKGROUND_LABEL, FORMAT_LABEL, ORIENTATION_LABEL, formatBytes, formatMegapixels, type ImageAnalysis } from './analyze'
import { analyzeFile } from './browser'
import { STATUS_LABEL, evaluateAll, sourceOf, type PlatformResult, type Status } from './requirements'
import { plural, tipsFor } from './tips'

interface Checked {
  id: string
  analysis: ImageAnalysis
  results: PlatformResult[]
  tips: string[]
  preview: string | null
}

const STATUS_STYLE: Record<Status, { icon: string; className: string }> = {
  pass: { icon: '✓', className: 'bg-green-100 text-green-900 border-green-300' },
  warn: { icon: '!', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  fail: { icon: '✗', className: 'bg-red-100 text-red-900 border-red-300' },
  info: { icon: '–', className: 'bg-gray-100 text-gray-800 border-gray-300' },
}

function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_STYLE[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${s.className}`}>
      <span aria-hidden="true">{s.icon}</span>
      {STATUS_LABEL[status]}
    </span>
  )
}

/** Local date (YYYY-MM-DD) – decides requirements that apply from a future date (Google Merchant Center). */
function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function summary(items: Checked[]): string {
  const parts = items.map((i) => {
    if (i.analysis.error) return `${i.analysis.name}: nie udało się odczytać pliku`
    const count = (s: Status) => i.results.filter((r) => r.status === s).length
    return `${i.analysis.name}: zgodne ${count('pass')}, uwagi ${count('warn')}, niezgodne ${count('fail')}`
  })
  return `Sprawdzono ${plural(items.length, 'zdjęcie', 'zdjęcia', 'zdjęć')}. ${parts.join('; ')}.`
}

function Facts({ a }: { a: ImageAnalysis }) {
  const rows: Array<[string, string]> = [
    ['Format', FORMAT_LABEL[a.format]],
    ['Wymiary', a.width && a.height ? `${a.width} × ${a.height} px${a.rotatedByMetadata ? ' (po obrocie z EXIF)' : ''}` : 'nie odczytano'],
    ['Proporcje', a.ratio?.label ?? '–'],
    ['Orientacja', a.orientation ? ORIENTATION_LABEL[a.orientation] : '–'],
    ['Rozdzielczość', a.megapixels !== null ? formatMegapixels(a.megapixels) : '–'],
    ['Waga pliku', formatBytes(a.bytes)],
    [
      'Przezroczystość',
      a.pixels
        ? a.pixels.transparentShare > 0
          ? `tak (${Math.max(1, Math.round(a.pixels.transparentShare * 100))}% pikseli)`
          : 'brak przezroczystych pikseli'
        : a.hasAlphaChannel === null
          ? 'nie można sprawdzić'
          : a.hasAlphaChannel
            ? 'plik ma kanał alfa'
            : 'brak (format bez kanału alfa)',
    ],
    [
      'Tło przy krawędziach (szacunek)',
      a.pixels ? `${BACKGROUND_LABEL[a.pixels.border.verdict]} – czysta biel: ${Math.round(a.pixels.border.pureWhiteShare * 100)}% pikseli` : 'nie można ocenić (przeglądarka nie odczytała pikseli)',
    ],
  ]
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-wrap gap-x-2">
          <dt className="font-medium text-gray-900">{k}:</dt>
          <dd className="text-gray-700 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Results({ item }: { item: Checked }) {
  return (
    <div className="mt-6 rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-left text-sm table-fixed">
        <caption className="sr-only">Wynik dla platform: {item.analysis.name}</caption>
        <thead className="bg-gray-100 text-gray-900">
          <tr>
            <th scope="col" className="w-[38%] sm:w-1/4 px-3 py-2 font-semibold">
              Platforma
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              Szczegóły
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 align-top">
          {item.results.map((r) => (
            <tr key={r.platform.id} data-platform={r.platform.id} data-status={r.status}>
              <th scope="row" className="px-3 py-3 font-medium text-gray-900 break-words">
                <span className="block mb-1">{r.platform.name}</span>
                <StatusBadge status={r.status} />
              </th>
              <td className="px-3 py-3 text-gray-700 break-words">
                {r.checks.length > 0 ? (
                  <ul className="space-y-1">
                    {r.checks.map((c) => (
                      <li key={c.requirement.label}>
                        <span className="sr-only">{STATUS_LABEL[c.status]}: </span>
                        <span aria-hidden="true" className="font-bold mr-1">
                          {STATUS_STYLE[c.status].icon}
                        </span>
                        {c.message}{' '}
                        <a href={sourceOf(r.platform, c.requirement.source).url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">
                          źródło
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    {r.platform.name} nie publikuje wymagań technicznych, które da się sprawdzić w pliku ({r.platform.undocumented.join(', ').toLowerCase()}: brak oficjalnej wartości). Zasady treści:{' '}
                    {r.platform.notes.map((n) => n.text).join(' ')}
                  </p>
                )}
                <Link to={r.platform.landing} className="inline-block mt-2 text-blue-700 underline underline-offset-2">
                  Zdjęcia na {r.platform.name.replace(' (zdjęcie główne)', '')} – poradnik
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Spec 25 (AC-TOOL-004/005): the interactive checker. Files are read and decoded locally (browser.ts); nothing is uploaded.
 * The file input is disabled in the prerendered HTML and enabled after hydration.
 */
export default function PhotoChecker() {
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [items, setItems] = useState<Checked[]>([])
  const [announcement, setAnnouncement] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const previews = useRef<string[]>([])

  useEffect(() => {
    setReady(true)
    return () => previews.current.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  const clear = () => {
    previews.current.forEach((u) => URL.revokeObjectURL(u))
    previews.current = []
    setItems([])
    setAnnouncement('Wyniki wyczyszczone.')
    if (inputRef.current) inputRef.current.value = ''
  }

  const check = async (files: File[]) => {
    if (files.length === 0) return
    clear()
    setBusy(true)
    setAnnouncement(`Sprawdzam ${plural(files.length, 'zdjęcie', 'zdjęcia', 'zdjęć')}…`)
    const date = today()
    const checked = await Promise.all(
      files.map(async (file, i): Promise<Checked> => {
        const analysis = await analyzeFile(file)
        const results = evaluateAll(analysis, date)
        const preview = analysis.error ? null : URL.createObjectURL(file)
        if (preview) previews.current.push(preview)
        return { id: `${i}-${file.name}-${file.size}`, analysis, results, tips: tipsFor(analysis, results), preview }
      }),
    )
    setItems(checked)
    setBusy(false)
    setAnnouncement(summary(checked))
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (!ready) return
    void check([...e.dataTransfer.files])
  }

  const ratios = new Set(items.filter((i) => i.analysis.ratio).map((i) => i.analysis.ratio!.label))

  return (
    <div data-photo-checker-tool="">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        data-testid="photo-dropzone"
        className={`rounded-2xl border-2 border-dashed p-6 md:p-10 text-center transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}
      >
        <label htmlFor="photo-checker-files" className="block text-lg font-semibold text-gray-900 mb-2">
          Wybierz zdjęcia produktu
        </label>
        <p id="photo-checker-hint" className="text-sm text-gray-600 mb-4">
          JPEG, PNG, WebP, HEIC, AVIF, GIF, BMP lub TIFF – jedno albo kilka naraz. Możesz też przeciągnąć pliki na to pole. Zdjęcia nie opuszczają Twojego urządzenia.
        </p>
        <input
          ref={inputRef}
          id="photo-checker-files"
          type="file"
          multiple
          accept="image/*,.heic,.heif,.avif"
          disabled={!ready || busy}
          aria-describedby="photo-checker-hint"
          onChange={(e) => void check([...(e.target.files ?? [])])}
          className="mx-auto block w-full max-w-sm text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60"
        />
        {!ready && <p className="mt-3 text-xs text-gray-500">Narzędzie uruchamia się w przeglądarce…</p>}
      </div>

      <p role="status" aria-live="polite" className="mt-4 text-sm text-gray-800 min-h-[1.25rem]" data-testid="photo-checker-status">
        {announcement}
      </p>

      {items.length > 0 && (
        <div className="mt-4 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">Wyniki są szacunkiem na podstawie pliku – przed publikacją sprawdź aktualne zasady platformy (linki „źródło”).</p>
            <button
              type="button"
              onClick={clear}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Wyczyść wyniki
            </button>
          </div>
          {ratios.size > 1 && (
            <p className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
              Zdjęcia mają różne proporcje ({[...ratios].join(', ')}). Shopify zaleca jedną, spójną proporcję zdjęć głównych – w siatce produktów wyglądają wtedy równo.
            </p>
          )}
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6" data-testid="photo-result">
              <div className="flex flex-col sm:flex-row gap-4">
                {item.preview && (
                  <img
                    src={item.preview}
                    alt={`Podgląd: ${item.analysis.name}`}
                    className="h-28 w-28 shrink-0 rounded-lg border border-gray-200 bg-gray-50 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 break-all">{item.analysis.name}</h3>
                  {item.analysis.error ? <p className="mt-2 text-red-800">{item.analysis.error}</p> : <Facts a={item.analysis} />}
                </div>
              </div>
              {!item.analysis.error && <Results item={item} />}
              <div className="mt-4">
                <p className="font-semibold text-gray-900 mb-2">Wskazówki</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                  {item.tips.map((t) => (
                    <li key={t}>
                      <RichText text={t} />
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
