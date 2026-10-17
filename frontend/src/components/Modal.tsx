import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useModalDialog } from '../hooks/useModalDialog'

interface Props {
  onClose: () => void
  /** id of the heading that names the dialog. */
  labelledBy: string
  describedBy?: string
  role?: 'dialog' | 'alertdialog'
  /** false while closing is not allowed: Escape and the backdrop do nothing. */
  dismissible?: boolean
  initialFocus?: RefObject<HTMLElement | null>
  /** Confirmations and the offer sit above other dialogs. */
  layer?: 'base' | 'top'
  /** Bottom sheet on phones (the offer) instead of a centred card. */
  sheet?: boolean
  /** Classes of the dialog panel (size, padding, layout). */
  className?: string
  children: ReactNode
}

/**
 * Spec 11: every modal of the app. Portalled to <body> so the rest of the page can be made inert as a whole;
 * focus trap, Escape and focus return come from useModalDialog.
 */
export default function Modal({ onClose, labelledBy, describedBy, role = 'dialog', dismissible = true, initialFocus, layer = 'base', sheet = false, className = '', children }: Props) {
  const dialogRef = useModalDialog<HTMLDivElement>({ onClose, dismissible, initialFocus })
  const position = sheet ? 'items-end sm:items-center p-0 sm:p-4' : 'items-center p-4'
  return createPortal(
    <div data-dialog-root="" className={`fixed inset-0 ${layer === 'top' ? 'z-[60]' : 'z-50'} bg-black/50 flex justify-center ${position}`}>
      <button type="button" aria-label="Zamknij okno" tabIndex={-1} onClick={() => dismissible && onClose()} className="absolute inset-0 w-full h-full cursor-default" />
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`relative bg-white shadow-xl focus:outline-none ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
