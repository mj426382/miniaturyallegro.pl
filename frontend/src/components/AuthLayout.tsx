import { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  children: ReactNode
  /** Links under the card (e.g. "Nie masz konta?"). */
  footer?: ReactNode
}

/** One frame for every unauthenticated screen: logo, heading, white card on the brand gradient. */
export default function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <main className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <a href="https://allgrafika.pl" className="inline-block" aria-label="AllGrafika.pl – strona główna">
            <img src="/logo.webp" alt="AllGrafika.pl" className="h-12 w-auto mx-auto mb-3" />
          </a>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="text-center text-sm text-gray-600 mt-6">{footer}</div>}
      </main>
    </div>
  )
}
