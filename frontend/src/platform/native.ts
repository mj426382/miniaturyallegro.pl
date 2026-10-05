import { Capacitor } from '@capacitor/core'

/**
 * Spec 18: the Android/iOS apps are this same React app packaged with Capacitor. Everything
 * platform-specific goes through this module so the web build behaves exactly as before –
 * plugins are imported lazily and only ever on a native platform.
 */
export const WEB_APP_URL = 'https://app.allgrafika.pl'

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

/** Google Identity Services refuses embedded WebViews – needs the native plugin and OAuth ids first. */
export function googleSignInAvailable(): boolean {
  return !isNativeApp()
}

export type NativePurchaseMode = 'web-link' | 'hidden'

/**
 * Credits are never sold inside the app (store rules). `web-link` opens the web credits page in the
 * system browser; `hidden` removes the purchase buttons (fallback if a store rejects the link).
 */
export function nativePurchaseMode(): NativePurchaseMode {
  return import.meta.env.VITE_NATIVE_PURCHASES === 'hidden' ? 'hidden' : 'web-link'
}

/** Opens a page outside the app (Stripe checkout on the web, Allegro OAuth, e-mail links). */
export async function openInSystemBrowser(url: string): Promise<void> {
  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url })
}

/** Absolute web URL for an app path – the native bundle runs on capacitor://localhost. */
export function webUrl(path: string): string {
  return `${WEB_APP_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/** Calls `onResume` whenever the app returns to the foreground. Returns an unsubscribe function. */
export async function onAppResume(onResume: () => void): Promise<() => void> {
  const { App } = await import('@capacitor/app')
  const handle = await App.addListener('resume', onResume)
  return () => {
    handle.remove().catch(() => undefined)
  }
}
