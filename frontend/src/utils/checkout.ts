import { paymentsApi } from '../services/api'
import { isNativeApp, openInSystemBrowser, webUrl } from '../platform/native'
import { trackAdsConversion, trackEvent } from '../consent/googleTag'

const LAST_PACKAGE_KEY = 'allgrafika:last-package'
const CHECKOUT_VALUE_KEY = 'allgrafika:checkout-value'

/** Spec 19, AC-MON-004: the package of the last checkout, so "Spróbuj ponownie" can reopen it. */
export function lastCheckoutPackage(): string | null {
  try {
    return sessionStorage.getItem(LAST_PACKAGE_KEY)
  } catch {
    return null
  }
}

export function rememberCheckoutPackage(packageId: string) {
  try {
    sessionStorage.setItem(LAST_PACKAGE_KEY, packageId)
  } catch {
    // storage unavailable (private mode) – retry then falls back to the package list
  }
}

/** The checkout in progress: price, package/plan id and a random transaction id (no personal data). */
export interface PendingCheckout {
  grosze: number
  itemId?: string
  transactionId?: string
}

function newTransactionId(): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `ag-${random}`
}

function ecommerce(checkout: PendingCheckout) {
  const value = checkout.grosze / 100
  return { currency: 'PLN', value, items: checkout.itemId ? [{ item_id: checkout.itemId, price: value, quantity: 1 }] : [] }
}

/**
 * Spec 21 + 22: remembers the checkout about to open (Google Ads purchase value, GA4 transaction id)
 * and reports GA4 'begin_checkout'. Called right before the redirect to Stripe.
 */
export function beginCheckout(itemId: string, priceGrosze: number | undefined) {
  const checkout: PendingCheckout | null = priceGrosze ? { grosze: priceGrosze, itemId, transactionId: newTransactionId() } : null
  try {
    if (checkout) sessionStorage.setItem(CHECKOUT_VALUE_KEY, JSON.stringify(checkout))
    else sessionStorage.removeItem(CHECKOUT_VALUE_KEY)
  } catch {
    // storage unavailable – the purchase is reported to Google Ads without a value and not to GA4
  }
  if (checkout) trackEvent('begin_checkout', ecommerce(checkout))
}

/** Reads and forgets the remembered checkout, so a second visit to the success page reports nothing new. */
export function takeCheckout(): PendingCheckout | null {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_VALUE_KEY)
    sessionStorage.removeItem(CHECKOUT_VALUE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    // Before spec 22 only the price in grosze was stored.
    if (typeof parsed === 'number') return parsed > 0 ? { grosze: parsed } : null
    if (parsed && typeof parsed === 'object' && Number((parsed as PendingCheckout).grosze) > 0) return parsed as PendingCheckout
    return null
  } catch {
    return null
  }
}

/**
 * After the return from a successful payment: the Google Ads conversion „Zakup” (spec 21) and the GA4
 * 'purchase' (spec 22) – each only with its own consent. GA4 needs the transaction id (deduplication),
 * so without a remembered checkout only Google Ads is told, as before.
 */
export function reportPurchase() {
  const checkout = takeCheckout()
  trackAdsConversion('purchase', checkout ? checkout.grosze / 100 : undefined)
  if (checkout?.transactionId) trackEvent('purchase', { transaction_id: checkout.transactionId, ...ecommerce(checkout) })
}

/**
 * Opens the payment for a one-time pack. The caller has already collected the consumer-law consent
 * (art. 38 pkt 13). The Android/iOS app never sells credits itself (spec 18) – it opens the web page.
 * Returns false when the browser was not redirected (native app).
 */
export async function startPackageCheckout(packageId: string, priceGrosze?: number): Promise<boolean> {
  if (isNativeApp()) {
    await openInSystemBrowser(webUrl('/credits'))
    return false
  }
  const { data } = await paymentsApi.createCheckout(packageId, true)
  if (!data.url) throw new Error('Nie udało się utworzyć sesji płatności')
  rememberCheckoutPackage(packageId)
  beginCheckout(packageId, priceGrosze)
  window.location.href = data.url
  return true
}
