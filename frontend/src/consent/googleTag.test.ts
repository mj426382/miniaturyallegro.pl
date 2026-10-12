import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Spec 21 (Google Ads) + spec 22 (Google Analytics 4): one Google tag behind consent per category.
 * The module reads its env at import, so each test imports it fresh.
 */
const ENV = { VITE_GA4_ID: 'G-TEST1', VITE_GOOGLE_ADS_ID: 'AW-123', VITE_GOOGLE_ADS_SIGNUP_LABEL: 'sig', VITE_GOOGLE_ADS_PURCHASE_LABEL: 'buy' }
const ALL_DENIED = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }
const ADS_ONLY = { ...ALL_DENIED, ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' }
const ALL_GRANTED = { ...ADS_ONLY, analytics_storage: 'granted' }

async function loadModule(env: Record<string, string> = ENV) {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
  return import('./googleTag')
}

function clearCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim()
    if (name) document.cookie = `${name}=; max-age=0; path=/`
  }
}

/** dataLayer entries are `arguments` objects – turn them into arrays. */
function layer(): unknown[][] {
  return (window.dataLayer ?? []).map((e) => Array.from(e as ArrayLike<unknown>))
}
const events = (name?: string) => layer().filter((e) => e[0] === 'event' && (!name || e[1] === name))
const tags = () => document.querySelectorAll<HTMLScriptElement>('script[data-google-tag]')

beforeEach(() => {
  clearCookies()
  window.dataLayer = []
  tags().forEach((s) => s.remove())
  delete window.Capacitor
  delete window['ga-disable-G-TEST1']
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Google Ads consent (spec 21)', () => {
  it('[AC-ADS-006] without any Google ID there is no banner, no tag and no conversion', async () => {
    const tag = await loadModule({ VITE_GA4_ID: 'off', VITE_GOOGLE_ADS_ID: '' })
    expect(tag.CONSENT_CONFIGURED).toBe(false)
    expect(tag.needsDecision()).toBe(false)
    tag.setConsent({ analytics: true, ads: true })
    tag.trackAdsConversion('signup')
    tag.trackEvent('sign_up', { method: 'email' })
    expect(document.cookie).not.toContain('ag_consent')
    expect(layer()).toEqual([])
    expect(tags()).toHaveLength(0)
  })

  it('[AC-ADS-001] asks for a decision and loads nothing from Google before it', async () => {
    const tag = await loadModule()
    tag.initGoogleTag()
    tag.trackPageView()
    expect(tag.needsDecision()).toBe(true)
    expect(layer()).toEqual([])
    expect(tags()).toHaveLength(0)
  })

  it('[AC-ADS-003] Ads consent loads the tag with Consent Mode v2: default denied, then update granted', async () => {
    const tag = await loadModule()
    tag.setConsent({ analytics: false, ads: true })
    expect(document.cookie).toContain('ag_consent=ads=1&analytics=0&v=2')
    expect(tag.needsDecision()).toBe(false)
    const entries = layer()
    expect(entries[0]).toEqual(['consent', 'default', ALL_DENIED])
    expect(entries[1]).toEqual(['consent', 'update', ADS_ONLY])
    expect(entries).toContainEqual(['config', 'AW-123'])
    expect(entries.some((e) => e[0] === 'config' && e[1] === 'G-TEST1')).toBe(false)
    expect(tags()[0]?.src).toBe('https://www.googletagmanager.com/gtag/js?id=AW-123')
  })

  it('[AC-ADS-002] refusing stores the decision and never loads the tag, also on the next visit', async () => {
    let tag = await loadModule()
    tag.setConsent({ analytics: false, ads: false })
    expect(document.cookie).toContain('ag_consent=ads=0&analytics=0&v=2')
    tag = await loadModule()
    tag.initGoogleTag()
    expect(tag.needsDecision()).toBe(false)
    expect(layer()).toEqual([])
    expect(tags()).toHaveLength(0)
  })

  it('[AC-ADS-004] withdrawing consent updates Consent Mode to denied and deletes the _gcl_ cookies', async () => {
    const tag = await loadModule()
    tag.setConsent({ analytics: false, ads: true })
    document.cookie = '_gcl_aw=GCL.1.abc; path=/'
    document.cookie = '_gcl_au=1.1.xyz; path=/'
    tag.setConsent({ analytics: false, ads: false })
    expect(document.cookie).toContain('ag_consent=ads=0&analytics=0&v=2')
    expect(document.cookie).not.toContain('_gcl_')
    expect(layer().slice(-1)[0]).toEqual(['consent', 'update', ALL_DENIED])
  })

  it('[AC-ADS-005] reports sign-up and purchase conversions only with consent, with a PLN value and no personal data', async () => {
    const tag = await loadModule()
    tag.trackAdsConversion('signup')
    expect(layer()).toEqual([]) // no consent yet

    tag.setConsent({ analytics: false, ads: true })
    tag.trackAdsConversion('signup')
    tag.trackAdsConversion('purchase', 99)
    expect(events()).toEqual([
      ['event', 'conversion', { send_to: 'AW-123/sig' }],
      ['event', 'conversion', { send_to: 'AW-123/buy', value: 99, currency: 'PLN' }],
    ])
    expect(JSON.stringify(events())).not.toMatch(/@/)
  })

  it('[AC-ADS-005] sends nothing without a label or inside the Android/iOS app', async () => {
    let tag = await loadModule({ ...ENV, VITE_GOOGLE_ADS_SIGNUP_LABEL: '', VITE_GOOGLE_ADS_PURCHASE_LABEL: '' })
    tag.setConsent({ analytics: true, ads: true })
    tag.trackAdsConversion('signup')
    expect(events('conversion')).toEqual([])

    window.Capacitor = { isNativePlatform: () => true }
    window.dataLayer = []
    tag = await loadModule()
    expect(tag.adsEnabled()).toBe(false)
    expect(tag.analyticsEnabled()).toBe(false)
    tag.initGoogleTag()
    tag.trackAdsConversion('purchase', 10)
    tag.trackEvent('purchase', { value: 10 })
    expect(layer()).toEqual([])
  })
})

describe('Google Analytics 4 consent (spec 22)', () => {
  it('[AC-GA-001] GA4 is on by default with the allgrafika.pl measurement id and needs a decision', async () => {
    const tag = await loadModule({})
    expect(tag.GA4_ID).toBe('G-C3NE5EW4ED')
    expect(tag.ADS_CONFIGURED).toBe(false)
    expect(tag.needsDecision()).toBe(true)
  })

  it('[AC-GA-003] analytics-only consent: GA4 configured without its own page views, Ads denied and not configured', async () => {
    const tag = await loadModule()
    tag.setConsent({ analytics: true, ads: false })
    expect(document.cookie).toContain('ag_consent=ads=0&analytics=1&v=2')
    const entries = layer()
    expect(entries[0]).toEqual(['consent', 'default', ALL_DENIED])
    expect(entries[1]).toEqual(['consent', 'update', { ...ALL_DENIED, analytics_storage: 'granted' }])
    expect(entries).toContainEqual(['set', 'ads_data_redaction', true])
    expect(entries).toContainEqual(['config', 'G-TEST1', { send_page_view: false, cookie_expires: 400 * 24 * 60 * 60 }])
    expect(entries.some((e) => e[0] === 'config' && e[1] === 'AW-123')).toBe(false)
    expect(tags()).toHaveLength(1)
    expect(tags()[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-TEST1')
    expect(window['ga-disable-G-TEST1']).toBe(false)
  })

  it('[AC-GA-004] full consent: one gtag.js, both products configured, granting a second category later does not load it again', async () => {
    const tag = await loadModule()
    tag.setConsent({ analytics: false, ads: true })
    tag.setConsent({ analytics: true, ads: true })
    expect(tags()).toHaveLength(1)
    expect(
      layer()
        .filter((e) => e[0] === 'config')
        .map((e) => e[1]),
    ).toEqual(['AW-123', 'G-TEST1'])
    expect(
      layer()
        .filter((e) => e[0] === 'consent')
        .slice(-1)[0],
    ).toEqual(['consent', 'update', ALL_GRANTED])
  })

  it('[AC-GA-005] a v1 decision "ads=1" keeps Ads granted and asks again only about analytics', async () => {
    document.cookie = 'ag_consent=ads=1; path=/'
    const tag = await loadModule()
    expect(tag.readConsent()).toEqual({ ads: true, analytics: null })
    expect(tag.needsDecision()).toBe(true)
    tag.initGoogleTag()
    expect(layer()[1]).toEqual(['consent', 'update', ADS_ONLY])
    expect(layer()).toContainEqual(['config', 'AW-123'])
  })

  it('[AC-GA-005] a v1 decision "ads=0" loads nothing and asks again', async () => {
    document.cookie = 'ag_consent=ads=0; path=/'
    const tag = await loadModule()
    expect(tag.readConsent()).toEqual({ ads: false, analytics: null })
    expect(tag.needsDecision()).toBe(true)
    tag.initGoogleTag()
    expect(layer()).toEqual([])
  })

  it('[AC-GA-005] a site without Ads keeps the Ads decision made on the other domain', async () => {
    document.cookie = 'ag_consent=ads=1; path=/'
    const tag = await loadModule({ VITE_GA4_ID: 'G-TEST1', VITE_GOOGLE_ADS_ID: '' })
    tag.setConsent({ analytics: true, ads: false })
    expect(document.cookie).toContain('ag_consent=ads=1&analytics=1&v=2')
  })

  it('[AC-GA-006] page_view only with analytics consent, once per page, with a URL stripped of tokens and personal data', async () => {
    window.history.replaceState(null, '', '/reset-password?token=secret-token&utm_source=newsletter&gclid=g1&email=jan%40example.com#top')
    const tag = await loadModule()
    tag.trackPageView()
    expect(layer()).toEqual([])

    tag.setConsent({ analytics: true, ads: false })
    tag.trackPageView()
    window.history.replaceState(null, '', '/credits?success=1')
    tag.trackPageView()
    const views = events('page_view').map((e) => e[2] as Record<string, string>)
    const origin = window.location.origin
    expect(views.map((v) => v.page_location)).toEqual([`${origin}/reset-password?utm_source=newsletter&gclid=g1`, `${origin}/credits`])
    expect(views.every((v) => v.send_to === 'G-TEST1')).toBe(true)
    expect(JSON.stringify(layer())).not.toMatch(/secret-token|example\.com|success/)
  })

  it('[AC-GA-007] GA4 events go only to GA4 and only with analytics consent', async () => {
    const tag = await loadModule()
    tag.setConsent({ analytics: false, ads: true })
    tag.trackEvent('sign_up', { method: 'email' })
    expect(events('sign_up')).toEqual([])

    tag.setConsent({ analytics: true, ads: true })
    tag.trackEvent('sign_up', { method: 'google' })
    expect(events('sign_up')).toEqual([['event', 'sign_up', { method: 'google', send_to: 'G-TEST1' }]])
  })

  it('[AC-GA-008] withdrawing analytics disables GA4, deletes _ga cookies and keeps Ads', async () => {
    const tag = await loadModule()
    tag.setConsent({ analytics: true, ads: true })
    document.cookie = '_ga=GA1.1.1.1; path=/'
    document.cookie = '_ga_TEST1=GS1.1.1; path=/'
    document.cookie = '_gcl_au=1.1.xyz; path=/'
    tag.setConsent({ analytics: false, ads: true })
    expect(document.cookie).not.toMatch(/_ga(_|=)/)
    expect(document.cookie).toContain('_gcl_au')
    expect(window['ga-disable-G-TEST1']).toBe(true)
    expect(layer().slice(-1)[0]).toEqual(['consent', 'update', ADS_ONLY])
    tag.trackEvent('purchase', { value: 1 })
    expect(events('purchase')).toEqual([])
  })
})
