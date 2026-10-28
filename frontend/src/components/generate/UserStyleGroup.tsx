import { Link } from 'react-router-dom'
import type { UserStyle } from '../../services/api'

interface Props {
  styles: UserStyle[]
  selected: string[]
  onToggle: (id: string) => void
  locked?: boolean
}

/** Spec 27 (AC-UST-009/010): „Moje style” – the user's saved styles, the first group of the style list. */
export default function UserStyleGroup({ styles, selected, onToggle, locked = false }: Props) {
  return (
    <div data-testid="user-style-group">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Moje style</p>
        <Link to="/styles" className="text-xs text-blue-700 hover:underline">
          Zarządzaj stylami
        </Link>
      </div>
      {styles.length === 0 ? (
        <p className="text-sm text-gray-600 rounded-lg border border-dashed border-gray-300 p-3">
          <Link to="/styles" className="text-blue-700 underline">
            Zapisz własny styl
          </Link>
          , aby wybierać go jednym kliknięciem.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {styles.map((style) => {
            const checked = selected.includes(style.id)
            return (
              <label
                key={style.id}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${checked ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(style.id)}
                  disabled={locked}
                  aria-label={`Mój styl: ${style.name}`}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                {style.referenceUrl && <img src={style.referenceUrl} alt="" className="h-10 w-10 rounded object-cover flex-shrink-0" loading="lazy" />}
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-800 truncate">{style.name}</span>
                  <span className="block text-xs text-gray-600 mt-0.5 line-clamp-2">{style.prompt}</span>
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
