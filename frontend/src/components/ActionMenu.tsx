import { ReactNode, useEffect, useRef, useState } from 'react'
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline'

export interface ActionMenuItem {
  label: string
  onSelect: () => void
  icon?: ReactNode
  disabled?: boolean
  danger?: boolean
}

interface Props {
  label?: string
  items: ActionMenuItem[]
}

/** Overflow menu for secondary actions: keyboard-reachable, closes on Escape, outside click and selection. */
export default function ActionMenu({ label = 'Więcej akcji', items }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    firstItemRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
      >
        <EllipsisHorizontalIcon className="h-5 w-5" />
      </button>
      {open && (
        <div role="menu" aria-label={label} className="absolute right-0 z-20 mt-1 w-52 bg-white rounded-lg border border-gray-200 shadow-lg py-1">
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={i === 0 ? firstItemRef : undefined}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 disabled:opacity-50 ${item.danger ? 'text-red-600' : 'text-gray-700'}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
