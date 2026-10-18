import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { TicketIcon } from '@heroicons/react/24/outline'
import { adminApi, type AdminDiscountCode } from '../../services/api'
import { useConfirm } from '../../hooks/useConfirm'
import FormAlert from '../FormAlert'
import { formatDateTime } from '../../utils/format'
import {
  DISCOUNT_STATUS_LABEL,
  discountLabel,
  EMPTY_DISCOUNT_FORM,
  MAX_NOTE_LENGTH,
  usageLabel,
  validateDiscountCodeForm,
  type DiscountCodeErrors,
  type DiscountCodeForm,
} from '../../utils/discountCodes'

const STATUS_STYLE: Record<AdminDiscountCode['status'], string> = {
  active: 'bg-green-50 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  expired: 'bg-amber-50 text-amber-800',
  exhausted: 'bg-amber-50 text-amber-800',
}

const apiMessage = (err: any, fallback: string) => {
  const message = err?.response?.data?.message
  return Array.isArray(message) ? message.join('. ') : message || fallback
}

/**
 * Spec 16, AC-ADM-017/018/020: partner discount codes. A code is a Stripe promotion code the buyer types on the
 * Stripe checkout page of a regular pack (not the welcome pack) – and, once, on the first subscription payment.
 */
export default function AdminDiscountCodes() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [form, setForm] = useState<DiscountCodeForm>(EMPTY_DISCOUNT_FORM)
  const [errors, setErrors] = useState<DiscountCodeErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deactivating, setDeactivating] = useState<string | null>(null)
  const codes = useQuery({ queryKey: ['admin', 'discount-codes'], queryFn: () => adminApi.discountCodes().then((r) => r.data.codes) })

  const set = <K extends keyof DiscountCodeForm>(key: K, value: DiscountCodeForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setServerError(null)
    const result = validateDiscountCodeForm(form)
    setErrors(result.errors)
    if (!result.input) return
    setSaving(true)
    try {
      const { data } = await adminApi.createDiscountCode(result.input)
      toast.success(`Utworzono kod ${data.code}`)
      setForm(EMPTY_DISCOUNT_FORM)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'discount-codes'] })
    } catch (err: any) {
      setServerError(apiMessage(err, 'Nie udało się utworzyć kodu'))
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (code: AdminDiscountCode) => {
    const ok = await confirm({
      title: `Wyłączyć kod ${code.code}?`,
      message: 'Kodu nie będzie można już użyć na stronie płatności. Wyłączonego kodu nie da się ponownie włączyć – w razie potrzeby utworzysz nowy.',
      confirmLabel: 'Wyłącz kod',
      danger: true,
    })
    if (!ok) return
    setDeactivating(code.id)
    try {
      await adminApi.deactivateDiscountCode(code.id)
      toast.success(`Kod ${code.code} wyłączony`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'discount-codes'] })
    } catch (err: any) {
      toast.error(apiMessage(err, 'Nie udało się wyłączyć kodu'))
    } finally {
      setDeactivating(null)
    }
  }

  const fieldError = (key: keyof DiscountCodeForm) =>
    errors[key] ? (
      <p id={`discount-${key}-error`} className="text-xs text-red-600 mt-1">
        {errors[key]}
      </p>
    ) : null
  const describedBy = (key: keyof DiscountCodeForm) => (errors[key] ? `discount-${key}-error` : undefined)

  return (
    <div>
      <section aria-labelledby="discount-form-title" className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h2 id="discount-form-title" className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <TicketIcon className="h-4 w-4" aria-hidden="true" /> Nowy kod rabatowy
        </h2>
        <p className="help-text mb-4">
          Kod działa na stronie płatności Stripe przy zwykłych pakietach (nie przy pakiecie powitalnym) i jednorazowo przy pierwszej płatności abonamentu. Kupujący zawsze dostaje pełną liczbę kredytów
          pakietu.
        </p>
        <form onSubmit={submit} noValidate className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label htmlFor="discount-code" className="block text-xs text-gray-600 mb-1">
              Kod
            </label>
            <input
              id="discount-code"
              type="text"
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              placeholder="np. KATALOG-10"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
              aria-invalid={Boolean(errors.code)}
              aria-describedby={describedBy('code')}
              className="input-field text-sm font-mono"
            />
            {fieldError('code')}
          </div>
          <div>
            <label htmlFor="discount-type" className="block text-xs text-gray-600 mb-1">
              Rodzaj rabatu
            </label>
            <select id="discount-type" value={form.type} onChange={(e) => set('type', e.target.value as DiscountCodeForm['type'])} className="input-field text-sm">
              <option value="percent">Procentowy (%)</option>
              <option value="amount">Kwotowy (zł)</option>
            </select>
            {fieldError('type')}
          </div>
          <div>
            <label htmlFor="discount-value" className="block text-xs text-gray-600 mb-1">
              {form.type === 'percent' ? 'Rabat (%)' : 'Rabat (zł)'}
            </label>
            <input
              id="discount-value"
              type="text"
              inputMode={form.type === 'percent' ? 'numeric' : 'decimal'}
              value={form.value}
              onChange={(e) => set('value', e.target.value)}
              placeholder={form.type === 'percent' ? 'np. 10' : 'np. 5,00'}
              aria-invalid={Boolean(errors.value)}
              aria-describedby={describedBy('value')}
              className="input-field text-sm"
            />
            {fieldError('value')}
          </div>
          <div>
            <label htmlFor="discount-limit" className="block text-xs text-gray-600 mb-1">
              Limit użyć (opcjonalnie)
            </label>
            <input
              id="discount-limit"
              type="text"
              inputMode="numeric"
              value={form.maxRedemptions}
              onChange={(e) => set('maxRedemptions', e.target.value)}
              placeholder="bez limitu"
              aria-invalid={Boolean(errors.maxRedemptions)}
              aria-describedby={describedBy('maxRedemptions')}
              className="input-field text-sm"
            />
            {fieldError('maxRedemptions')}
          </div>
          <div>
            <label htmlFor="discount-expires" className="block text-xs text-gray-600 mb-1">
              Ważny do (opcjonalnie)
            </label>
            <input
              id="discount-expires"
              type="date"
              value={form.expiresOn}
              onChange={(e) => set('expiresOn', e.target.value)}
              aria-invalid={Boolean(errors.expiresOn)}
              aria-describedby={describedBy('expiresOn')}
              className="input-field text-sm"
            />
            {fieldError('expiresOn')}
          </div>
          <div>
            <label htmlFor="discount-note" className="block text-xs text-gray-600 mb-1">
              Notatka (opcjonalnie, np. partner)
            </label>
            <input
              id="discount-note"
              type="text"
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              maxLength={MAX_NOTE_LENGTH + 50}
              aria-invalid={Boolean(errors.note)}
              aria-describedby={describedBy('note')}
              className="input-field text-sm"
            />
            {fieldError('note')}
          </div>
          {serverError && <FormAlert className="sm:col-span-2 lg:col-span-3">{serverError}</FormAlert>}
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? 'Tworzę kod…' : 'Utwórz kod'}
            </button>
          </div>
        </form>
      </section>

      <h2 className="text-sm font-semibold text-gray-800 mb-2">Kody rabatowe</h2>
      {codes.isLoading ? (
        <p className="text-sm text-gray-500">Ładowanie kodów…</p>
      ) : codes.isError ? (
        <div role="alert" className="text-sm text-red-600">
          Nie udało się pobrać kodów.{' '}
          <button type="button" onClick={() => codes.refetch()} className="underline">
            Spróbuj ponownie
          </button>
        </div>
      ) : !codes.data?.length ? (
        <p className="text-sm text-gray-500">Nie ma jeszcze żadnych kodów.</p>
      ) : (
        <ul aria-label="Kody rabatowe" className="space-y-3">
          {codes.data.map((c) => (
            <li key={c.id} data-testid="discount-code-row" className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold text-gray-900 break-all">{c.code}</span>
                  <span className="text-sm font-semibold text-blue-700">{discountLabel(c)}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[c.status]}`}>{DISCOUNT_STATUS_LABEL[c.status]}</span>
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Użycia: {usageLabel(c)} · Zamówienia: {c.orders} · Ważny do: {c.expiresAt ? formatDateTime(c.expiresAt) : 'bez terminu'}
                </p>
                {c.note && <p className="text-xs text-gray-500 mt-0.5 break-words">{c.note}</p>}
                <p className="text-xs text-gray-500 mt-0.5">
                  Utworzony {formatDateTime(c.createdAt)} · {c.createdBy}
                </p>
              </div>
              {c.status !== 'inactive' && (
                <button type="button" onClick={() => deactivate(c)} disabled={deactivating === c.id} className="btn-secondary text-sm whitespace-nowrap" aria-label={`Wyłącz kod ${c.code}`}>
                  {deactivating === c.id ? 'Wyłączam…' : 'Wyłącz'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
