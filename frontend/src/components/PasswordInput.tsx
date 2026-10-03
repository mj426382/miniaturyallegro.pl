import { InputHTMLAttributes, useState } from 'react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  id: string
  label: string
  /** Text under the field: validation state or a hint. Reserved height so the layout never jumps. */
  help?: React.ReactNode
  error?: boolean
}

/** Password field with a show/hide toggle – the same control on login, registration, reset and account pages. */
export default function PasswordInput({ id, label, help, error, className = '', ...rest }: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input id={id} type={visible ? 'text' : 'password'} className={`input-field pr-10 ${error ? 'border-red-400 focus:ring-red-400' : ''} ${className}`} {...rest} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ukryj hasło' : 'Pokaż hasło'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          tabIndex={-1}
        >
          {visible ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>
      <p className="mt-1 text-xs min-h-[18px]" aria-live="polite">
        {help}
      </p>
    </div>
  )
}
