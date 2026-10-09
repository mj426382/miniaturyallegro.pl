import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Spec 21: Google Ads consent and conversions. The module reads its env at import, so each test imports it fresh. */
async function loadModule(env: Record<string, string> = { VITE_GOOGLE_ADS_ID: 'AW-123', VITE_GOOGLE_ADS_SIGNUP_LABEL: 'sig', VITE_GOOGLE_ADS_PURCHASE_LABEL: 'buy' }) {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
  return import('./googleAds')
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

beforeEach(() => {
  clearCookies()
  window.dataLayer = []
  document.head.querySelectorAll('script[data-google-ads]').forEach((s) => s.remove())
  delete window.Capacitor
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Google Ads consent (spec 21)', () => {
  it('[AC-ADS-006] without an Ads ID there is no banner, no tag and no conversion', async () => {
    const ads = await loadModule({ VITE_GOOGLE_ADS_ID: '' })
    expect(ads.ADS_CONFIGURED).toBe(false)
    expect(ads.needsDecision()).toBe(false)
    ads.setAdsConsent(true)
    ads.trackAdsConversion('signup')
    expect(document.cookie).not.toContain('ag_consent')
    expect(layer()).toEqual([])
    expect(document.querySelector('script[data-google-ads]')).toBeNull()
  })

  it('[AC-ADS-001] asks for a decision and loads nothing from Google before it', async () => {
    const ads = await loadModule()
    ads.initGoogleAds()
    expect(ads.needsDecision()).toBe(true)
    expect(layer()).toEqual([])
    expect(document.querySelector('script[data-google-ads]')).toBeNull()
  })

  it('[AC-ADS-003] consent loads the tag with Consent Mode v2: default denied, then update granted', async () => {
    const ads = await loadModule()
    ads.setAdsConsent(true)
    expect(document.cookie).toContain('ag_consent=ads=1')
    expect(ads.needsDecision()).toBe(false)
    const entries = layer()
    expect(entries[0]).toEqual(['consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }])
    expect(entries[1]).toEqual(['consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'denied' }])
    expect(entries).toContainEqual(['config', 'AW-123'])
    expect(document.querySelector<HTMLScriptElement>('script[data-google-ads]')?.src).toBe('https://www.googletagmanager.com/gtag/js?id=AW-123')
  })

  it('[AC-ADS-002] refusing stores the decision and never loads the tag, also on the next visit', async () => {
    let ads = await loadModule()
    ads.setAdsConsent(false)
    expect(document.cookie).toContain('ag_consent=ads=0')
    ads = await loadModule()
    ads.initGoogleAds()
    expect(ads.needsDecision()).toBe(false)
    expect(layer()).toEqual([])
    expect(document.querySelector('script[data-google-ads]')).toBeNull()
  })

  it('[AC-ADS-004] withdrawing consent updates Consent Mode to denied and deletes the _gcl_ cookies', async () => {
    const ads = await loadModule()
    ads.setAdsConsent(true)
    document.cookie = '_gcl_aw=GCL.1.abc; path=/'
    document.cookie = '_gcl_au=1.1.xyz; path=/'
    ads.setAdsConsent(false)
    expect(document.cookie).toContain('ag_consent=ads=0')
    expect(document.cookie).not.toContain('_gcl_')
    expect(layer().slice(-1)[0]).toEqual(['consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }])
  })

  it('[AC-ADS-005] reports sign-up and purchase conversions only with consent, with a PLN value and no personal data', async () => {
    const ads = await loadModule()
    ads.trackAdsConversion('signup')
    expect(layer()).toEqual([]) // no consent yet

    ads.setAdsConsent(true)
    ads.trackAdsConversion('signup')
    ads.trackAdsConversion('purchase', 99)
    const conversions = layer().filter((e) => e[0] === 'event')
    expect(conversions).toEqual([
      ['event', 'conversion', { send_to: 'AW-123/sig' }],
      ['event', 'conversion', { send_to: 'AW-123/buy', value: 99, currency: 'PLN' }],
    ])
    expect(JSON.stringify(conversions)).not.toMatch(/@/)
  })

  it('[AC-ADS-005] sends nothing without a label or inside the Android/iOS app', async () => {
    let ads = await loadModule({ VITE_GOOGLE_ADS_ID: 'AW-123', VITE_GOOGLE_ADS_SIGNUP_LABEL: '', VITE_GOOGLE_ADS_PURCHASE_LABEL: '' })
    ads.setAdsConsent(true)
    ads.trackAdsConversion('signup')
    expect(layer().filter((e) => e[0] === 'event')).toEqual([])

    window.Capacitor = { isNativePlatform: () => true }
    window.dataLayer = []
    ads = await loadModule()
    expect(ads.adsEnabled()).toBe(false)
    ads.trackAdsConversion('purchase', 10)
    expect(layer()).toEqual([])
  })
})
