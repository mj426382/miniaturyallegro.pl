import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { track } from '../services/analytics'
import { downloadBlob } from '../utils/download'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'https://server.allgrafika.pl/api'
const APP_URL = 'https://app.allgrafika.pl'
const POLL_MS = 3000
const MAX_POLLS = 60

const STYLES = [
  { id: 'white-bg', label: 'Białe tło (zdjęcie główne Allegro)' },
  { id: 'lifestyle-home', label: 'Lifestyle – wnętrze' },
  { id: 'dark-luxury', label: 'Ciemny luksus' },
]

type Phase = 'form' | 'uploading' | 'processing' | 'done' | 'failed' | 'slow'

interface DemoResult {
  id: string
  status: string
  originalUrl: string
  resultUrl: string | null
  registerUrl: string
}

/**
 * "Try it without an account": one free generation from the landing page.
 * Rate-limited server-side (per e-mail and per IP); the result is also e-mailed.
 */
export default function DemoWidget() {
  const [phase, setPhase] = useState<Phase>('form')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [style, setStyle] = useState('white-bg')
  const [consent, setConsent] = useState(false)
  const [marketingOk, setMarketingOk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DemoResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollsRef = useRef(0)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (preview) URL.revokeObjectURL(preview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Returning from the e-mail link: /?demo=<id>
  useEffect(() => {
    if (typeof window === 'undefined') return
    const id = new URLSearchParams(window.location.search).get('demo')
    if (id) {
      setPhase('processing')
      poll(id)
      setTimeout(() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' }), 300)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const poll = async (id: string) => {
    if (!mountedRef.current) return
    try {
      const { data } = await axios.get<DemoResult>(`${API_URL}/demo/${id}`)
      if (!mountedRef.current) return
      setResult(data)
      if (data.status === 'COMPLETED') {
        setPhase('done')
        track('demo_done', { style })
        return
      }
      if (data.status === 'FAILED') {
        setPhase('failed')
        return
      }
      if (pollsRef.current++ < MAX_POLLS) setTimeout(() => poll(id), POLL_MS)
      else setPhase('slow')
    } catch {
      if (mountedRef.current) setPhase('failed')
    }
  }

  const [isDownloading, setIsDownloading] = useState(false)
  const downloadResult = async () => {
    if (!result?.resultUrl) return
    setIsDownloading(true)
    try {
      const { data } = await axios.get<Blob>(result.resultUrl, { responseType: 'blob' })
      const method = await downloadBlob(data, `allgrafika-${style}.png`)
      if (method !== 'cancelled') track('demo_download', { method })
    } catch {
      window.open(result.resultUrl, '_blank')
    } finally {
      setIsDownloading(false)
    }
  }

  const onFile = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !email || !consent) return
    setError(null)
    setPhase('uploading')
    track('demo_start', { style })
    const form = new FormData()
    form.append('file', file)
    form.append('email', email.trim())
    form.append('style', style)
    form.append('marketingOk', String(marketingOk))
    const honeypot = (document.getElementById('demo-website') as HTMLInputElement | null)?.value
    if (honeypot) form.append('website', honeypot)
    try {
      const { data } = await axios.post<{ id: string }>(`${API_URL}/demo`, form)
      setPhase('processing')
      pollsRef.current = 0
      poll(data.id)
    } catch (err: any) {
      const message = err.response?.data?.message
      setError(Array.isArray(message) ? message.join('. ') : message || 'Nie udało się wysłać zdjęcia. Spróbuj ponownie.')
      setPhase('form')
    }
  }

  return (
    <section id="demo" className="py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            Sprawdź na <span className="text-blue-600">własnym produkcie</span> – bez zakładania konta
          </h2>
          <p className="text-gray-500 mt-4 text-lg">Wgraj zdjęcie, wybierz styl i po około minucie zobaczysz wynik. Jedna darmowa próba na adres e-mail.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
          {phase === 'form' || phase === 'uploading' ? (
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className={`w-full aspect-square rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden ${preview ? 'border-green-400' : 'border-gray-300 hover:border-blue-400'}`}
                >
                  {preview ? (
                    <img src={preview} alt="Twoje zdjęcie" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-gray-500 text-sm px-6 text-center">
                      Kliknij i wybierz zdjęcie produktu
                      <br />
                      <span className="text-xs text-gray-400">JPG, PNG, WebP · maks. 10 MB</span>
                    </span>
                  )}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="demo-style" className="block text-sm font-medium text-gray-700 mb-1">
                    Styl
                  </label>
                  <select id="demo-style" value={style} onChange={(e) => setStyle(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {STYLES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="demo-email" className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail <span className="text-gray-400 font-normal">(wyślemy tam wynik)</span>
                  </label>
                  <input
                    id="demo-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="twoj@sklep.pl"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                {/* honeypot – hidden from humans */}
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="demo-website">Strona www</label>
                  <input id="demo-website" type="text" tabIndex={-1} autoComplete="off" />
                </div>
                <label className="flex items-start gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" required />
                  <span>
                    Akceptuję{' '}
                    <Link to="/regulamin" target="_blank" className="underline">
                      regulamin
                    </Link>{' '}
                    i{' '}
                    <Link to="/polityka-prywatnosci" target="_blank" className="underline">
                      politykę prywatności
                    </Link>
                    . Zdjęcie zostanie przekazane dostawcom modeli AI w celu wygenerowania grafiki.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={marketingOk} onChange={(e) => setMarketingOk(e.target.checked)} className="mt-0.5" />
                  <span>Chcę otrzymywać od AllGrafika porady o miniaturkach i informacje o nowościach (opcjonalnie, możesz zrezygnować w każdej chwili).</span>
                </label>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={!file || !email || !consent || phase === 'uploading'}
                  className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                >
                  {phase === 'uploading' ? 'Wysyłanie...' : 'Wygeneruj darmową grafikę'}
                </button>
              </div>
            </form>
          ) : phase === 'processing' ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-700 font-medium">AI analizuje produkt i generuje grafikę...</p>
              <p className="text-sm text-gray-400 mt-1">Zwykle trwa to 30–90 sekund. Wynik wyślemy też na e-mail.</p>
            </div>
          ) : phase === 'done' && result ? (
            <div>
              <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                <figure>
                  <img src={result.originalUrl} alt="Przed" className="w-full aspect-square object-contain rounded-xl border border-gray-200 bg-gray-50" />
                  <figcaption className="text-center text-xs text-gray-500 mt-2">Twoje zdjęcie</figcaption>
                </figure>
                <figure>
                  <img src={result.resultUrl ?? ''} alt="Po" className="w-full aspect-square object-cover rounded-xl border border-blue-200" />
                  <figcaption className="text-center text-xs text-blue-700 mt-2">Grafika AllGrafika</figcaption>
                </figure>
              </div>
              <div className="text-center mt-8">
                <button
                  type="button"
                  onClick={downloadResult}
                  disabled={isDownloading}
                  className="inline-block border border-gray-300 text-gray-700 font-medium px-6 py-3 rounded-xl hover:bg-gray-50 mr-3 disabled:opacity-50"
                >
                  {isDownloading ? 'Pobieram...' : 'Pobierz'}
                </button>
                <a href={`${APP_URL}/register`} onClick={() => track('demo_register_click')} className="inline-block bg-yellow-400 text-gray-900 font-bold px-6 py-3 rounded-xl hover:bg-yellow-300">
                  Załóż konto – 10 grafik gratis →
                </a>
                <p className="text-xs text-gray-400 mt-3">W aplikacji wygenerujesz wszystkie 6 stylów, własne sceny i opublikujesz grafiki prosto do oferty Allegro.</p>
              </div>
            </div>
          ) : phase === 'slow' ? (
            <div className="text-center py-12">
              <p className="text-gray-700 font-medium">Generowanie trwa dłużej niż zwykle.</p>
              <p className="text-sm text-gray-500 mt-1">Nie musisz czekać – gotową grafikę wyślemy na podany adres e-mail.</p>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-700 font-medium">Nie udało się wygenerować grafiki.</p>
              <p className="text-sm text-gray-500 mt-1">Spróbuj z innym zdjęciem albo załóż darmowe konto – tam masz 10 prób.</p>
              <button
                onClick={() => {
                  setPhase('form')
                  setResult(null)
                }}
                className="mt-6 text-blue-600 underline text-sm"
              >
                Spróbuj ponownie
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
