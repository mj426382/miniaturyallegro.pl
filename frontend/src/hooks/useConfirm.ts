import { createContext, ReactNode, useContext } from 'react'

export interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Red button for destructive actions. */
  danger?: boolean
}

export type Ask = (options: ConfirmOptions) => Promise<boolean>

export const ConfirmContext = createContext<Ask | null>(null)

/** Resolves to true when the user confirms the dialog rendered by ConfirmProvider. */
export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext)
  if (!ask) throw new Error('useConfirm must be used within ConfirmProvider')
  return ask
}
