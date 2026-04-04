import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../services/api'
import toast from 'react-hot-toast'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSubmitted(true)
    } catch (err: any) {
      toast.error('Wystąpił błąd. Spróbuj ponownie.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Reset hasła</h1>
          <p className="text-gray-500 mt-2">Wyślemy Ci link do zresetowania hasła</p>
        </div>

        {submitted ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-700">
              Jeśli podany email istnieje w naszym systemie, wysłaliśmy link do resetowania hasła.
            </p>
            <Link to="/login" className="mt-4 inline-block text-blue-600 hover:text-blue-700 font-medium">
              Wróć do logowania
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="twoj@email.pl"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3"
            >
              {isLoading ? 'Wysyłanie...' : 'Wyślij link resetujący'}
            </button>

            <Link
              to="/login"
              className="block text-center text-sm text-gray-500 hover:text-gray-700"
            >
              Wróć do logowania
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
