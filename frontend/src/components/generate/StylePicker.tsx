import { Link } from 'react-router-dom'
import { CheckCircleIcon, CreditCardIcon, SparklesIcon } from '@heroicons/react/24/outline'
import type { GenerationStyleInfo } from '../../services/api'
import { groupStartsOpen, groupStyles } from '../../utils/styles'
import { countLabel } from '../../utils/plural'

interface Props {
  styles: GenerationStyleInfo[]
  selectedStyles: string[]
  generatedStyleIds: Set<string>
  onToggle: (id: string) => void
  hasResults: boolean
  completedCount: number
  totalCount: number
  /** Generation in progress – selection and start are locked. */
  locked: boolean
  basePrompt: string
  onBasePromptChange: (value: string) => void
  onStart: () => void
  isStarting: boolean
  freeLeft: number
  /** Spec 16: admin accounts are not limited by credits. */
  unlimited?: boolean
  paidCredits: number
}

function creditsWord(n: number) {
  if (n === 1) return 'kredyt'
  if (n >= 2 && n <= 4) return 'kredyty'
  return 'kredytów'
}

/** Automatic styles tab: pick styles, add a hint, see the cost, start the batch. */
export default function StylePicker({
  styles,
  selectedStyles,
  generatedStyleIds,
  onToggle,
  hasResults,
  completedCount,
  totalCount,
  locked,
  basePrompt,
  onBasePromptChange,
  onStart,
  isStarting,
  freeLeft,
  paidCredits,
  unlimited = false,
}: Props) {
  const selectedCount = selectedStyles.length
  const costHint =
    selectedCount === 0
      ? 'Wybierz co najmniej jeden styl'
      : unlimited
        ? 'Konto administratora – bez limitu kredytów'
        : freeLeft >= selectedCount
          ? `${selectedCount} ${creditsWord(selectedCount)} z darmowej puli (zostanie ${freeLeft - selectedCount})`
          : freeLeft > 0
            ? `${freeLeft} z darmowej puli + ${selectedCount - freeLeft} płatne`
            : `${selectedCount} ${creditsWord(selectedCount)} (masz ${paidCredits})`
  const canAfford = selectedCount > 0 && (unlimited || freeLeft + paidCredits >= selectedCount)

  return (
    <div className="p-5">
      <p className="text-sm text-gray-500 mb-4">
        {hasResults
          ? 'Dogeneruj kolejne style lub ponownie wygeneruj wybrany. Każda grafika to 1 kredyt.'
          : 'Zacznij od 3 najbardziej uniwersalnych stylów (zaznaczone). Pozostałe możesz dogenerować później – płacisz tylko za to, co wybierzesz.'}
      </p>

      <div className="space-y-3 mb-4">
        {groupStyles(styles).map((group) => {
          const grid = (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {group.styles.map((style) => {
                const checked = selectedStyles.includes(style.id)
                const done = generatedStyleIds.has(style.id)
                return (
                  <label
                    key={style.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(style.id)}
                      disabled={locked}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-800">
                        {style.name}
                        {style.starter && !hasResults && <span className="text-[10px] uppercase tracking-wide bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">start</span>}
                        {style.inSeason && <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Teraz</span>}
                        {done && <CheckCircleIcon className="h-4 w-4 text-green-500" title="Już wygenerowano" />}
                      </span>
                      <span className="block text-xs text-gray-600 mt-0.5">{style.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          )
          if (group.id === 'universal') {
            return (
              <div key={group.id}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{group.label}</p>
                {grid}
              </div>
            )
          }
          const selectedHere = group.styles.filter((s) => selectedStyles.includes(s.id)).length
          return (
            <details key={group.id} open={groupStartsOpen(group, selectedStyles)} className="group rounded-lg border border-gray-200">
              <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-medium text-gray-800 flex items-center gap-2">
                {group.label}
                <span className="text-xs font-normal text-gray-500">({group.styles.length})</span>
                {selectedHere > 0 && <span className="text-xs font-normal text-blue-700">wybrane: {selectedHere}</span>}
              </summary>
              <div className="px-3 pb-3">
                {group.hint && <p className="help-text mb-2">{group.hint}</p>}
                {grid}
              </div>
            </details>
          )
        })}
      </div>

      <div className="mb-4">
        <label htmlFor="base-prompt" className="block text-sm font-medium text-gray-700 mb-1.5">
          Dodatkowe wskazówki dla AI <span className="text-gray-500 font-normal">(opcjonalnie)</span>
        </label>
        <textarea
          id="base-prompt"
          value={basePrompt}
          onChange={(e) => onBasePromptChange(e.target.value)}
          placeholder="np. elegancki wygląd, produkt w centrum kadru, ciepłe kolory"
          rows={2}
          maxLength={400}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">Wskazówki zostaną zastosowane do wszystkich wybranych stylów.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onStart} disabled={isStarting || locked || selectedCount === 0} className="btn-primary flex items-center gap-2">
          <SparklesIcon className="h-5 w-5" />
          {isStarting ? 'Uruchamianie...' : locked ? 'Generowanie w toku...' : `Generuj ${countLabel(selectedCount, 'grafikę', 'grafiki', 'grafik')}`}
        </button>
        <span className={`text-xs flex items-center gap-1 ${canAfford ? 'text-gray-500' : 'text-red-500'}`}>
          <CreditCardIcon className="h-3.5 w-3.5" />
          {costHint}
          {!canAfford && selectedCount > 0 && (
            <Link to="/credits" className="underline ml-1">
              Doładuj
            </Link>
          )}
        </span>
      </div>

      {hasResults && (
        <div className="flex items-center gap-2 text-sm text-gray-600 mt-4">
          <CheckCircleIcon className="h-5 w-5 text-green-500" />
          {completedCount} z {totalCount} wygenerowanych
        </div>
      )}
    </div>
  )
}
