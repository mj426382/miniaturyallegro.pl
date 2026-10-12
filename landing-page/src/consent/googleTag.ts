/**
 * One Google tag (gtag.js) for Google Analytics 4 (spec 22) and Google Ads (spec 21), behind an
 * explicit cookie consent per category, Consent Mode v2 in basic mode: nothing from Google loads
 * before the visitor grants at least one non-essential category, and each product is configured
 * only when its own category is granted (no cookieless pings).
 *
 *   niezbędne      – always on (the decision cookie itself, login session)
 *   analityczne    – GA4 → analytics_storage
 *   marketingowe   – Google Ads → ad_storage, ad_user_data, ad_personalization
 *
 * The decision is one cookie on .allgrafika.pl, shared by the landing page and the app (the ad click
 * lands on one, sign-up and purchase happen on the other; GA4 also keeps one _ga client id for both).
 * Identical copies: landing-page/src/consent/googleTag.ts and frontend/src/consent/googleTag.ts.
 */

/** GA4 web stream of allgrafika.pl – a public identifier. VITE_GA4_ID overrides it; any non "G-…" value (e.g. "off") disables GA4. */
const GA4_DEFAULT_ID = 'G-C3NE5EW4ED'
const GA4_CANDIDATE = ((import.meta.env.VITE_GA4_ID as string | undefined) ?? GA4_DEFAULT_ID).trim()
export const GA4_ID = /^G-[A-Z0-9]+$/.test(GA4_CANDIDATE) ? GA4_CANDIDATE : ''

const ADS_ID = (import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined) || ''
const LABELS = {
  signup: (import.meta.env.VITE_GOOGLE_ADS_SIGNUP_LABEL as string | undefined) || '',
  purchase: (import.meta.env.VITE_GOOGLE_ADS_PURCHASE_LABEL as string | undefined) || '',
}
export type AdsConversion = keyof typeof LABELS

/** Build-time flags – identical on the server (prerender) and in the browser, safe for rendering. */
export const GA4_CONFIGURED = GA4_ID !== ''
export const ADS_CONFIGURED = ADS_ID !== ''
export const CONSENT_CONFIGURED = GA4_CONFIGURED || ADS_CONFIGURED

export const CONSENT_COOKIE = 'ag_consent'
export const COOKIE_SETTINGS_EVENT = 'allgrafika:cookie-settings'
const CONSENT_VERSION = 2
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60
/** _ga cookies live at most 400 days (the browser cap), GA4 keeps the data 14 months (spec 22). */
const GA_COOKIE_SECONDS = 400 * 24 * 60 * 60

/** What the visitor allowed. Necessary cookies are not a choice, so they are not listed. */
export interface ConsentChoice {
  analytics: boolean
  ads: boolean
}
/** Stored decision; null = never asked (new visitor, or a category added after the last decision). */
export interface StoredConsent {
  analytics: boolean | null
  ads: boolean | null
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    Capacitor?: { isNativePlatform?: () => boolean }
    [gaDisable: `ga-disable-${string}`]: boolean | undefined
  }
}

function isNativeApp(): boolean {
  return typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.())
}

/** Google runs only in a browser, with an ID, never inside the Android/iOS app (spec 18). */
export function consentEnabled(): boolean {
  return CONSENT_CONFIGURED && typeof window !== 'undefined' && !isNativeApp()
}
export function analyticsEnabled(): boolean {
  return GA4_CONFIGURED && consentEnabled()
}
export function adsEnabled(): boolean {
  return ADS_CONFIGURED && consentEnabled()
}

function sharedDomain(): string {
  const host = window.location.hostname
  return host === 'allgrafika.pl' || host.endsWith('.allgrafika.pl') ? '; domain=.allgrafika.pl' : ''
}

/**
 * Reads the decision cookie. v2: "ads=1&analytics=0&v=2"; v1 (spec 21): "ads=1" – the Ads decision
 * carries over unchanged and analytics counts as never asked, so the banner asks again for it only.
 * v2 keeps "ads=" first, so a not yet redeployed v1 reader still sees the Ads decision.
 */
export function readConsent(): StoredConsent {
  const none: StoredConsent = { analytics: null, ads: null }
  if (typeof document === 'undefined') return none
  const raw = document.cookie.match(/(?:^|;\s*)ag_consent=([^;]*)/)?.[1]
  if (!raw) return none
  const fields = new URLSearchParams(raw)
  const flag = (key: string) => (fields.get(key) === '1' ? true : fields.get(key) === '0' ? false : null)
  return { ads: flag('ads'), analytics: flag('analytics') }
}

/** Categories that are granted right now (stored "yes" and the product is enabled here). */
export function grantedConsent(): ConsentChoice {
  const stored = readConsent()
  return { analytics: analyticsEnabled() && stored.analytics === true, ads: adsEnabled() && stored.ads === true }
}

function writeConsent(choice: ConsentChoice) {
  const stored = readConsent()
  // A category not configured on this site keeps the decision made on the other one.
  const ads = ADS_CONFIGURED ? choice.ads : stored.ads
  const analytics = GA4_CONFIGURED ? choice.analytics : stored.analytics
  const fields = [ads === null ? '' : `ads=${ads ? 1 : 0}`, analytics === null ? '' : `analytics=${analytics ? 1 : 0}`, `v=${CONSENT_VERSION}`].filter(Boolean)
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${fields.join('&')}; max-age=${MAX_AGE_SECONDS}; path=/; SameSite=Lax${secure}${sharedDomain()}`
}

/** The banner is needed when a configured category has no decision yet. */
export function needsDecision(): boolean {
  const stored = readConsent()
  return (analyticsEnabled() && stored.analytics === null) || (adsEnabled() && stored.ads === null)
}

// gtag.js reads the `arguments` object from dataLayer – a rest array would not work.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function gtag(..._args: unknown[]) {
  window.dataLayer = window.dataLayer || []
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments)
}

/** Query parameters Google needs for attribution; everything else (tokens, demo ids, e-mails) never leaves the page. */
const ATTRIBUTION_PARAM = /^(utm_[a-z_]+|gclid|gbraid|wbraid|dclid|gad_source|gad_campaignid|srsltid)$/

/** The current URL without the hash and without query parameters other than the attribution ones. */
export function pageLocation(): string {
  const { origin, pathname, search } = window.location
  const kept = new URLSearchParams()
  new URLSearchParams(search).forEach((value, key) => {
    if (ATTRIBUTION_PARAM.test(key)) kept.append(key, value)
  })
  const query = kept.toString()
  return `${origin}${pathname}${query ? `?${query}` : ''}`
}

function consentState(choice: ConsentChoice) {
  const ads = choice.ads ? 'granted' : 'denied'
  return { ad_storage: ads, ad_user_data: ads, ad_personalization: ads, analytics_storage: choice.analytics ? 'granted' : 'denied' }
}

let tagLoaded = false
const configured = { analytics: false, ads: false }
let currentPage: string | null = null
let lastPageView: string | null = null

/** Loads gtag.js once (on the first granted category) and configures each product once its category is granted. */
function applyConsent(choice: ConsentChoice) {
  if (GA4_CONFIGURED && typeof window !== 'undefined') window[`ga-disable-${GA4_ID}`] = !choice.analytics
  if (!choice.analytics) lastPageView = null
  if (!tagLoaded) {
    if (!choice.analytics && !choice.ads) return
    tagLoaded = true
    gtag('consent', 'default', consentState({ analytics: false, ads: false }))
    gtag('consent', 'update', consentState(choice))
    gtag('set', 'ads_data_redaction', true)
    gtag('set', { page_location: pageLocation() })
    gtag('js', new Date())
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(choice.ads ? ADS_ID : GA4_ID)}`
    script.setAttribute('data-google-tag', '1')
    document.head.appendChild(script)
  } else {
    gtag('consent', 'update', consentState(choice))
  }
  if (choice.analytics && !configured.analytics) {
    configured.analytics = true
    // Page views are sent by trackPageView() with a cleaned URL, also on client-side route changes.
    gtag('config', GA4_ID, { send_page_view: false, cookie_expires: GA_COOKIE_SECONDS })
  }
  if (choice.ads && !configured.ads) {
    configured.ads = true
    gtag('config', ADS_ID)
  }
  if (choice.analytics) sendPageView()
}

/** Before an event: the tag must run with the current decision (it may have changed on the other domain, same cookie). */
function ensureTag() {
  const granted = grantedConsent()
  if (!tagLoaded || (granted.analytics && !configured.analytics) || (granted.ads && !configured.ads)) applyConsent(granted)
}

function deleteCookies(prefix: RegExp) {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim()
    if (!prefix.test(name)) continue
    document.cookie = `${name}=; max-age=0; path=/`
    document.cookie = `${name}=; max-age=0; path=/${sharedDomain()}`
  }
}

/** Call once at start-up: loads the tag only for visitors who already granted a category. */
export function initGoogleTag() {
  if (consentEnabled()) applyConsent(grantedConsent())
}

/** Saves the visitor's choice; withdrawing a category stops it and deletes its cookies. */
export function setConsent(choice: ConsentChoice) {
  if (!consentEnabled()) return
  writeConsent(choice)
  const granted = grantedConsent()
  if (!granted.analytics) deleteCookies(/^_ga(_|$)/)
  if (!granted.ads) deleteCookies(/^_gcl_/)
  applyConsent(granted)
}

/** Reopens the banner („Ustawienia cookies”). */
export function openCookieSettings() {
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))
}

function sendPageView() {
  if (!configured.analytics || !grantedConsent().analytics || currentPage === null || currentPage === lastPageView) return
  lastPageView = currentPage
  gtag('set', { page_location: currentPage })
  gtag('event', 'page_view', { send_to: GA4_ID, page_location: currentPage, page_title: document.title })
}

/** GA4 page_view for the current route (called on every route change); sent only with analytics consent. */
export function trackPageView() {
  if (!analyticsEnabled()) return
  currentPage = pageLocation()
  sendPageView()
}

export type EventParams = Record<string, string | number | boolean | Record<string, string | number>[]>

/** GA4 event (only GA4 receives it – never an Ads conversion); only with analytics consent, never with personal data. */
export function trackEvent(name: string, params: EventParams = {}) {
  if (!grantedConsent().analytics) return
  ensureTag()
  gtag('event', name, { ...params, send_to: GA4_ID })
}

/** Conversion for Google Ads – only with consent and a configured label; never carries personal data. */
export function trackAdsConversion(kind: AdsConversion, valuePln?: number) {
  if (!grantedConsent().ads || !LABELS[kind]) return
  ensureTag()
  const value = valuePln && valuePln > 0 ? { value: valuePln, currency: 'PLN' } : {}
  gtag('event', 'conversion', { send_to: `${ADS_ID}/${LABELS[kind]}`, ...value })
}
