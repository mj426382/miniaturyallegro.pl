import { isNativeApp } from './native'

/**
 * Spec 18, AC-MOB-001/002: session transport in the native apps.
 *
 * The web app keeps the httpOnly cookie. Inside the iOS/Android WebView the API is a different site
 * and WKWebView drops third-party cookies, so the app uses the token the API returns on login and
 * sign-up (`Authorization: Bearer`, accepted by the API). It is kept in app storage (Capacitor
 * Preferences, sandboxed per app) and mirrored in memory so the request interceptor stays synchronous.
 */
const KEY = 'allgrafika.session'
let current: string | null = null

async function preferences() {
  const { Preferences } = await import('@capacitor/preferences')
  return Preferences
}

/** Restores the token at start-up (native only). */
export async function loadSessionToken(): Promise<string | null> {
  if (!isNativeApp()) return null
  const { value } = await (await preferences()).get({ key: KEY })
  current = value || null
  return current
}

export function getSessionToken(): string | null {
  return isNativeApp() ? current : null
}

export async function setSessionToken(token: string | null | undefined): Promise<void> {
  if (!isNativeApp()) return
  current = token || null
  const prefs = await preferences()
  if (current) await prefs.set({ key: KEY, value: current })
  else await prefs.remove({ key: KEY })
}

export async function clearSessionToken(): Promise<void> {
  await setSessionToken(null)
}
