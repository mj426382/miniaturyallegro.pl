/**
 * Spec 24 / spec 10 (AC-SEO-027): the numbers of the partner programme shown on /program-partnerski. They equal the
 * backend defaults in backend/src/partners/commission.ts (PARTNER_DEFAULTS, MIN_PAYOUT_GROSZE) – a test keeps them in step.
 * scripts/generate-sitemap.js reads PARTNER_PAGE_UPDATED with a regex – keep it a plain 'YYYY-MM-DD' literal.
 */
export const PARTNER_PAGE_PATH = '/program-partnerski'

/** Sitemap <lastmod> and "Aktualizacja" of the page – bump it when the copy changes. */
export const PARTNER_PAGE_UPDATED = '2026-10-19'

export const PARTNER_PROGRAM = {
  customerDiscountPercent: 10,
  commissionPercent: 20,
  commissionMonths: 12,
  minPayoutZl: 50,
  contactEmail: 'kontakt@allgrafika.pl',
} as const

export const PARTNER_OG_IMAGE = '/og/program-partnerski.png'
