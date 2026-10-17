/**
 * Prices shown on the landing page and in its JSON-LD (spec 02, spec 10 AC-SEO-016).
 * Mirrors backend/src/payments/plans.ts – the Playwright test e2e/seo-structure.spec.ts (AC-SEO-016) fails when they drift.
 * Prices are gross (brutto) PLN.
 */
export const FREE_GRAPHICS = 5

export interface PricePackage {
  name: string
  credits: number
  price: number
  saving: string | null
  highlighted?: boolean
}

export interface PricePlan {
  name: string
  credits: number
  price: number
  desc: string
  highlighted?: boolean
}

export const packages: PricePackage[] = [
  { name: 'Pakiet Startowy', credits: 5, price: 10, saving: null },
  { name: 'Pakiet Popularny', credits: 15, price: 28, saving: 'Oszczędzasz 2 zł vs. pakiet 5', highlighted: true },
  { name: 'Pakiet Pro', credits: 40, price: 70, saving: 'Oszczędzasz 10 zł vs. pakiet 5' },
  // Spec 10, AC-SEO-022: the Pro plan (0,39 zł) is cheaper per graphic – this is the cheapest without a subscription.
  { name: 'Pakiet Biznes', credits: 200, price: 99, saving: 'Najtaniej bez abonamentu' },
]

/** Owner decision 2026-10-18 (spec 10): Start 19 zł / 40 grafik (0,48 zł), Pro 59 zł / 150 grafik (0,39 zł). */
export const plans: PricePlan[] = [
  { name: 'Start', credits: 40, price: 19, desc: 'Dla sklepów dodających kilka produktów tygodniowo.' },
  { name: 'Pro', credits: 150, price: 59, desc: 'Dla sklepów z setkami SKU i masowym przesyłaniem zdjęć.', highlighted: true },
]

/** "1,87 zł" – price per graphic, Polish decimal comma. */
export function perCredit(price: number, credits: number): string {
  return `${(Math.round((price * 100) / credits) / 100).toFixed(2).replace('.', ',')} zł`
}

const allPrices = [...packages.map((p) => p.price), ...plans.map((p) => p.price)]
export const HIGHEST_PRICE = Math.max(...allPrices)
