import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { usersApi, paymentsApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  CreditCardIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

const FREE_LIMIT = 10

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
  createdAt: string
}

interface UserInfo {
  credits: number
  freeCreditsUsed: number
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Oczekuje', color: 'text-yellow-600 bg-yellow-50' },
  completed: { label: 'Opłacono', color: 'text-green-600 bg-green-50' },
  failed: { label: 'Nieudana', color: 'text-red-600 bg-red-50' },
}

export default function Credits() {
  const [searchParams] = useSearchParams()
  const [packages, setPackages] = useState<Package[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [buyingPackageId, setBuyingPackageId] = useState<string | null>(null)

  const success = searchParams.get('success') === '1'
  const canceled = searchParams.get('canceled') === '1'

  useEffect(() => {
    if (success) toast.success('Płatność zakończona! Kredyty zostały dodane do konta.', { duration: 5000 })
    if (canceled) toast.error('Płatność anulowana.')
  }, [success, canceled])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [pkgRes, userRes, histRes] = await Promise.all([
        paymentsApi.getPackages(),
        usersApi.getMe(),
        paymentsApi.getHistory(),
      ])
      setPackages(pkgRes.data)
      setUserInfo({ credits: userRes.data.credits, freeCreditsUsed: userRes.data.freeCreditsUsed })
      setTransactions(histRes.data)
    } catch {
      toast.error('Nie udało się załadować danych')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBuy = async (packageId: string) => {
    setBuyingPackageId(packageId)
    try {
      const { data } = await paymentsApi.createCheckout(packageId)
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error('Nie udało się utworzyć sesji płatności')
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Błąd płatności')
    } finally {
      setBuyingPackageId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  const freeUsed = userInfo?.freeCreditsUsed ?? 0
  const freeLeft = Math.max(0, FREE_LIMIT - freeUsed)
  const paidCredits = userInfo?.credits ?? 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Kredyty</h1>
      <p className="text-gray-500 mb-8">1 kredyt = 1 wygenerowana grafika produktowa = 2 zł (komplet 6 stylów = 12 zł)</p>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
              <SparklesIcon className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Darmowe grafiki</p>
              <p className="text-2xl font-bold text-gray-900">{freeLeft} / {FREE_LIMIT}</p>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${(freeUsed / FREE_LIMIT) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {freeUsed === 0
              ? 'Nie użyto jeszcze żadnego darmowego kredytu'
              : `Użyto ${freeUsed} z ${FREE_LIMIT} darmowych grafik`}
          </p>
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
          <p className="text-xs text-gray-400 mt-3">
            1 kredyt = 1 zdjęcie = 2 zł. Komplet 6 stylów = 6 kredytów = 12 zł.
          </p>
        </div>
      </div>

      {/* Packages */}
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Doładuj kredyty</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className={`relative bg-white rounded-xl border-2 p-6 flex flex-col gap-4 transition-shadow hover:shadow-md ${
              pkg.id === 'credits_25' ? 'border-blue-500' : 'border-gray-200'
            }`}
          >
            {pkg.id === 'credits_25' && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                Popularny
              </span>
            )}
            <div>
              <p className="text-xl font-bold text-gray-900">{pkg.label}</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{pkg.priceLabel}</p>
              <p className="text-sm text-gray-400 mt-0.5">
                {(pkg.priceGrosze / 100 / pkg.credits).toFixed(2)} zł / kredyt
              </p>
              {pkg.savingLabel && (
                <p className="text-xs text-green-600 font-medium mt-1">{pkg.savingLabel}</p>
              )}
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
            </ul>
            <button
              onClick={() => handleBuy(pkg.id)}
              disabled={buyingPackageId === pkg.id}
              className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                pkg.id === 'credits_25'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {buyingPackageId === pkg.id ? 'Przekierowuję...' : `Kup ${pkg.label}`}
            </button>
          </div>
        ))}
      </div>

      {/* Transaction history */}
      {transactions.length > 0 && (
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map((tx) => {
                  const status = STATUS_MAP[tx.status] ?? { label: tx.status, color: 'text-gray-600 bg-gray-50' }
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex items-center gap-2">
                          <ClockIcon className="h-4 w-4 text-gray-400" />
                          {new Date(tx.createdAt).toLocaleDateString('pl-PL')}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">+{tx.creditsAdded}</td>
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {transactions.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <CreditCardIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Brak historii transakcji</p>
          <p className="text-sm mt-1">Pierwsze 10 grafik jest darmowych!</p>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link to="/" className="text-sm text-blue-600 hover:underline">← Wróć do dashboardu</Link>
      </div>
    </div>
  )
}
