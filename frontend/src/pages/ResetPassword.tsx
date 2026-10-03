import { useState, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import { usePageTitle } from '../hooks/usePageTitle'
import AuthLayout from '../components/AuthLayout'
import PasswordInput from '../components/PasswordInput'
import FormAlert from '../components/FormAlert'
import { getPasswordErrors } from '../utils/password'

export default function ResetPassword() {
  usePageTitle('Nowe hasło')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const passwordErrors = useMemo(() => getPasswordErrors(password), [password])
  const canSubmit = Boolean(token && password && passwordErrors.length === 0 && password === confirmPassword && !isLoading)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setIsLoading(true)
    setError('')
    try {
      const { data } = await authApi.resetPassword(token, password)
      toast.success(data.message || 'Hasło zostało zmienione')
      navigate('/login')
    } catch (err: any) {
      const message = err.response?.data?.message
      setError(Array.isArray(message) ? message.join('. ') : message || 'Nie udało się zmienić hasła')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout title="Ustaw nowe hasło" subtitle="Wpisz nowe hasło do swojego konta">
      {!token ? (
        <div className="text-center text-sm text-gray-600">
          <FormAlert className="text-left">Link do resetowania hasła jest nieprawidłowy.</FormAlert>
          <Link to="/forgot-password" className="mt-4 inline-block text-blue-600 hover:text-blue-700 font-medium">
            Wyślij link ponownie
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && <FormAlert>{error}</FormAlert>}
          <PasswordInput
            id="reset-password"
            label="Nowe hasło"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 znaków"
            required
            maxLength={64}
            autoComplete="new-password"
            help={
              password && passwordErrors.length > 0 ? (
                <span className="text-red-600">Brakuje: {passwordErrors.join(', ')}</span>
              ) : (
                <span className="text-gray-500">Min. 8 znaków, wielka i mała litera, cyfra, znak specjalny</span>
              )
            }
          />
          <PasswordInput
            id="reset-confirm"
            label="Powtórz hasło"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Powtórz hasło"
            required
            autoComplete="new-password"
            error={Boolean(confirmPassword && password !== confirmPassword)}
            help={confirmPassword && password !== confirmPassword ? <span className="text-red-600">Hasła nie są identyczne</span> : null}
          />
          <button type="submit" disabled={!canSubmit} className="btn-primary w-full py-3">
            {isLoading ? 'Zapisywanie...' : 'Zmień hasło'}
          </button>
          <Link to="/login" className="block text-center text-sm text-gray-600 hover:text-gray-800">
            Wróć do logowania
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}
