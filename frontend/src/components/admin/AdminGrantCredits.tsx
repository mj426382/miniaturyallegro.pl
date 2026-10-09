import { useState } from 'react'
import toast from 'react-hot-toast'
import { GiftIcon } from '@heroicons/react/24/outline'
import { adminApi, type AdminCreditGrant } from '../../services/api'
import { formatDateTime } from '../../utils/format'
import { countLabel } from '../../utils/plural'

interface Props {
  userId: string
  grants: AdminCreditGrant[]
  onGranted: () => void
}

/** Spec 19, AC-MON-006: add credits to an account (gift, support). Every grant is recorded with the admin. */
export default function AdminGrantCredits({ userId, grants, onGranted }: Props) {
  const [amount, setAmount] = useState(5)
  const [reason, setReason] = useState('Prezent – 5 grafik gratis')
  const [saving, setSaving] = useState(false)
  const valid = Number.isInteger(amount) && amount >= 1 && amount <= 100 && reason.trim().length >= 3

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    try {
      const { data } = await adminApi.grantCredits(userId, amount, reason.trim())
      toast.success(`Dodano ${countLabel(amount, 'kredyt', 'kredyty', 'kredytów')} (saldo: ${data.credits})`)
      onGranted()
    } catch (err: any) {
      const message = err.response?.data?.message
      toast.error(Array.isArray(message) ? message.join('. ') : message || 'Nie udało się dodać kredytów')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="grant-credits-title" className="mb-6">
      <h3 id="grant-credits-title" className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
        <GiftIcon className="h-4 w-4" aria-hidden="true" /> Dodaj kredyty
      </h3>
      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="sm:w-24">
          <label htmlFor="grant-amount" className="block text-xs text-gray-600 mb-1">
            Liczba
          </label>
          <input id="grant-amount" type="number" min={1} max={100} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="input-field text-sm" />
        </div>
        <div className="flex-1">
          <label htmlFor="grant-reason" className="block text-xs text-gray-600 mb-1">
            Powód (zapisywany w historii)
          </label>
          <input id="grant-reason" type="text" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} className="input-field text-sm" />
        </div>
        <button type="submit" disabled={!valid || saving} className="btn-primary text-sm whitespace-nowrap">
          {saving ? 'Dodaję…' : 'Dodaj kredyty'}
        </button>
      </form>
      {grants.length > 0 && (
        <ul aria-label="Historia dodanych kredytów" className="mt-3 text-sm divide-y divide-gray-100 border border-gray-200 rounded-lg">
          {grants.map((g) => (
            <li key={g.id} className="px-3 py-2 flex flex-wrap justify-between gap-2">
              <span>
                +{g.amount} · {g.reason}
              </span>
              <span className="text-xs text-gray-500">
                {formatDateTime(g.createdAt)} · {g.grantedBy}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
