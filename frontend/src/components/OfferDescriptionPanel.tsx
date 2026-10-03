import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowUturnLeftIcon, ClipboardDocumentIcon, DocumentTextIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { descriptionsApi, DescriptionView, OfferDescription } from '../services/api'
import { track } from '../services/analytics'
import { allegroHtmlToText, compactAllegroHtml, formatAllegroHtml, MAX_TITLE_LENGTH, splitKeywords } from '../utils/allegroHtml'

interface Props {
  imageId: string
  /** The API refuses to write copy for a photo without a finished graphic – mirrored in the UI. */
  hasCompletedGraphic: boolean
  /** Called after a credit was spent so the header balance refreshes. */
  onCreditsChanged?: () => void
  /** Reports whether a description exists (after load and after every change). */
  onStateChange?: (hasDescription: boolean) => void
}

interface Draft {
  title: string
  html: string
  keywords: string
}

const NOTES_PLACEHOLDER = 'Np. kubek ceramiczny 350 ml, biały, nadaje się do zmywarki i mikrofali, w zestawie łyżeczka, prezent na święta, ' + 'producent z Bolesławca, wymiary 9 × 8 cm'

const toDraft = (d: OfferDescription): Draft => ({ title: d.title, html: formatAllegroHtml(d.body), keywords: d.keywords.join(', ') })

export default function OfferDescriptionPanel({ imageId, hasCompletedGraphic, onCreditsChanged, onStateChange }: Props) {
  const navigate = useNavigate()
  const [view, setView] = useState<DescriptionView | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [busy, setBusy] = useState<'create' | 'refine' | 'save' | 'buy' | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [undo, setUndo] = useState<Draft | null>(null)
  const [tab, setTab] = useState<'preview' | 'html'>('preview')
  const [instruction, setInstruction] = useState('')

  const applyView = useCallback(
    (next: DescriptionView, options: { keepDraft?: boolean } = {}) => {
      setView(next)
      if (next.description && !options.keepDraft) setDraft(toDraft(next.description))
      if (!next.description) setDraft(null)
      onStateChange?.(Boolean(next.description))
    },
    [onStateChange],
  )

  useEffect(() => {
    let cancelled = false
    descriptionsApi
      .get(imageId)
      .then(({ data }) => {
        if (cancelled) return
        applyView(data)
        setNotes(data.description?.sellerNotes ?? '')
      })
      .catch(() => !cancelled && setLoadFailed(true))
    return () => {
      cancelled = true
    }
  }, [imageId, applyView])

  const description = view?.description ?? null
  const canCreate = (view?.canCreate ?? false) || hasCompletedGraphic
  const editsLeft = view?.promptEditsLeft ?? 0
  const editsLimit = view?.promptEditsLimit ?? 10
  const packSize = view?.editPackSize ?? 15
  const packCredits = view?.editPackCredits ?? 1

  const dirty = useMemo(() => {
    if (!description || !draft) return false
    return draft.title !== description.title || compactAllegroHtml(draft.html) !== description.body || splitKeywords(draft.keywords).join('|') !== description.keywords.join('|')
  }, [description, draft])

  const previewHtml = useMemo(() => (draft ? compactAllegroHtml(draft.html) : ''), [draft])
  const titleTooLong = (draft?.title.length ?? 0) > MAX_TITLE_LENGTH

  const showError = (err: any, fallback: string) => {
    if (err?.response?.status === 402 && err.response.data?.code !== 'EDIT_PACK_REQUIRED') {
      toast.error(err.response.data?.message || 'Brak kredytów', { duration: 6000 })
      navigate('/credits')
      return
    }
    const message = err?.response?.data?.message
    toast.error(Array.isArray(message) ? message.join('. ') : message || fallback, { duration: 6000 })
  }

  const create = async () => {
    if (busy) return
    setBusy('create')
    try {
      const { data } = await descriptionsApi.create(imageId, notes.trim() || undefined)
      applyView(data)
      setUndo(null)
      setShowNotes(false)
      setTab('preview')
      track('description_create', { withNotes: Boolean(notes.trim()) })
      toast.success('Opis gotowy. Sprawdź fakty i dopasuj go do siebie.')
      onCreditsChanged?.()
    } catch (err) {
      showError(err, 'Nie udało się wygenerować opisu')
    } finally {
      setBusy(null)
    }
  }

  const refine = async () => {
    if (busy || !draft || instruction.trim().length < 3) return
    setBusy('refine')
    const snapshot = draft
    try {
      // Unsaved manual edits would be lost by a rewrite – persist them first.
      if (dirty) await save(true)
      const { data } = await descriptionsApi.refine(imageId, instruction.trim())
      setUndo(snapshot)
      applyView(data)
      setInstruction('')
      track('description_refine', { left: data.promptEditsLeft })
    } catch (err) {
      showError(err, 'Nie udało się poprawić opisu')
    } finally {
      setBusy(null)
    }
  }

  const save = async (silent = false) => {
    if (!draft) return
    if (titleTooLong) {
      toast.error(`Tytuł może mieć maksymalnie ${MAX_TITLE_LENGTH} znaków (limit Allegro).`)
      throw new Error('title too long')
    }
    if (!silent) setBusy('save')
    try {
      const { data } = await descriptionsApi.update(imageId, {
        title: draft.title.trim(),
        body: compactAllegroHtml(draft.html),
        keywords: splitKeywords(draft.keywords),
      })
      applyView(data)
      if (!silent) toast.success('Zapisano zmiany w opisie.')
    } catch (err) {
      if (!silent) showError(err, 'Nie udało się zapisać opisu')
      throw err
    } finally {
      if (!silent) setBusy(null)
    }
  }

  const buyPack = async () => {
    if (busy) return
    setBusy('buy')
    try {
      const { data } = await descriptionsApi.buyEditPack(imageId)
      applyView(data, { keepDraft: true })
      track('description_buy_pack', { left: data.promptEditsLeft })
      toast.success(`Dodano ${packSize} poprawek promptem dla tego zdjęcia.`)
      onCreditsChanged?.()
    } catch (err) {
      showError(err, 'Nie udało się dokupić poprawek')
    } finally {
      setBusy(null)
    }
  }

  const restore = () => {
    if (!undo) return
    setDraft(undo)
    setUndo(null)
    toast('Przywrócono poprzednią wersję – kliknij „Zapisz zmiany”, aby ją zachować.')
  }

  const copy = async (what: 'title' | 'html' | 'text') => {
    if (!draft) return
    const value = what === 'title' ? draft.title.trim() : what === 'html' ? compactAllegroHtml(draft.html) : allegroHtmlToText(draft.html)
    try {
      await navigator.clipboard.writeText(value)
      toast.success(what === 'title' ? 'Tytuł skopiowany.' : what === 'html' ? 'Opis (HTML) skopiowany – wklej go w edytorze opisu Allegro.' : 'Opis (tekst) skopiowany.')
      track('description_copy', { what })
    } catch {
      toast.error('Nie udało się skopiować – zaznacz tekst i skopiuj ręcznie.')
    }
  }

  if (loadFailed) return null

  return (
    <section className="mt-10 bg-white rounded-xl border border-gray-200 p-5 sm:p-6" aria-labelledby="offer-description-title">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 id="offer-description-title" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-blue-600" />
            Opis oferty pod SEO Allegro
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Tytuł (do 75 znaków), opis w formacie Allegro i frazy, pod którymi kupujący znajdą produkt. Powstaje z Twoich notatek i analizy zdjęcia. Pierwszy opis jest gratis do wygenerowanej grafiki;
            w cenie masz {editsLimit} poprawek AI, kolejne {packSize} za {packCredits} kredyt.
          </p>
        </div>
        {description && (
          <span className="text-xs text-gray-500 shrink-0">
            Poprawki promptem: {editsLeft} z {editsLimit}
          </span>
        )}
      </div>

      {(!description || showNotes) && (
        <div className="mt-4">
          <label htmlFor="description-notes" className="block text-sm font-medium text-gray-700 mb-1">
            Co warto napisać o produkcie? <span className="text-gray-500 font-normal">(opcjonalnie, ale im więcej faktów, tym lepszy opis)</span>
          </label>
          <textarea id="description-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={4} placeholder={NOTES_PLACEHOLDER} className="input-field text-sm" />
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <button onClick={create} disabled={!canCreate || busy !== null || (Boolean(description) && editsLeft === 0)} className="btn-primary flex items-center gap-2">
              <SparklesIcon className="h-5 w-5" />
              {busy === 'create' ? 'Piszę opis...' : description ? 'Napisz od nowa (1 poprawka)' : 'Wygeneruj opis (gratis)'}
            </button>
            {description && (
              <button onClick={() => setShowNotes(false)} className="text-sm text-gray-500 hover:text-gray-700">
                Anuluj
              </button>
            )}
            {!canCreate && <p className="text-sm text-amber-600">Najpierw wygeneruj co najmniej jedną grafikę – opis powstaje na jej podstawie.</p>}
          </div>
        </div>
      )}

      {description && draft && (
        <div className="mt-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="description-title" className="text-sm font-medium text-gray-700">
                Tytuł oferty
              </label>
              <span className={`text-xs ${titleTooLong ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                {draft.title.length}/{MAX_TITLE_LENGTH}
              </span>
            </div>
            <input
              id="description-title"
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className={`input-field text-sm ${titleTooLong ? 'border-red-400' : ''}`}
            />
          </div>

          <div>
            <div className="flex items-center gap-4 border-b border-gray-200 mb-2">
              {(['preview', 'html'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`pb-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {t === 'preview' ? 'Podgląd' : 'Edytuj HTML'}
                </button>
              ))}
            </div>
            {tab === 'preview' ? (
              <div
                data-testid="description-preview"
                className="prose prose-sm max-w-none rounded-lg border border-gray-200 bg-gray-50 p-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <>
                <textarea
                  id="description-html"
                  aria-label="Opis oferty (HTML)"
                  value={draft.html}
                  onChange={(e) => setDraft({ ...draft, html: e.target.value })}
                  rows={14}
                  spellCheck={false}
                  className="input-field text-xs font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">Allegro dopuszcza tylko: &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;b&gt;. Inne tagi zostaną usunięte przy zapisie.</p>
              </>
            )}
          </div>

          <div>
            <label htmlFor="description-keywords" className="block text-sm font-medium text-gray-700 mb-1">
              Frazy kluczowe <span className="text-gray-500 font-normal">(po przecinku – użyj ich w parametrach i tagach oferty)</span>
            </label>
            <textarea id="description-keywords" value={draft.keywords} onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} rows={2} className="input-field text-sm" />
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <label htmlFor="description-instruction" className="block text-sm font-medium text-gray-700 mb-1">
              Popraw promptem
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="description-instruction"
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && refine()}
                maxLength={600}
                disabled={editsLeft === 0 || busy !== null}
                placeholder="np. skróć o połowę, dodaj sekcję o gwarancji, mniej formalnie"
                className="input-field text-sm flex-1"
              />
              <button onClick={refine} disabled={editsLeft === 0 || busy !== null || instruction.trim().length < 3} className="btn-secondary text-sm whitespace-nowrap">
                {busy === 'refine' ? 'Poprawiam...' : `Popraw (zostało ${editsLeft})`}
              </button>
            </div>
            {editsLeft === 0 && (
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <p className="text-xs text-amber-600">Darmowe poprawki dla tego zdjęcia wykorzystane. Opis nadal możesz edytować ręcznie.</p>
                <button onClick={buyPack} disabled={busy !== null} className="btn-primary text-xs px-3 py-1.5">
                  {busy === 'buy' ? 'Kupuję...' : `Dokup ${packSize} poprawek (${packCredits} kredyt)`}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => save()} disabled={!dirty || busy !== null || titleTooLong} className="btn-primary text-sm">
              {busy === 'save' ? 'Zapisuję...' : 'Zapisz zmiany'}
            </button>
            {undo && (
              <button onClick={restore} className="btn-secondary text-sm flex items-center gap-1">
                <ArrowUturnLeftIcon className="h-4 w-4" /> Cofnij ostatnią poprawkę
              </button>
            )}
            <span className="flex-1" />
            <button onClick={() => copy('title')} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              <ClipboardDocumentIcon className="h-4 w-4" /> Kopiuj tytuł
            </button>
            <button onClick={() => copy('html')} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              <ClipboardDocumentIcon className="h-4 w-4" /> Kopiuj opis (HTML)
            </button>
            <button onClick={() => copy('text')} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              <ClipboardDocumentIcon className="h-4 w-4" /> Kopiuj tekst
            </button>
            {!showNotes && editsLeft > 0 && (
              <button onClick={() => setShowNotes(true)} className="text-sm text-gray-500 hover:text-gray-700">
                Napisz od nowa (1 poprawka)
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">Opis jest tworzony przez AI na podstawie Twoich notatek i zdjęcia – przed publikacją sprawdź parametry i zgodność z regulaminem Allegro.</p>
        </div>
      )}
    </section>
  )
}
