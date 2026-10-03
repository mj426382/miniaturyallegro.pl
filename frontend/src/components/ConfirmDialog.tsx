import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Ask, ConfirmContext, ConfirmOptions } from '../hooks/useConfirm'

/** Accessible replacement for window.confirm: focus lands on the confirm button, Escape cancels. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const ask = useCallback<Ask>((options) => new Promise((resolve) => setPending({ options, resolve })), [])

  const close = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  useEffect(() => {
    if (!pending) return
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <button type="button" aria-label="Zamknij okno" tabIndex={-1} onClick={() => close(false)} className="absolute inset-0 w-full h-full cursor-default" />
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 id="confirm-title" className="text-lg font-semibold text-gray-900 mb-2">
              {pending.options.title}
            </h2>
            <div id="confirm-message" className="text-sm text-gray-600 mb-6">
              {pending.options.message}
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => close(false)} className="btn-secondary">
                {pending.options.cancelLabel ?? 'Anuluj'}
              </button>
              <button ref={confirmRef} type="button" onClick={() => close(true)} className={pending.options.danger ? 'btn-danger' : 'btn-primary'}>
                {pending.options.confirmLabel ?? 'Potwierdź'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
