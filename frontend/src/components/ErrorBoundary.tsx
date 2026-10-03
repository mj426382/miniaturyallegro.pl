import { Component, ErrorInfo, ReactNode } from 'react'
import { reportError } from '../services/errorReporting'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last line of defence: an unexpected render error shows a recoverable screen instead of a
 * blank page. The error is logged to the console (and picked up by the browser's reporting).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] Unhandled render error', error, info.componentStack)
    reportError(error, { componentStack: info.componentStack })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm max-w-md w-full p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Coś poszło nie tak</h1>
          <p className="text-sm text-gray-600 mb-6">
            Ta część aplikacji napotkała nieoczekiwany błąd. Twoje zdjęcia i grafiki są bezpieczne – odśwież stronę, a jeśli problem wraca, napisz na{' '}
            <a href="mailto:kontakt@allgrafika.pl" className="text-blue-600 underline">
              kontakt@allgrafika.pl
            </a>
            .
          </p>
          <div className="flex gap-3 justify-center">
            <button type="button" onClick={() => window.location.reload()} className="btn-primary">
              Odśwież stronę
            </button>
            <a href="/" className="btn-secondary">
              Wróć na dashboard
            </a>
          </div>
        </div>
      </div>
    )
  }
}
