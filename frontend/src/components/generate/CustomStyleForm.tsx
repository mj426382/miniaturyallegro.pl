import { RefObject } from 'react'
import { CreditCardIcon, PhotoIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface Props {
  prompt: string
  onPromptChange: (value: string) => void
  referencePreview: string | null
  isRework: boolean
  inputRef: RefObject<HTMLInputElement>
  onFile: (file: File | null) => void
  onStart: () => void
  isGenerating: boolean
  freeLeft: number
  paidCredits: number
  /** Spec 16: admin accounts are not limited by credits. */
  unlimited?: boolean
}

/** Custom style tab: a Polish prompt plus an optional reference photo (or a graphic to rework). */
export default function CustomStyleForm({ prompt, onPromptChange, referencePreview, isRework, inputRef, onFile, onStart, isGenerating, freeLeft, paidCredits, unlimited = false }: Props) {
  return (
    <div className="p-5">
      <p className="text-sm text-gray-500 mb-4">
        Opisz, jak ma wyglądać grafika (po polsku). Możesz dołączyć zdjęcie referencyjne stylu.
        {isRework && <span className="block mt-1 text-purple-700 font-medium">Tryb przeróbki: opisz tylko to, co chcesz zmienić.</span>}
      </p>

      <div className="mb-4">
        <label htmlFor="custom-prompt" className="block text-sm font-medium text-gray-700 mb-1.5">
          Opis stylu <span className="text-red-400">*</span>
        </label>
        <input
          id="custom-prompt"
          type="text"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onStart()}
          placeholder="np. na drewnianym stole, w plenerze, ciepłe kolory, rozmyte tło"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={500}
        />
      </div>

      <div className="mb-5">
        <p className="block text-sm font-medium text-gray-700 mb-1.5">
          {isRework ? 'Grafika do przeróbki' : 'Zdjęcie referencyjne stylu'} {!isRework && <span className="text-gray-500 font-normal">(opcjonalnie)</span>}
        </p>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Wybierz zdjęcie referencyjne" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        {referencePreview ? (
          <div className="flex items-center gap-3">
            <img src={referencePreview} alt="Referencja" className="h-16 w-16 object-cover rounded-lg border border-gray-300" />
            <div>
              <p className="text-sm text-gray-700">{isRework ? 'Grafika załadowana' : 'Zdjęcie referencyjne dodane'}</p>
              <button
                type="button"
                onClick={() => {
                  onFile(null)
                  if (inputRef.current) inputRef.current.value = ''
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
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 border border-dashed border-gray-300 rounded-lg px-4 py-2.5 hover:border-blue-400 transition-colors"
          >
            <PhotoIcon className="h-4 w-4" />
            Dodaj zdjęcie referencyjne
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={onStart} disabled={isGenerating || prompt.trim().length < 3} className="btn-primary flex items-center gap-2">
          <SparklesIcon className="h-5 w-5" />
          {isGenerating ? 'Uruchamianie...' : 'Generuj grafikę'}
        </button>
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <CreditCardIcon className="h-3.5 w-3.5" />
          {unlimited ? 'Bez limitu kredytów' : `1 kredyt ${freeLeft > 0 ? '(z darmowej puli)' : `(masz ${paidCredits})`}`}
        </span>
      </div>
    </div>
  )
}
