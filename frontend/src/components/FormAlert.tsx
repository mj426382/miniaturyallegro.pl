import { ExclamationCircleIcon, InformationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

interface Props {
  kind?: 'error' | 'info' | 'success'
  children: React.ReactNode
  className?: string
}

const STYLES = {
  error: { box: 'alert-error', Icon: ExclamationCircleIcon },
  info: { box: 'alert-info', Icon: InformationCircleIcon },
  success: { box: 'alert-success', Icon: CheckCircleIcon },
}

/** Inline message next to a form – the one way errors are shown on every screen (not toasts). */
export default function FormAlert({ kind = 'error', children, className = '' }: Props) {
  const { box, Icon } = STYLES[kind]
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`${box} ${className}`}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}
