import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { XMarkIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import { adminApi } from '../services/api'
import { formatDateTime, formatZl } from '../utils/format'
import FormAlert from './FormAlert'

interface Props {
  userId: string
  onClose: () => void
}

const KIND_LABEL: Record<string, string> = {
  admin: 'wiadomość od administratora',
  'free-credits-reminder': 'przypomnienie o darmowych kredytach',
  seasonal: 'styl sezonowy',
  'batch-done': 'koniec paczki',
}

const SUBJECT_MIN = 3
const SUBJECT_MAX = 150
const MESSAGE_MIN = 10
const MESSAGE_MAX = 5000

/** Spec 16: one account with usage, payments, mail history and an individual message form. */
export default function AdminUserModal({ userId, onClose }: Props) {
  const queryClient = useQueryClient()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const detail = useQuery({ queryKey: ['admin', 'user', userId], queryFn: () => adminApi.user(userId).then((r) => r.data) })
  const u = detail.data
  const canSend = subject.trim().length >= SUBJECT_MIN && message.trim().length >= MESSAGE_MIN && !sending

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSend) return
    setSending(true)
    setError('')
    try {
      await adminApi.sendEmail(userId, subject.trim(), message)
      toast.success('Wiadomość wysłana')
      setSubject('')
      setMessage('')
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] })
    } catch (err: any) {
      const msg = err.response?.data?.message
      setError(Array.isArray(msg) ? msg.join('. ') : msg || 'Nie udało się wysłać wiadomości')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <button type="button" aria-label="Zamknij okno" tabIndex={-1} onClick={onClose} className="absolute inset-0 w-full h-full cursor-default" />
      <div role="dialog" aria-modal="true" aria-labelledby="admin-user-title" className="relative bg-white rounded-2xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 id="admin-user-title" className="text-lg font-semibold text-gray-900 break-all">
              {u?.email ?? 'Użytkownik'}
            </h2>
            {u && (
              <p className="text-sm text-gray-500">
                {u.name ? `${u.name} · ` : ''}rejestracja {formatDateTime(u.createdAt)} · {u.emailVerified ? 'adres potwierdzony' : 'adres niepotwierdzony'}
              </p>
            )}
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Zamknij" className="text-gray-500 hover:text-gray-700 shrink-0">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {detail.isLoading && <p className="text-sm text-gray-500">Ładowanie…</p>}
        {detail.isError && <FormAlert>Nie udało się pobrać danych użytkownika.</FormAlert>}

        {u && (
          <>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-sm">
              {[
                ['Zdjęcia', u.images],
                ['Gotowe grafiki', `${u.completedGenerations}${u.failedGenerations ? ` (+${u.failedGenerations} nieudanych)` : ''}`],
                ['Plan', u.plan ? `${u.plan.name} (${u.plan.status})${u.subscription?.cancelAtPeriodEnd ? ', kończy się' : ''}` : 'brak'],
                ['Kredyty', `${u.credits} + ${u.freeCreditsLeft} darmowych`],
                ['Wpłaty', formatZl(u.paidTotalGrosze)],
                ['Ostatnia grafika', formatDateTime(u.lastActivityAt)],
                ['Zgoda marketingowa', u.marketingConsent ? 'tak' : 'nie'],
                ['Logowanie', u.provider === 'password' ? 'e-mail' : u.provider === 'google' ? 'Google' : 'e-mail + Google'],
              ].map(([label, value]) => (
                <div key={label as string} className="bg-gray-50 rounded-lg p-3">
                  <dt className="text-xs text-gray-500">{label}</dt>
                  <dd className="text-gray-900 font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <h3 className="text-sm font-semibold text-gray-800 mb-2">Płatności</h3>
            {u.payments.length === 0 ? (
              <p className="text-sm text-gray-500 mb-6">Brak płatności.</p>
            ) : (
              <ul className="text-sm divide-y divide-gray-100 border border-gray-200 rounded-lg mb-6">
                {u.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                    <span className="text-gray-600">{formatDateTime(p.createdAt)}</span>
                    <span className="text-gray-900">
                      {formatZl(p.amountPln)} · +{p.creditsAdded} kr. · {p.kind === 'subscription' ? 'abonament' : 'pakiet'}
                    </span>
                    <span className="text-gray-500">
                      {p.status}
                      {p.hasInvoice ? ' · faktura' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="text-sm font-semibold text-gray-800 mb-2">Wysłane maile</h3>
            {u.emails.length === 0 ? (
              <p className="text-sm text-gray-500 mb-6">Jeszcze nic nie wysłaliśmy.</p>
            ) : (
              <ul className="text-sm divide-y divide-gray-100 border border-gray-200 rounded-lg mb-6" aria-label="Historia maili">
                {u.emails.map((m) => (
                  <li key={m.id} className="px-3 py-2">
                    <p className="text-gray-900">{m.subject}</p>
                    <p className="text-xs text-gray-500">
                      {formatDateTime(m.createdAt)} · {KIND_LABEL[m.kind] ?? m.kind}
                      {m.sentBy ? ` · ${m.sentBy}` : ''}
                    </p>
                    {m.body && <p className="text-xs text-gray-600 whitespace-pre-line mt-1 line-clamp-3">{m.body}</p>}
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={send} className="border-t border-gray-200 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <EnvelopeIcon className="h-4 w-4" /> Wiadomość do użytkownika
              </h3>
              <p className="help-text">
                Indywidualna wiadomość od Ciebie (odpowiedź trafi na Twój adres). Nie wysyłaj tu promocji
                {u.marketingConsent ? '' : ' – ten użytkownik nie zgodził się na wiadomości marketingowe'}.
              </p>
              {error && <FormAlert>{error}</FormAlert>}
              <div>
                <label htmlFor="admin-subject" className="block text-sm font-medium text-gray-700 mb-1">
                  Temat
                </label>
                <input id="admin-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={SUBJECT_MAX} className="input-field text-sm" />
              </div>
              <div>
                <label htmlFor="admin-message" className="block text-sm font-medium text-gray-700 mb-1">
                  Treść
                </label>
                <textarea
                  id="admin-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={MESSAGE_MAX}
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Pusta linia rozdziela akapity. Powitanie i podpis dodamy sami."
                />
                <p className="help-text">
                  {message.trim().length}/{MESSAGE_MAX} znaków (min. {MESSAGE_MIN})
                </p>
              </div>
              <button type="submit" disabled={!canSend} className="btn-primary">
                {sending ? 'Wysyłam...' : 'Wyślij wiadomość'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
