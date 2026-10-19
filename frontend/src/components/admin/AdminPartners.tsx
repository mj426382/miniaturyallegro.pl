import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeftIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { adminApi, type AdminPartner, type AdminPartnerDetail } from '../../services/api'
import FormAlert from '../FormAlert'
import { formatDateTime, formatZl } from '../../utils/format'
import { DISCOUNT_CODE_PATTERN } from '../../utils/discountCodes'
import {
  EMPTY_PARTNER_FORM,
  ENTRY_KIND_LABEL,
  formatSignedZl,
  MIN_PAYOUT_GROSZE,
  monthLabel,
  parseZlToGrosze,
  partnerToForm,
  payoutWarnings,
  todayInPoland,
  validatePartnerForm,
  validatePayoutForm,
  type PartnerErrors,
  type PartnerForm,
  type PayoutErrors,
  type PayoutForm,
} from '../../utils/partners'

const apiMessage = (err: any, fallback: string) => {
  const message = err?.response?.data?.message
  return Array.isArray(message) ? message.join('. ') : message || fallback
}

const ordersLabel = (n: number) => (n === 1 ? '1 zamówienie' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? `${n} zamówienia` : `${n} zamówień`)

const CODE_STATUS: Record<AdminPartner['codes'][number]['status'], string> = { active: 'aktywny', inactive: 'wyłączony', expired: 'wygasł' }

/**
 * Spec 24, AC-PRT-015: the partner (affiliate) programme. Partners' readers pay with the partner's discount code; the
 * partner earns commission on what those customers really pay. The statement never shows customer e-mails.
 */
export default function AdminPartners() {
  const [openId, setOpenId] = useState<string | null>(null)
  if (openId) return <PartnerDetail id={openId} onBack={() => setOpenId(null)} />
  return <PartnerList onOpen={setOpenId} />
}

function PartnerFields({ form, errors, set, mode }: { form: PartnerForm; errors: PartnerErrors; set: <K extends keyof PartnerForm>(key: K, value: PartnerForm[K]) => void; mode: 'create' | 'edit' }) {
  const prefix = `partner-${mode}`
  const field = (key: keyof PartnerForm, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`${prefix}-${key}`} className="block text-xs text-gray-600 mb-1">
        {label}
      </label>
      <input
        id={`${prefix}-${key}`}
        type="text"
        value={String(form[key])}
        onChange={(e) => set(key, e.target.value as never)}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `${prefix}-${key}-error` : undefined}
        className="input-field text-sm"
        {...props}
      />
      {errors[key] && (
        <p id={`${prefix}-${key}-error`} className="text-xs text-red-600 mt-1">
          {errors[key]}
        </p>
      )}
    </div>
  )
  return (
    <>
      {field('name', 'Nazwa partnera', { maxLength: 120 })}
      {field('contactEmail', 'E-mail kontaktowy', { type: 'email', inputMode: 'email', autoComplete: 'off', spellCheck: false })}
      {field('companyName', 'Firma (opcjonalnie)')}
      {field('nip', 'NIP (opcjonalnie)', { inputMode: 'numeric', placeholder: 'np. 526-000-12-46' })}
      {field('customerDiscountPercent', 'Rabat dla klientów (%)', { inputMode: 'numeric' })}
      {field('commissionPercent', 'Prowizja (%)', { inputMode: 'numeric' })}
      {field('commissionMonths', 'Okres prowizji (miesiące)', { inputMode: 'numeric' })}
      {field('note', 'Notatka (opcjonalnie)')}
      {mode === 'create' && (
        <>
          {field('code', 'Kod rabatowy (opcjonalnie)', {
            placeholder: 'np. KATALOG-10',
            autoCapitalize: 'characters',
            spellCheck: false,
            className: 'input-field text-sm font-mono',
            onChange: (e) => set('code', e.target.value.toUpperCase()),
          })}
          {field('codeMaxRedemptions', 'Limit użyć kodu (opcjonalnie)', { inputMode: 'numeric', placeholder: 'bez limitu' })}
          {field('codeExpiresOn', 'Kod ważny do (opcjonalnie)', { type: 'date' })}
        </>
      )}
      <label className="flex items-center gap-2 text-sm text-gray-700 self-end pb-2">
        <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} className="h-4 w-4" />
        Partner aktywny
      </label>
    </>
  )
}

function useForm<T extends object>(initial: T) {
  const [form, setForm] = useState<T>(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const set = <K extends keyof T>(key: K, value: T[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }
  return { form, setForm, errors, setErrors, set }
}

function PartnerList({ onOpen }: { onOpen: (id: string) => void }) {
  const queryClient = useQueryClient()
  const { form, setForm, errors, setErrors, set } = useForm<PartnerForm>(EMPTY_PARTNER_FORM)
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const partners = useQuery({ queryKey: ['admin', 'partners'], queryFn: () => adminApi.partners().then((r) => r.data) })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setServerError(null)
    const result = validatePartnerForm(form)
    setErrors(result.errors)
    if (!result.input) return
    setSaving(true)
    try {
      const { data } = await adminApi.createPartner(result.input)
      toast.success(`Dodano partnera ${data.name}`)
      setForm(EMPTY_PARTNER_FORM)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'partners'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'discount-codes'] })
    } catch (err: any) {
      setServerError(apiMessage(err, 'Nie udało się dodać partnera'))
    } finally {
      setSaving(false)
    }
  }

  const data = partners.data
  return (
    <div>
      <section aria-labelledby="partner-form-title" className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h2 id="partner-form-title" className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <UserGroupIcon className="h-4 w-4" aria-hidden="true" /> Nowy partner
        </h2>
        <p className="help-text mb-4">
          Czytelnicy partnera płacą jego kodem i dostają rabat, a partner dostaje prowizję od tego, co ci klienci naprawdę zapłacą (pakiety i abonamenty) przez okres prowizji od pierwszej płatności
          kodem. Kod podany tutaj powstaje w Stripe z rabatem partnera.
        </p>
        <form onSubmit={submit} noValidate className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <PartnerFields form={form} errors={errors} set={set} mode="create" />
          {serverError && <FormAlert className="sm:col-span-2 lg:col-span-3">{serverError}</FormAlert>}
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? 'Dodaję partnera…' : 'Dodaj partnera'}
            </button>
          </div>
        </form>
      </section>

      <h2 className="text-sm font-semibold text-gray-800 mb-2">Partnerzy {data && <span className="font-normal text-gray-500">· {monthLabel(data.month)}</span>}</h2>
      {partners.isLoading ? (
        <p className="text-sm text-gray-500">Ładowanie partnerów…</p>
      ) : partners.isError ? (
        <div role="alert" className="text-sm text-red-600">
          Nie udało się pobrać partnerów.{' '}
          <button type="button" onClick={() => partners.refetch()} className="underline">
            Spróbuj ponownie
          </button>
        </div>
      ) : !data?.partners.length ? (
        <p className="text-sm text-gray-500">Nie ma jeszcze żadnych partnerów.</p>
      ) : (
        <ul aria-label="Partnerzy" className="space-y-3">
          {data.partners.map((p) => (
            <li key={p.id} data-testid="partner-row" className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900 break-words">{p.name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{p.active ? 'aktywny' : 'nieaktywny'}</span>
                  <span className="text-xs text-gray-600">
                    −{p.customerDiscountPercent}% dla klientów · {p.commissionPercent}% prowizji · {p.commissionMonths} mies.
                  </span>
                </p>
                <p className="text-xs text-gray-600 break-words">
                  Kody: {p.codes.length ? p.codes.map((c) => c.code).join(', ') : 'brak'} · Klienci: {p.customers}
                </p>
                <p className="text-xs text-gray-700" data-testid="partner-current-month">
                  Ten miesiąc: {ordersLabel(p.currentMonth.orders)} · netto {formatSignedZl(p.currentMonth.netPaidGrosze)} · prowizja {formatSignedZl(p.currentMonth.commissionGrosze)}
                </p>
                <p className="text-xs text-gray-700" data-testid="partner-all-time">
                  Łącznie: {ordersLabel(p.allTime.orders)} · netto {formatSignedZl(p.allTime.netPaidGrosze)} · prowizja {formatSignedZl(p.allTime.commissionGrosze)}
                </p>
                <p className="text-xs text-gray-700" data-testid="partner-balance">
                  Wypłacono: {formatZl(p.paidOutGrosze)} · <span className="font-semibold">Do wypłaty: {formatSignedZl(p.balanceGrosze)}</span>
                  {p.balanceGrosze > 0 && p.balanceGrosze < data.minPayoutGrosze && <span className="text-gray-500"> (poniżej progu wypłaty {formatZl(data.minPayoutGrosze)})</span>}
                </p>
              </div>
              <button type="button" onClick={() => onOpen(p.id)} className="btn-secondary text-sm whitespace-nowrap" aria-label={`Szczegóły partnera ${p.name}`}>
                Szczegóły
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PartnerDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const queryClient = useQueryClient()
  const partner = useQuery({ queryKey: ['admin', 'partner', id], queryFn: () => adminApi.partner(id).then((r) => r.data) })
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'partner', id] })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'partners'] })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'discount-codes'] })
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1 mb-4">
        <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> Wszyscy partnerzy
      </button>
      {partner.isLoading ? (
        <p className="text-sm text-gray-500">Ładowanie partnera…</p>
      ) : partner.isError || !partner.data ? (
        <div role="alert" className="text-sm text-red-600">
          Nie udało się pobrać partnera.{' '}
          <button type="button" onClick={() => partner.refetch()} className="underline">
            Spróbuj ponownie
          </button>
        </div>
      ) : (
        <PartnerDetailBody partner={partner.data} refresh={refresh} />
      )}
    </div>
  )
}

function PartnerDetailBody({ partner, refresh }: { partner: AdminPartnerDetail; refresh: () => Promise<void> }) {
  const tiles = [
    { label: 'Ten miesiąc – prowizja', value: formatSignedZl(partner.currentMonth.commissionGrosze), hint: ordersLabel(partner.currentMonth.orders) },
    { label: 'Łącznie – prowizja', value: formatSignedZl(partner.allTime.commissionGrosze), hint: `netto ${formatSignedZl(partner.allTime.netPaidGrosze)}` },
    { label: 'Wypłacono', value: formatZl(partner.paidOutGrosze), hint: `${partner.payouts.length} wypłat` },
    { label: 'Do wypłaty', value: formatSignedZl(partner.balanceGrosze), hint: `próg ${formatZl(partner.minPayoutGrosze)}` },
  ]
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 break-words">{partner.name}</h2>
        <p className="text-xs text-gray-600 break-words">
          {partner.companyName ?? 'bez firmy'}
          {partner.nip ? ` · NIP ${partner.nip}` : ''} · {partner.contactEmail} · klienci: {partner.customers}
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="partner-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs text-gray-500">{t.label}</p>
            <p className="text-lg font-semibold text-gray-900">{t.value}</p>
            <p className="text-xs text-gray-500">{t.hint}</p>
          </div>
        ))}
      </div>
      <PayoutSection partner={partner} refresh={refresh} />
      <StatementSection partner={partner} />
      <CodesSection partner={partner} refresh={refresh} />
      <EditSection partner={partner} refresh={refresh} />
    </div>
  )
}

function PayoutSection({ partner, refresh }: { partner: AdminPartnerDetail; refresh: () => Promise<void> }) {
  const { form, setForm, errors, setErrors, set } = useForm<PayoutForm>({ amount: '', paidOn: todayInPoland(), reference: '' })
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string[] | null>(null)
  const previewGrosze = parseZlToGrosze(form.amount)
  const warnings = previewGrosze !== null ? payoutWarnings(previewGrosze, partner.balanceGrosze, partner.minPayoutGrosze) : []

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setServerError(null)
    setSaved(null)
    const result = validatePayoutForm(form)
    setErrors(result.errors)
    if (!result.input) return
    setSaving(true)
    try {
      const { data } = await adminApi.recordPartnerPayout(partner.id, result.input)
      toast.success(`Zapisano wypłatę ${formatZl(data.payout.amountGrosze)}`)
      setSaved(data.warnings)
      setForm({ amount: '', paidOn: todayInPoland(), reference: '' })
      await refresh()
    } catch (err: any) {
      setServerError(apiMessage(err, 'Nie udało się zapisać wypłaty'))
    } finally {
      setSaving(false)
    }
  }

  const input = (key: keyof PayoutForm, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`payout-${key}`} className="block text-xs text-gray-600 mb-1">
        {label}
      </label>
      <input
        id={`payout-${key}`}
        type="text"
        value={form[key]}
        onChange={(e) => {
          set(key, e.target.value)
          setSaved(null)
        }}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `payout-${key}-error` : undefined}
        className="input-field text-sm"
        {...props}
      />
      {errors[key] && (
        <p id={`payout-${key}-error`} className="text-xs text-red-600 mt-1">
          {(errors as PayoutErrors)[key]}
        </p>
      )}
    </div>
  )

  return (
    <section aria-labelledby="payout-title" className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 id="payout-title" className="text-sm font-semibold text-gray-800 mb-1">
        Oznacz wypłatę
      </h3>
      <p className="help-text mb-3">
        Partner rozlicza się co miesiąc fakturą. Próg wypłaty to {formatZl(MIN_PAYOUT_GROSZE)} – niższą kwotę też można zapisać, jeśli tak ustaliliście. Saldo do wypłaty:{' '}
        {formatSignedZl(partner.balanceGrosze)}.
      </p>
      <form onSubmit={submit} noValidate className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {input('amount', 'Kwota (zł)', { inputMode: 'decimal', placeholder: 'np. 57,42' })}
        {input('paidOn', 'Data wypłaty', { type: 'date', max: todayInPoland() })}
        {input('reference', 'Numer faktury lub notatka', { maxLength: 250, placeholder: 'np. FV 12/11/2026' })}
        {warnings.length > 0 && (
          <FormAlert kind="info" className="sm:col-span-3">
            {warnings.join(' ')}
          </FormAlert>
        )}
        {saved && saved.length > 0 && (
          <FormAlert kind="info" className="sm:col-span-3">
            Zapisano z ostrzeżeniem: {saved.join(' ')}
          </FormAlert>
        )}
        {serverError && <FormAlert className="sm:col-span-3">{serverError}</FormAlert>}
        <div className="sm:col-span-3">
          <button type="submit" disabled={saving} className="btn-primary text-sm">
            {saving ? 'Zapisuję…' : 'Oznacz wypłatę'}
          </button>
        </div>
      </form>
      <h4 className="text-xs font-semibold text-gray-700 mt-4 mb-2">Historia wypłat</h4>
      {partner.payouts.length === 0 ? (
        <p className="text-xs text-gray-500">Nie było jeszcze wypłat.</p>
      ) : (
        <ul aria-label="Wypłaty" className="divide-y divide-gray-100 text-sm">
          {partner.payouts.map((p) => (
            <li key={p.id} data-testid="payout-row" className="py-2 flex flex-wrap gap-x-3 gap-y-1">
              <span className="font-medium text-gray-900">{formatZl(p.amountGrosze)}</span>
              <span className="text-gray-600">{p.paidOn}</span>
              <span className="text-gray-600 break-words min-w-0">{p.reference}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function StatementSection({ partner }: { partner: AdminPartnerDetail }) {
  return (
    <section aria-labelledby="statement-title" className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 id="statement-title" className="text-sm font-semibold text-gray-800 mb-1">
        Zestawienie miesięczne
      </h3>
      <p className="help-text mb-3">
        Miesiące w czasie polskim. Klient to skrót konta (bez adresu e-mail) – zestawienie można przesłać partnerowi. Zwroty i spory są korektami w miesiącu, w którym się wydarzyły.
      </p>
      {partner.months.length === 0 ? (
        <p className="text-sm text-gray-500">Brak zamówień od klientów tego partnera.</p>
      ) : (
        <div className="space-y-4">
          {partner.months.map((m) => (
            <div key={m.month} data-testid="statement-month">
              <h4 className="text-sm font-semibold text-gray-900 capitalize">{monthLabel(m.month)}</h4>
              <p className="text-xs text-gray-700 mb-1">
                {ordersLabel(m.orders)} · netto {formatSignedZl(m.netPaidGrosze)} · prowizja {formatSignedZl(m.commissionGrosze)}
              </p>
              <ul aria-label={`Zestawienie ${monthLabel(m.month)}`} className="divide-y divide-gray-100">
                {m.entries.map((e) => (
                  <li key={e.id} data-testid="statement-entry" className="py-1.5 text-xs flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="text-gray-600">{formatDateTime(e.occurredAt)}</span>
                    <span className={e.kind === 'adjustment' ? 'text-amber-800 font-medium' : 'text-gray-900 font-medium'}>{ENTRY_KIND_LABEL[e.kind]}</span>
                    <span className="text-gray-700">{e.product}</span>
                    <span className="font-mono text-gray-700">{e.customer}</span>
                    <span className="text-gray-700">netto {formatSignedZl(e.netPaidGrosze)}</span>
                    <span className="text-gray-900">
                      prowizja {formatSignedZl(e.commissionGrosze)} ({e.commissionPercent}%)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function CodesSection({ partner, refresh }: { partner: AdminPartnerDetail; refresh: () => Promise<void> }) {
  const [link, setLink] = useState('')
  const [created, setCreated] = useState('')
  const [error, setError] = useState<{ link?: string; create?: string }>({})
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, action: () => Promise<unknown>, success: string, onError: (message: string) => void) => {
    setBusy(key)
    try {
      await action()
      toast.success(success)
      await refresh()
      return true
    } catch (err: any) {
      onError(apiMessage(err, 'Nie udało się zapisać zmiany'))
      return false
    } finally {
      setBusy(null)
    }
  }

  const submitLink = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = link.trim().toUpperCase()
    if (!DISCOUNT_CODE_PATTERN.test(code)) return setError({ link: 'Kod może mieć 3–30 znaków: litery A–Z (bez polskich znaków), cyfry i myślnik' })
    setError({})
    if (
      await run(
        'link',
        () => adminApi.linkPartnerCode(partner.id, code),
        `Podłączono kod ${code}`,
        (m) => setError({ link: m }),
      )
    )
      setLink('')
  }
  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = created.trim().toUpperCase()
    if (!DISCOUNT_CODE_PATTERN.test(code)) return setError({ create: 'Kod może mieć 3–30 znaków: litery A–Z (bez polskich znaków), cyfry i myślnik' })
    setError({})
    if (
      await run(
        'create',
        () => adminApi.createPartnerCode(partner.id, { code }),
        `Utworzono kod ${code}`,
        (m) => setError({ create: m }),
      )
    )
      setCreated('')
  }

  return (
    <section aria-labelledby="codes-title" className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 id="codes-title" className="text-sm font-semibold text-gray-800 mb-2">
        Kody partnera
      </h3>
      {partner.codes.length === 0 ? (
        <p className="text-xs text-gray-500 mb-3">Partner nie ma jeszcze kodu.</p>
      ) : (
        <ul aria-label="Kody partnera" className="mb-3 space-y-1">
          {partner.codes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono font-semibold">{c.code}</span>
              <span className="text-xs text-gray-600">{c.type === 'percent' ? `−${c.percentOff}%` : `−${formatZl(c.amountOffGrosze ?? 0)}`}</span>
              <span className="text-xs text-gray-600">{CODE_STATUS[c.status]}</span>
              <button
                type="button"
                className="text-xs text-red-700 underline"
                disabled={busy === c.id}
                onClick={() =>
                  run(
                    c.id,
                    () => adminApi.unlinkPartnerCode(partner.id, c.id),
                    `Odłączono kod ${c.code}`,
                    (m) => toast.error(m),
                  )
                }
                aria-label={`Odłącz kod ${c.code}`}
              >
                Odłącz
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <form onSubmit={submitLink} noValidate>
          <label htmlFor="partner-link-code" className="block text-xs text-gray-600 mb-1">
            Podłącz istniejący kod
          </label>
          <div className="flex gap-2">
            <input
              id="partner-link-code"
              value={link}
              onChange={(e) => setLink(e.target.value.toUpperCase())}
              placeholder="np. SMARTNET20"
              spellCheck={false}
              aria-invalid={Boolean(error.link)}
              className="input-field text-sm font-mono min-w-0"
            />
            <button type="submit" disabled={busy === 'link'} className="btn-secondary text-sm whitespace-nowrap">
              Podłącz
            </button>
          </div>
          {error.link && (
            <p role="alert" className="text-xs text-red-600 mt-1">
              {error.link}
            </p>
          )}
        </form>
        <form onSubmit={submitCreate} noValidate>
          <label htmlFor="partner-new-code" className="block text-xs text-gray-600 mb-1">
            Nowy kod (−{partner.customerDiscountPercent}%)
          </label>
          <div className="flex gap-2">
            <input
              id="partner-new-code"
              value={created}
              onChange={(e) => setCreated(e.target.value.toUpperCase())}
              placeholder="np. KATALOG-2027"
              spellCheck={false}
              aria-invalid={Boolean(error.create)}
              className="input-field text-sm font-mono min-w-0"
            />
            <button type="submit" disabled={busy === 'create'} className="btn-secondary text-sm whitespace-nowrap">
              Utwórz kod
            </button>
          </div>
          {error.create && (
            <p role="alert" className="text-xs text-red-600 mt-1">
              {error.create}
            </p>
          )}
        </form>
      </div>
      <p className="help-text mt-2">Podłączony kod przypisuje klientów przy kolejnych płatnościach (nie wstecz). Zmiana rabatu partnera nie zmienia istniejących kodów – nowy rabat to nowy kod.</p>
    </section>
  )
}

function EditSection({ partner, refresh }: { partner: AdminPartnerDetail; refresh: () => Promise<void> }) {
  const { form, errors, setErrors, set } = useForm<PartnerForm>(partnerToForm(partner))
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setServerError(null)
    const result = validatePartnerForm(form, { mode: 'edit' })
    setErrors(result.errors)
    if (!result.input) return
    setSaving(true)
    try {
      await adminApi.updatePartner(partner.id, result.input)
      toast.success('Zapisano zmiany partnera')
      await refresh()
    } catch (err: any) {
      setServerError(apiMessage(err, 'Nie udało się zapisać zmian'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <section aria-labelledby="edit-title" className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 id="edit-title" className="text-sm font-semibold text-gray-800 mb-1">
        Dane i stawki
      </h3>
      <p className="help-text mb-3">Nowa stawka prowizji dotyczy kolejnych płatności, nowy okres – kolejnych przypisanych klientów. Nieaktywny partner nie dostaje nowych klientów ani prowizji.</p>
      <form onSubmit={submit} noValidate className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <PartnerFields form={form} errors={errors} set={set} mode="edit" />
        {serverError && <FormAlert className="sm:col-span-2 lg:col-span-3">{serverError}</FormAlert>}
        <div className="sm:col-span-2 lg:col-span-3">
          <button type="submit" disabled={saving} className="btn-primary text-sm">
            {saving ? 'Zapisuję…' : 'Zapisz zmiany'}
          </button>
        </div>
      </form>
    </section>
  )
}
