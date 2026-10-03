import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../services/api'
import { usePageTitle } from '../hooks/usePageTitle'
import AuthLayout from '../components/AuthLayout'
import FormAlert from '../components/FormAlert'

export default function ForgotPassword() {
  usePageTitle('Reset hasła')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      await authApi.forgotPassword(email.trim().toLowerCase())
      setSubmitted(true)
    } catch {
      setError('Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout title="Reset hasła" subtitle="Wyślemy Ci link do ustawienia nowego hasła">
      {submitted ? (
        <div className="text-center">
          <FormAlert kind="success" className="text-left">
            Jeśli podany email istnieje w naszym systemie, wysłaliśmy link do resetowania hasła. Sprawdź też folder spam.
          </FormAlert>
          <Link to="/login" className="mt-4 inline-block text-blue-600 hover:text-blue-700 font-medium">
            Wróć do logowania
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && <FormAlert>{error}</FormAlert>}
          <div>
            <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input id="forgot-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="twoj@email.pl" required />
          </div>
          <button type="submit" disabled={isLoading || !email} className="btn-primary w-full py-3">
            {isLoading ? 'Wysyłanie...' : 'Wyślij link resetujący'}
          </button>
          <Link to="/login" className="block text-center text-sm text-gray-600 hover:text-gray-800">
            Wróć do logowania
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}
