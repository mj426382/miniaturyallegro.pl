import { FormEvent, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { PencilSquareIcon, PhotoIcon, PlusIcon, SwatchIcon, TrashIcon } from '@heroicons/react/24/outline'
import { USER_STYLE_LIMITS, userStylesApi, type UserStyle } from '../services/api'
import { useUserStyles } from '../hooks/useUserStyles'
import { usePageTitle } from '../hooks/usePageTitle'
import { useConfirm } from '../hooks/useConfirm'

type Draft = { id: string | null; name: string; prompt: string; file: File | null; preview: string | null; removeReference: boolean }

const emptyDraft: Draft = { id: null, name: '', prompt: '', file: null, preview: null, removeReference: false }

const apiMessage = (err: any, fallback: string) => {
  const message = err?.response?.data?.message
  return Array.isArray(message) ? message.join('. ') : message || fallback
}

/** Spec 27 (AC-UST-008): „Moje style” – saved styles chosen later in the generator and in bulk upload. */
export default function Styles() {
  usePageTitle('Moje style')
  const confirm = useConfirm()
  const { styles, isLoading, error, reload } = useUserStyles()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const atLimit = styles.length >= USER_STYLE_LIMITS.maxStyles

  useEffect(() => {
    if (!draft?.file) return
    const url = URL.createObjectURL(draft.file)
    setDraft((d) => (d ? { ...d, preview: url } : d))
    return () => URL.revokeObjectURL(url)
  }, [draft?.file])

  const startNew = () => {
    setFormError(null)
    setDraft({ ...emptyDraft })
  }
  const startEdit = (style: UserStyle) => {
    setFormError(null)
    setDraft({ id: style.id, name: style.name, prompt: style.prompt, file: null, preview: style.referenceUrl, removeReference: false })
  }

  const nameOk = (draft?.name.trim().length ?? 0) >= USER_STYLE_LIMITS.nameMin
  const promptOk = (draft?.prompt.trim().length ?? 0) >= USER_STYLE_LIMITS.promptMin

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft || saving) return
    if (!nameOk || !promptOk) {
      setFormError(!nameOk ? 'Nazwa stylu musi mieć co najmniej 2 znaki.' : 'Opis sceny musi mieć co najmniej 3 znaki.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const fields = { name: draft.name.trim(), prompt: draft.prompt.trim(), reference: draft.file }
      if (draft.id) {
        await userStylesApi.update(draft.id, { ...fields, removeReference: draft.removeReference && !draft.file })
        toast.success('Styl zapisany')
      } else {
        await userStylesApi.create(fields)
        toast.success('Styl dodany – wybierzesz go w generatorze i przy masowym przesyłaniu')
      }
      setDraft(null)
      await reload()
    } catch (err: any) {
      setFormError(apiMessage(err, 'Nie udało się zapisać stylu'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (style: UserStyle) => {
    const ok = await confirm({
      title: `Usunąć styl „${style.name}”?`,
      message: 'Gotowe grafiki zostaną.',
      confirmLabel: 'Usuń styl',
      danger: true,
    })
    if (!ok) return
    try {
      await userStylesApi.remove(style.id)
      toast.success('Styl usunięty')
      if (draft?.id === style.id) setDraft(null)
      await reload()
    } catch (err: any) {
      toast.error(apiMessage(err, 'Nie udało się usunąć stylu'))
    }
  }

  return (
    <div className="px-4 py-6 sm:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Moje style</h1>
          <p className="text-gray-500 mt-1">Zapisz opis sceny raz – potem wybierzesz go przy każdym zdjęciu. Grafika z zapisanego stylu kosztuje 1 kredyt.</p>
        </div>
        {!draft && styles.length > 0 && (
          <button type="button" onClick={startNew} disabled={atLimit} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <PlusIcon className="h-5 w-5" />
            Dodaj styl
          </button>
        )}
      </div>

      {atLimit && !draft && (
        <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">Możesz mieć najwyżej {USER_STYLE_LIMITS.maxStyles} stylów – usuń któryś, aby dodać nowy.</p>
      )}

      {draft && (
        <form onSubmit={save} className="card p-5 mb-6 space-y-4" aria-label={draft.id ? 'Edycja stylu' : 'Nowy styl'} noValidate>
          <h2 className="text-lg font-semibold text-gray-900">{draft.id ? 'Edytuj styl' : 'Nowy styl'}</h2>
          <div>
            <label htmlFor="style-name" className="block text-sm font-medium text-gray-700 mb-1.5">
              Nazwa stylu
            </label>
            <input
              id="style-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              maxLength={USER_STYLE_LIMITS.nameMax}
              placeholder="np. Kuchnia z kotem"
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="style-prompt" className="block text-sm font-medium text-gray-700 mb-1.5">
              Opis sceny
            </label>
            <textarea
              id="style-prompt"
              value={draft.prompt}
              onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
              maxLength={USER_STYLE_LIMITS.promptMax}
              rows={3}
              placeholder="np. produkt na drewnianym stole w jasnej kuchni, obok siedzi kot"
              className="input-field resize-none"
              aria-describedby="style-prompt-help"
            />
            <div className="flex justify-between gap-2 mt-1">
              <p id="style-prompt-help" className="help-text">
                Opisz tło, otoczenie i klimat. Produkt i jego napisy zostaną bez zmian.
              </p>
              <span className="text-xs text-gray-500 whitespace-nowrap" data-testid="style-prompt-count">
                {draft.prompt.length}/{USER_STYLE_LIMITS.promptMax}
              </span>
            </div>
          </div>
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1.5">
              Zdjęcie wzoru <span className="text-gray-500 font-normal">(opcjonalnie)</span>
            </p>
            <div className="flex items-center gap-3">
              {draft.preview && !draft.removeReference ? (
                <img src={draft.preview} alt="Podgląd zdjęcia wzoru" className="h-20 w-20 rounded-lg object-cover border border-gray-200" />
              ) : (
                <div className="h-20 w-20 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                  <PhotoIcon className="h-8 w-8" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <button type="button" className="btn-secondary text-sm" onClick={() => fileRef.current?.click()}>
                  {draft.preview && !draft.removeReference ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}
                </button>
                {draft.preview && !draft.removeReference && (
                  <button type="button" className="text-sm text-red-600 hover:underline text-left" onClick={() => setDraft({ ...draft, file: null, preview: null, removeReference: true })}>
                    Usuń zdjęcie
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                data-testid="style-reference-input"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  e.target.value = ''
                  if (file) setDraft({ ...draft, file, removeReference: false })
                }}
              />
            </div>
            <p className="help-text mt-1">Zdjęcie z klimatem, tłem lub kompozycją, którą chcesz powtórzyć. JPG, PNG lub WebP do 10 MB.</p>
          </div>
          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Zapisywanie...' : 'Zapisz styl'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setDraft(null)} disabled={saving}>
              Anuluj
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-gray-500">Ładowanie stylów...</p>
      ) : error ? (
        <p className="text-red-600">Nie udało się wczytać stylów. Odśwież stronę.</p>
      ) : styles.length === 0 && !draft ? (
        <div className="card p-8 text-center">
          <SwatchIcon className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-700 mb-4">Nie masz jeszcze zapisanych stylów. Opisz scenę raz – potem wybierzesz ją przy każdym zdjęciu.</p>
          <button type="button" onClick={startNew} className="btn-primary inline-flex items-center gap-2">
            <PlusIcon className="h-5 w-5" />
            Dodaj styl
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Zapisane style">
          {styles.map((style) => (
            <li key={style.id} className="card p-4 flex gap-4">
              {style.referenceUrl ? (
                <img src={style.referenceUrl} alt="" className="h-16 w-16 rounded-lg object-cover flex-shrink-0" loading="lazy" />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <SwatchIcon className="h-7 w-7 text-purple-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 truncate">{style.name}</p>
                <p className="text-sm text-gray-600 mt-0.5 line-clamp-3">{style.prompt}</p>
                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => startEdit(style)} className="text-sm text-blue-700 hover:underline flex items-center gap-1" aria-label={`Edytuj styl ${style.name}`}>
                    <PencilSquareIcon className="h-4 w-4" />
                    Edytuj
                  </button>
                  <button type="button" onClick={() => remove(style)} className="text-sm text-red-600 hover:underline flex items-center gap-1" aria-label={`Usuń styl ${style.name}`}>
                    <TrashIcon className="h-4 w-4" />
                    Usuń
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
