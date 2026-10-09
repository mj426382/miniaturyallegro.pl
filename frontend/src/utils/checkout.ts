import { paymentsApi } from '../services/api'
import { isNativeApp, openInSystemBrowser, webUrl } from '../platform/native'

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

/** Spec 21, AC-ADS-005: the price (grosze) of the checkout in progress – the Google Ads purchase value. */
export function rememberCheckoutValue(priceGrosze: number | undefined) {
  try {
    if (priceGrosze) sessionStorage.setItem(CHECKOUT_VALUE_KEY, String(priceGrosze))
    else sessionStorage.removeItem(CHECKOUT_VALUE_KEY)
  } catch {
    // storage unavailable – the conversion is reported without a value
  }
}

/** Reads and forgets the remembered value in PLN, so a second visit to the success page reports nothing new. */
export function takeCheckoutValuePln(): number | undefined {
  try {
    const grosze = Number(sessionStorage.getItem(CHECKOUT_VALUE_KEY))
    sessionStorage.removeItem(CHECKOUT_VALUE_KEY)
    return grosze > 0 ? grosze / 100 : undefined
  } catch {
    return undefined
  }
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
  rememberCheckoutValue(priceGrosze)
  window.location.href = data.url
  return true
}
