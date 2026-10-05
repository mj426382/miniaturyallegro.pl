import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi, usersApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { usePageTitle } from '../hooks/usePageTitle'
import { useConfirm } from '../hooks/useConfirm'
import toast from 'react-hot-toast'
import { UserCircleIcon, TrashIcon, KeyIcon } from '@heroicons/react/24/outline'
import { getPasswordErrors } from '../utils/password'
import PasswordInput from '../components/PasswordInput'

export default function Account() {
  usePageTitle('Ustawienia konta')
  const { user, refreshUser, logout } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [name, setName] = useState(user?.name || '')
  const [isSaving, setIsSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [savingSetting, setSavingSetting] = useState<string | null>(null)
  /** Spec 16: switches update at once (optimistic) and roll back if the save fails. */
  const [notify, setNotify] = useState({ marketingConsent: Boolean(user?.marketingConsent), notifyBatchDone: user?.notifyBatchDone !== false })

  const saveSetting = async (key: 'marketingConsent' | 'notifyBatchDone', value: boolean) => {
    const previous = notify[key]
    setNotify((n) => ({ ...n, [key]: value }))
    setSavingSetting(key)
    try {
      await usersApi.updateProfile({ [key]: value })
      refreshUser().catch(() => undefined)
      toast.success('Zapisano ustawienia powiadomień')
    } catch {
      setNotify((n) => ({ ...n, [key]: previous }))
      toast.error('Nie udało się zapisać ustawień')
    } finally {
      setSavingSetting(null)
    }
  }
  const [isDeleting, setIsDeleting] = useState(false)

  const problems = useMemo(() => getPasswordErrors(newPassword), [newPassword])
  const passwordFormValid = currentPassword.length > 0 && problems.length === 0 && newPassword === repeatPassword && newPassword !== currentPassword

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await usersApi.updateProfile({ name: name.trim() })
      await refreshUser()
      toast.success('Zapisano')
    } catch {
      toast.error('Nie udało się zapisać zmian')
    } finally {
      setIsSaving(false)
    }
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordFormValid) return
    setIsChangingPassword(true)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setRepeatPassword('')
      toast.success('Hasło zmienione. Inne zalogowane urządzenia zostały wylogowane.')
    } catch (err: any) {
      const message = err.response?.data?.message
      toast.error(Array.isArray(message) ? message.join('. ') : message || 'Nie udało się zmienić hasła')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (confirmEmail.trim().toLowerCase() !== user?.email) {
      toast.error('Wpisz dokładnie adres e-mail swojego konta')
      return
    }
    const ok = await confirm({
      title: 'Usunąć konto na stałe?',
      message: 'Usuniemy konto, wszystkie zdjęcia, wygenerowane grafiki, opisy i niewykorzystane kredyty. Tej operacji nie można cofnąć.',
      confirmLabel: 'Usuń konto',
      danger: true,
    })
    if (!ok) return
    setIsDeleting(true)
    try {
      await usersApi.deleteAccount(confirmEmail.trim().toLowerCase())
      toast.success('Konto zostało usunięte')
      logout()
      navigate('/login')
    } catch (err: any) {
      const message = err.response?.data?.message
      toast.error(Array.isArray(message) ? message.join('. ') : message || 'Nie udało się usunąć konta')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ustawienia konta</h1>

      <form onSubmit={saveName} className="card mb-6">
        <div className="flex items-center gap-3 mb-4">
          <UserCircleIcon className="h-6 w-6 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Profil</h2>
        </div>
        <div className="mb-4">
          <label htmlFor="account-email" className="block text-sm font-medium text-gray-700 mb-1">
            E-mail
          </label>
          <input id="account-email" type="email" value={user?.email || ''} disabled className="input-field bg-gray-50 text-gray-500" />
        </div>
        <div className="mb-4">
          <label htmlFor="account-name" className="block text-sm font-medium text-gray-700 mb-1">
            Imię i nazwisko
          </label>
          <input id="account-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" maxLength={100} />
        </div>
        <button type="submit" disabled={isSaving} className="btn-primary">
          {isSaving ? 'Zapisywanie...' : 'Zapisz'}
        </button>
      </form>

      <form onSubmit={changePassword} className="card mb-6">
        <div className="flex items-center gap-3 mb-2">
          <KeyIcon className="h-6 w-6 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Hasło</h2>
        </div>
        {user?.hasPassword === false ? (
          <p className="text-sm text-gray-600">
            To konto loguje się przez Google i nie ma hasła. Jeśli chcesz logować się także hasłem, użyj{' '}
            <Link to="/forgot-password" className="text-blue-600 underline">
              „Zapomniałeś hasła?”
            </Link>{' '}
            na stronie logowania.
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">Po zmianie hasła inne zalogowane urządzenia zostaną wylogowane.</p>
            <div className="space-y-3 mb-4">
              <PasswordInput id="current-password" label="Obecne hasło" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              <PasswordInput
                id="new-password"
                label="Nowe hasło"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                maxLength={64}
                help={
                  newPassword && problems.length > 0 ? (
                    <span className="text-red-600">Brakuje: {problems.join(', ')}</span>
                  ) : newPassword ? (
                    <span className="text-green-700">Hasło spełnia wymagania</span>
                  ) : (
                    <span className="text-gray-500">Min. 8 znaków, wielka i mała litera, cyfra, znak specjalny</span>
                  )
                }
              />
              <PasswordInput
                id="repeat-password"
                label="Powtórz nowe hasło"
                autoComplete="new-password"
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                error={Boolean(repeatPassword && repeatPassword !== newPassword)}
                help={repeatPassword && repeatPassword !== newPassword ? <span className="text-red-600">Hasła nie są identyczne</span> : null}
              />
            </div>
            <button type="submit" disabled={!passwordFormValid || isChangingPassword} className="btn-primary">
              {isChangingPassword ? 'Zmieniam...' : 'Zmień hasło'}
            </button>
          </>
        )}
      </form>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Powiadomienia e-mail</h2>
        <p className="text-sm text-gray-600 mb-4">Wysyłamy je z adresu no-reply@allgrafika.pl.</p>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notify.marketingConsent}
              disabled={savingSetting !== null}
              onChange={(e) => saveSetting('marketingConsent', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              <strong className="font-medium">Wskazówki i przypomnienia</strong>
              <span className="block text-gray-500">Np. o niewykorzystanych darmowych kredytach i stylach sezonowych przed świętami. Najwyżej kilka wiadomości w roku.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notify.notifyBatchDone}
              disabled={savingSetting !== null}
              onChange={(e) => saveSetting('notifyBatchDone', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              <strong className="font-medium">Koniec dużej paczki</strong>
              <span className="block text-gray-500">Mail, gdy wszystkie grafiki z masowego przesyłania (od 3 zdjęć) są gotowe.</span>
            </span>
          </label>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Twoje dane</h2>
        <p className="text-sm text-gray-600">
          Zgodnie z RODO masz prawo dostępu do danych, ich sprostowania, przeniesienia i usunięcia. Szczegóły w{' '}
          <Link to="/polityka-prywatnosci" className="text-blue-600 underline">
            polityce prywatności
          </Link>
          . W sprawach dotyczących danych napisz na{' '}
          <a href="mailto:kontakt@allgrafika.pl" className="text-blue-600 underline">
            kontakt@allgrafika.pl
          </a>
          .
        </p>
      </div>

      <form onSubmit={deleteAccount} className="card border-red-200">
        <div className="flex items-center gap-3 mb-2">
          <TrashIcon className="h-6 w-6 text-red-600" />
          <h2 className="text-lg font-semibold text-gray-900">Usuń konto</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">Trwale usuwa konto, przesłane zdjęcia, wygenerowane grafiki, opisy ofert oraz niewykorzystane kredyty. Aby potwierdzić, wpisz adres e-mail konta.</p>
        <label htmlFor="confirm-email" className="sr-only">
          Adres e-mail konta
        </label>
        <input id="confirm-email" type="email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder={user?.email} className="input-field mb-4" />
        <button type="submit" disabled={isDeleting || confirmEmail.trim().toLowerCase() !== user?.email} className="btn-danger">
          {isDeleting ? 'Usuwanie...' : 'Usuń konto na stałe'}
        </button>
      </form>
    </div>
  )
}
