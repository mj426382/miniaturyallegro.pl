import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Spec 21 + 22: the checkout remembered before Stripe becomes the Ads conversion value and the GA4 purchase. */
async function load(consent: string) {
  vi.resetModules()
  vi.stubEnv('VITE_GA4_ID', 'G-TEST1')
  vi.stubEnv('VITE_GOOGLE_ADS_ID', 'AW-123')
  vi.stubEnv('VITE_GOOGLE_ADS_PURCHASE_LABEL', 'buy')
  document.cookie = `ag_consent=${consent}; path=/`
  const tag = await import('../consent/googleTag')
  tag.initGoogleTag()
  return import('./checkout')
}

const events = () => (window.dataLayer ?? []).map((e) => Array.from(e as ArrayLike<unknown>)).filter((e) => e[0] === 'event')

beforeEach(() => {
  sessionStorage.clear()
  window.dataLayer = []
  document.head.querySelectorAll('script[data-google-tag]').forEach((s) => s.remove())
})

afterEach(() => {
  vi.unstubAllEnvs()
  document.cookie = 'ag_consent=; max-age=0; path=/'
})

describe('GA4 ecommerce in the app (spec 22)', () => {
  it('[AC-GA-009] begin_checkout and then exactly one purchase with transaction id, PLN value and the package – no personal data', async () => {
    const checkout = await load('ads=1&analytics=1&v=2')
    checkout.beginCheckout('pack-50', 4900)
    checkout.reportPurchase()
    expect(checkout.takeCheckout()).toBeNull() // forgotten – a second visit cannot report the same purchase

    const sent = events()
    const begin = sent.find((e) => e[1] === 'begin_checkout')?.[2]
    expect(begin).toEqual({ currency: 'PLN', value: 49, items: [{ item_id: 'pack-50', price: 49, quantity: 1 }], send_to: 'G-TEST1' })
    const purchases = sent.filter((e) => e[1] === 'purchase').map((e) => e[2] as Record<string, unknown>)
    expect(purchases).toHaveLength(1)
    expect(purchases[0]).toMatchObject({ currency: 'PLN', value: 49, items: [{ item_id: 'pack-50', price: 49, quantity: 1 }], send_to: 'G-TEST1' })
    expect(purchases[0].transaction_id).toMatch(/^ag-[\w-]{8,}$/)
    // Google Ads keeps its own conversion – GA4 'purchase' is not sent to Ads, so nothing is counted twice.
    expect(sent.filter((e) => e[1] === 'conversion')).toEqual([['event', 'conversion', { send_to: 'AW-123/buy', value: 49, currency: 'PLN' }]])
    expect(JSON.stringify(sent)).not.toMatch(/@/)
  })

  it('[AC-GA-009] without analytics consent there is no GA4 event, the Ads conversion follows its own consent', async () => {
    const checkout = await load('ads=1&analytics=0&v=2')
    checkout.beginCheckout('plan-pro', 9900)
    checkout.reportPurchase()
    expect(events().map((e) => e[1])).toEqual(['conversion'])
  })

  it('[AC-GA-009] a checkout remembered before the update (price only) still reports the Ads value, but no GA4 purchase', async () => {
    const checkout = await load('ads=1&analytics=1&v=2')
    sessionStorage.setItem('allgrafika:checkout-value', '1900')
    checkout.reportPurchase()
    expect(events()).toEqual([['event', 'conversion', { send_to: 'AW-123/buy', value: 19, currency: 'PLN' }]])
  })
})
