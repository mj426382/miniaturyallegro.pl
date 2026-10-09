/**
 * Google Ads behind an explicit cookie consent, Consent Mode v2 in basic mode (spec 21).
 * Nothing from Google loads before the visitor clicks „Akceptuję”. The decision is one cookie on
 * .allgrafika.pl, shared by the landing page and the app (the ad click lands on one, the sign-up
 * happens on the other).
 * Identical copies: landing-page/src/consent/googleAds.ts and frontend/src/consent/googleAds.ts.
 */
const ADS_ID = (import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined) || ''
const LABELS = {
  signup: (import.meta.env.VITE_GOOGLE_ADS_SIGNUP_LABEL as string | undefined) || '',
  purchase: (import.meta.env.VITE_GOOGLE_ADS_PURCHASE_LABEL as string | undefined) || '',
}
export type AdsConversion = keyof typeof LABELS

/** Build-time flag – identical on the server (prerender) and in the browser, safe for rendering. */
export const ADS_CONFIGURED = ADS_ID !== ''
export const CONSENT_COOKIE = 'ag_consent'
export const COOKIE_SETTINGS_EVENT = 'allgrafika:cookie-settings'
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60

type Decision = 'granted' | 'denied' | null

declare global {
  interface Window {
    dataLayer?: unknown[]
    Capacitor?: { isNativePlatform?: () => boolean }
  }
}

function isNativeApp(): boolean {
  return typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.())
}

/** Ads run only in a browser, with an Ads ID, never inside the Android/iOS app (spec 18). */
export function adsEnabled(): boolean {
  return ADS_CONFIGURED && typeof window !== 'undefined' && !isNativeApp()
}

function sharedDomain(): string {
  const host = window.location.hostname
  return host === 'allgrafika.pl' || host.endsWith('.allgrafika.pl') ? '; domain=.allgrafika.pl' : ''
}

export function readDecision(): Decision {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)ag_consent=ads=([01])/)
  if (!match) return null
  return match[1] === '1' ? 'granted' : 'denied'
}

function writeDecision(granted: boolean) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=ads=${granted ? 1 : 0}; max-age=${MAX_AGE_SECONDS}; path=/; SameSite=Lax${secure}${sharedDomain()}`
}

/** The banner is needed when ads are on and the visitor has not decided yet. */
export function needsDecision(): boolean {
  return adsEnabled() && readDecision() === null
}

// gtag.js reads the `arguments` object from dataLayer – a rest array would not work.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function gtag(..._args: unknown[]) {
  window.dataLayer = window.dataLayer || []
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments)
}

let tagLoaded = false

function loadTag() {
  if (tagLoaded) return
  tagLoaded = true
  gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' })
  gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'denied' })
  gtag('js', new Date())
  gtag('config', ADS_ID)
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ADS_ID)}`
  script.setAttribute('data-google-ads', '1')
  document.head.appendChild(script)
}

function deleteGoogleAdsCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim()
    if (!name.startsWith('_gcl_')) continue
    document.cookie = `${name}=; max-age=0; path=/`
    document.cookie = `${name}=; max-age=0; path=/${sharedDomain()}`
  }
}

/** Call once at start-up: loads the tag only for visitors who already said yes. */
export function initGoogleAds() {
  if (adsEnabled() && readDecision() === 'granted') loadTag()
}

export function setAdsConsent(granted: boolean) {
  if (!adsEnabled()) return
  writeDecision(granted)
  if (granted) {
    loadTag()
    return
  }
  if (tagLoaded) gtag('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' })
  deleteGoogleAdsCookies()
}

/** Reopens the banner („Ustawienia cookies”). */
export function openCookieSettings() {
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))
}

/** Conversion for Google Ads – only with consent and a configured label; never carries personal data. */
export function trackAdsConversion(kind: AdsConversion, valuePln?: number) {
  if (!adsEnabled() || readDecision() !== 'granted' || !LABELS[kind]) return
  loadTag()
  const value = valuePln && valuePln > 0 ? { value: valuePln, currency: 'PLN' } : {}
  gtag('event', 'conversion', { send_to: `${ADS_ID}/${LABELS[kind]}`, ...value })
}
