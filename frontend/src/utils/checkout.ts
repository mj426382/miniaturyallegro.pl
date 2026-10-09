import { paymentsApi } from '../services/api'
import { isNativeApp, openInSystemBrowser, webUrl } from '../platform/native'

const LAST_PACKAGE_KEY = 'allgrafika:last-package'

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

/**
 * Opens the payment for a one-time pack. The caller has already collected the consumer-law consent
 * (art. 38 pkt 13). The Android/iOS app never sells credits itself (spec 18) – it opens the web page.
 * Returns false when the browser was not redirected (native app).
 */
export async function startPackageCheckout(packageId: string): Promise<boolean> {
  if (isNativeApp()) {
    await openInSystemBrowser(webUrl('/credits'))
    return false
  }
  const { data } = await paymentsApi.createCheckout(packageId, true)
  if (!data.url) throw new Error('Nie udało się utworzyć sesji płatności')
  rememberCheckoutPackage(packageId)
  window.location.href = data.url
  return true
}
