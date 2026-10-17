import { ReactNode, useCallback, useRef, useState } from 'react'
import { Ask, ConfirmContext, ConfirmOptions } from '../hooks/useConfirm'
import Modal from './Modal'

/**
 * Accessible replacement for window.confirm: focus lands on the confirm button, Escape cancels.
 * It sits above every other dialog, so it also works from inside one (spec 11, AC-UI-011: confirm inside export).
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const ask = useCallback<Ask>((options) => new Promise((resolve) => setPending({ options, resolve })), [])

  const close = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {pending && (
        <Modal
          role="alertdialog"
          labelledBy="confirm-title"
          describedBy="confirm-message"
          onClose={() => close(false)}
          initialFocus={confirmRef}
          layer="top"
          className="rounded-2xl w-full max-w-md p-6"
        >
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
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}
