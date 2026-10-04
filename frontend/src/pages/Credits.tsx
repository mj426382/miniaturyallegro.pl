import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usersApi, paymentsApi, SubscriptionPlan, SubscriptionInfo } from '../services/api'
import { track } from '../services/analytics'
import { useAuth } from '../hooks/useAuth'
import { usePageTitle } from '../hooks/usePageTitle'
import toast from 'react-hot-toast'
import { CreditCardIcon, CheckCircleIcon, XCircleIcon, SparklesIcon, ClockIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'

const FREE_LIMIT = 10
const HIGHLIGHTED_PACKAGE = 'credits_15'

interface Package {
  id: string
  credits: number
  priceGrosze: number
  label: string
  priceLabel: string
  savingLabel: string | null
}

interface Transaction {
  id: string
  creditsAdded: number
  amountPln: number
  status: string
  kind?: 'package' | 'subscription'
  createdAt: string
  /** Spec 09: a Stripe invoice exists (with the tax id when the buyer gave one). */
  hasInvoice?: boolean
}

interface CreditsPageData {
  packages: Package[]
  plans: SubscriptionPlan[]
  subscription: SubscriptionInfo | null
  credits: number
  freeCreditsUsed: number
  transactions: Transaction[]
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Oczekuje', color: 'text-yellow-700 bg-yellow-50' },
  completed: { label: 'Opłacono', color: 'text-green-700 bg-green-50' },
  failed: { label: 'Nieudana', color: 'text-red-700 bg-red-50' },
  expired: { label: 'Wygasła', color: 'text-gray-600 bg-gray-50' },
}

async function loadCreditsPage(): Promise<CreditsPageData> {
  const [pkgRes, userRes, histRes, plansRes, subRes] = await Promise.all([paymentsApi.getPackages(), usersApi.getMe(), paymentsApi.getHistory(), paymentsApi.getPlans(), paymentsApi.getSubscription()])
  return {
    packages: pkgRes.data as Package[],
    plans: plansRes.data.filter((p) => p.available),
    subscription: subRes.data.subscription,
    credits: userRes.data.credits,
    freeCreditsUsed: userRes.data.freeCreditsUsed,
    transactions: histRes.data as Transaction[],
  }
}

export default function Credits() {
  usePageTitle('Kredyty')
  const [searchParams, setSearchParams] = useSearchParams()
  const { refreshUser } = useAuth()
  const page = useQuery({ queryKey: ['credits-page'], queryFn: loadCreditsPage })
  const [isOpeningPortal, setIsOpeningPortal] = useState(false)
  const [buyingPackageId, setBuyingPackageId] = useState<string | null>(null)
  const [openingInvoice, setOpeningInvoice] = useState<string | null>(null)

  /** Stripe invoice links expire, so a fresh one is requested on every click (spec 09). */
  const openInvoice = async (transactionId: string) => {
    setOpeningInvoice(transactionId)
    // Opened synchronously inside the click so the browser does not block it as a pop-up.
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    try {
      const { data } = await paymentsApi.invoiceUrl(transactionId)
      if (tab) tab.location.href = data.url
      else window.location.href = data.url
    } catch (err: any) {
      tab?.close()
      const message = err.response?.data?.message
      toast.error(Array.isArray(message) ? message.join('. ') : message || 'Nie udało się otworzyć faktury')
    } finally {
      setOpeningInvoice(null)
    }
  }
  const [acceptedWaiver, setAcceptedWaiver] = useState(false)
  const [acceptedSubscriptionTerms, setAcceptedSubscriptionTerms] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const waiverRef = useRef<HTMLLabelElement>(null)
  const subscriptionTermsRef = useRef<HTMLLabelElement>(null)

  const nudge = (ref: React.RefObject<HTMLLabelElement>, message: string) => {
    toast.error(message)
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    ref.current?.querySelector('input')?.focus()
  }

  const success = searchParams.get('success') === '1' || searchParams.get('subscribed') === '1'
  const canceled = searchParams.get('canceled') === '1'

  useEffect(() => {
    if (success) {
      toast.success('Płatność przyjęta! Kredyty pojawią się na koncie w ciągu kilku sekund.', { duration: 6000 })
      track('purchase', { type: searchParams.get('subscribed') === '1' ? 'subscription' : 'package' })
    }
    if (canceled) toast.error('Płatność anulowana.')
    // Drop the flags so a refresh / back navigation does not re-fire toasts, polling and analytics.
    if (success || canceled) setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The Stripe webhook adds credits asynchronously – re-check a few times after a successful return.
  const refetch = page.refetch
  useEffect(() => {
    if (!success) return
    let attempts = 0
    const timer = window.setInterval(() => {
      attempts++
      refetch()
      refreshUser().catch(() => undefined)
      if (attempts >= 5) window.clearInterval(timer)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [success, refetch, refreshUser])

  const describeError = (err: any, fallback: string) => {
    const message = err.response?.data?.message
    return Array.isArray(message) ? message.join('. ') : message || fallback
  }

  const handleBuy = async (packageId: string) => {
    if (redirecting) return
    if (!acceptedWaiver) {
      nudge(waiverRef, 'Zaznacz zgodę na natychmiastowe udostępnienie kredytów, aby przejść do płatności.')
      return
    }
    setBuyingPackageId(packageId)
    try {
      const { data } = await paymentsApi.createCheckout(packageId, true)
      if (data.url) {
        setRedirecting(true) // keep buttons disabled while the browser navigates – no second session
        window.location.href = data.url
        return
      }
      toast.error('Nie udało się utworzyć sesji płatności')
    } catch (err: any) {
      toast.error(describeError(err, 'Błąd płatności'))
    }
    setBuyingPackageId(null)
  }

  const handleSubscribe = async (planId: string) => {
    if (redirecting) return
    if (!acceptedSubscriptionTerms) {
      nudge(subscriptionTermsRef, 'Zaznacz zgodę na rozpoczęcie świadczenia usługi abonamentowej, aby przejść do płatności.')
      return
    }
    setBuyingPackageId(planId)
    try {
      const { data } = await paymentsApi.subscribe(planId, true)
      if (data.url) {
        setRedirecting(true)
        window.location.href = data.url
        return
      }
      toast.error('Nie udało się utworzyć sesji płatności')
    } catch (err: any) {
      toast.error(describeError(err, 'Błąd płatności'))
    }
    setBuyingPackageId(null)
  }

  const openPortal = async () => {
    setIsOpeningPortal(true)
    try {
      const { data } = await paymentsApi.portal()
      if (data.url) window.location.href = data.url
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Nie udało się otworzyć panelu subskrypcji')
    } finally {
      setIsOpeningPortal(false)
    }
  }

  if (page.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (page.isError || !page.data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Kredyty</h1>
        <div role="alert" className="text-center py-12 bg-white rounded-xl border border-red-200">
          <p className="text-gray-700 mb-3">Nie udało się załadować danych o kredytach.</p>
          <button onClick={() => page.refetch()} className="btn-secondary">
            Spróbuj ponownie
          </button>
        </div>
      </div>
    )
  }

  const { packages, plans, subscription, transactions } = page.data
  const freeUsed = page.data.freeCreditsUsed
  const freeLeft = Math.max(0, FREE_LIMIT - freeUsed)
  const paidCredits = page.data.credits

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Kredyty</h1>
      <p className="text-gray-500 mb-8">
        1 kredyt = 1 wygenerowana grafika. Zestaw startowy to 3 kredyty, każdy kolejny styl (z 19, także sezonowe i branżowe) to 1 kredyt. Opis oferty pod SEO jest gratis do każdego zdjęcia z gotową
        grafiką (5 poprawek AI w cenie, kolejne 15 poprawek = 1 kredyt).
      </p>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
              <SparklesIcon className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Darmowe grafiki</p>
              <p className="text-2xl font-bold text-gray-900">
                {freeLeft} / {FREE_LIMIT}
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2" role="progressbar" aria-valuenow={freeUsed} aria-valuemin={0} aria-valuemax={FREE_LIMIT} aria-label="Zużyte darmowe grafiki">
            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (freeUsed / FREE_LIMIT) * 100)}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-2">{freeUsed === 0 ? 'Nie użyto jeszcze żadnego darmowego kredytu' : `Użyto ${Math.min(freeUsed, FREE_LIMIT)} z ${FREE_LIMIT} darmowych grafik`}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <CreditCardIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Zakupione kredyty</p>
              <p className="text-2xl font-bold text-gray-900">{paidCredits}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">Kredyty nie wygasają. Nieudane generacje są automatycznie zwracane.</p>
        </div>
      </div>

      {/* Subscription */}
      {(plans.length > 0 || subscription) && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Abonament miesięczny</h2>
          <p className="text-sm text-gray-500 mb-4">Dla sklepów, które dodają produkty regularnie: kredyty co miesiąc w niższej cenie, anulujesz w każdej chwili.</p>
          {subscription && (
            <div className={`rounded-xl border p-5 mb-4 flex flex-wrap items-center justify-between gap-4 ${subscription.active ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
              <div>
                <p className="font-semibold text-gray-900">
                  Plan {subscription.planName}
                  {subscription.creditsPerMonth ? ` · ${subscription.creditsPerMonth} kredytów / mies.` : ''}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  Status: {subscription.active ? 'aktywny' : subscription.status}
                  {subscription.currentPeriodEnd && ` · ${subscription.cancelAtPeriodEnd ? 'wygasa' : 'odnowienie'} ${new Date(subscription.currentPeriodEnd).toLocaleDateString('pl-PL')}`}
                </p>
              </div>
              <button onClick={openPortal} disabled={isOpeningPortal} className="btn-secondary text-sm">
                {isOpeningPortal ? 'Otwieram...' : 'Zarządzaj subskrypcją'}
              </button>
            </div>
          )}
          {!subscription?.active && plans.length > 0 && (
            <label ref={subscriptionTermsRef} className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedSubscriptionTerms}
                onChange={(e) => setAcceptedSubscriptionTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">
                Żądam rozpoczęcia świadczenia usługi abonamentowej przed upływem 14-dniowego terminu odstąpienia od umowy. Przyjmuję do wiadomości, że w razie odstąpienia zapłacę za świadczenia
                spełnione do chwili odstąpienia (kredyty już udostępnione), a abonament odnawia się co miesiąc do czasu anulowania w panelu Stripe (art. 35 ustawy o prawach konsumenta). Szczegóły w{' '}
                <Link to="/regulamin" target="_blank" className="text-blue-600 underline">
                  regulaminie
                </Link>
                .
              </span>
            </label>
          )}
          {!subscription?.active && plans.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {plans.map((plan) => (
                <div key={plan.id} className="bg-white rounded-xl border-2 border-gray-200 p-6 flex flex-col gap-3 hover:shadow-md transition-shadow">
                  <div>
                    <p className="text-xl font-bold text-gray-900">{plan.name}</p>
                    <p className="text-3xl font-bold text-blue-600 mt-1">{plan.priceLabel}</p>
                    <p className="text-sm text-gray-500 mt-2">{plan.description}</p>
                  </div>
                  <button onClick={() => handleSubscribe(plan.id)} disabled={buyingPackageId === plan.id || redirecting} className="btn-primary w-full mt-auto">
                    {buyingPackageId === plan.id ? 'Przekierowuję...' : `Wybierz plan ${plan.name}`}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Packages */}
      <h2 className="text-lg font-semibold text-gray-800 mb-1">Pakiety jednorazowe</h2>
      <p className="text-sm text-gray-500 mb-4">Bez zobowiązań – kup, kiedy potrzebujesz.</p>

      {/* Consumer-law consent (art. 38 pkt 13 ustawy o prawach konsumenta) – before the buttons, not after */}
      <label ref={waiverRef} className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4 mb-4 cursor-pointer">
        <input type="checkbox" checked={acceptedWaiver} onChange={(e) => setAcceptedWaiver(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
        <span className="text-sm text-gray-600">
          Żądam natychmiastowego udostępnienia kredytów po opłaceniu zamówienia i przyjmuję do wiadomości, że z chwilą ich udostępnienia tracę prawo do odstąpienia od umowy w terminie 14 dni (art. 38
          pkt 13 ustawy o prawach konsumenta). Niewykorzystane kredyty nie wygasają. Szczegóły w{' '}
          <Link to="/regulamin" target="_blank" className="text-blue-600 underline">
            regulaminie
          </Link>
          .
        </span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {packages.map((pkg) => {
          const highlighted = pkg.id === HIGHLIGHTED_PACKAGE
          return (
            <div key={pkg.id} className={`relative bg-white rounded-xl border-2 p-6 flex flex-col gap-4 transition-shadow hover:shadow-md ${highlighted ? 'border-blue-500' : 'border-gray-200'}`}>
              {highlighted && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">Popularny</span>}
              <div>
                <p className="text-xl font-bold text-gray-900">{pkg.label}</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{pkg.priceLabel}</p>
                <p className="text-sm text-gray-500 mt-0.5">{(pkg.priceGrosze / 100 / pkg.credits).toFixed(2)} zł / kredyt · brutto</p>
                {pkg.savingLabel && <p className="text-xs text-green-700 font-medium mt-1">{pkg.savingLabel}</p>}
              </div>
              <ul className="text-sm text-gray-600 space-y-1 flex-1">
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-green-500 shrink-0" />
                  {pkg.credits} grafik
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-green-500 shrink-0" />
                  Nigdy nie wygasają
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-green-500 shrink-0" />
                  Bezpieczna płatność Stripe
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-green-500 shrink-0" />
                  Faktura VAT – NIP podasz w formularzu płatności
                </li>
              </ul>
              <button onClick={() => handleBuy(pkg.id)} disabled={buyingPackageId === pkg.id || redirecting} className={highlighted ? 'btn-primary w-full' : 'btn-secondary w-full'}>
                {buyingPackageId === pkg.id ? 'Przekierowuję...' : `Kup ${pkg.label}`}
              </button>
            </div>
          )
        })}
      </div>

      {/* Transaction history */}
      {transactions.length > 0 ? (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Historia transakcji</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Data</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Kredyty</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Kwota</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">
                    <span className="sr-only">Faktura</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map((tx) => {
                  const status = STATUS_MAP[tx.status] ?? { label: tx.status, color: 'text-gray-600 bg-gray-50' }
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex items-center gap-2">
                          <ClockIcon className="h-4 w-4 text-gray-500" />
                          {new Date(tx.createdAt).toLocaleDateString('pl-PL')}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        +{tx.creditsAdded}
                        {tx.kind === 'subscription' && <span className="ml-1 text-xs font-normal text-gray-500">abonament</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{(tx.amountPln / 100).toFixed(2)} zł</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {tx.status === 'completed' ? (
                            <CheckCircleIcon className="h-3.5 w-3.5" />
                          ) : tx.status === 'failed' ? (
                            <XCircleIcon className="h-3.5 w-3.5" />
                          ) : (
                            <ClockIcon className="h-3.5 w-3.5" />
                          )}
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {tx.hasInvoice && (
                          <button
                            type="button"
                            onClick={() => openInvoice(tx.id)}
                            disabled={openingInvoice === tx.id}
                            className="text-blue-600 hover:underline text-sm flex items-center gap-1 ml-auto"
                          >
                            <DocumentArrowDownIcon className="h-4 w-4" />
                            {openingInvoice === tx.id ? 'Otwieram...' : 'Faktura'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <CreditCardIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Brak historii transakcji</p>
          <p className="text-sm mt-1">Pierwsze {FREE_LIMIT} grafik jest darmowych!</p>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          ← Wróć do dashboardu
        </Link>
      </div>
    </div>
  )
}
