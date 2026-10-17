/**
 * Site-wide constants shared by pages, structured data and the build scripts (spec 10).
 * scripts/generate-sitemap.js reads HOME_UPDATED with a regex – keep it a plain 'YYYY-MM-DD' literal.
 */
export const SITE_URL = 'https://allgrafika.pl'
export const APP_URL = 'https://app.allgrafika.pl'
export const SITE_NAME = 'AllGrafika.pl'

/** Sitemap <lastmod> of the home page (AC-SEO-018) – bump it when the home page copy changes, never per build. */
export const HOME_UPDATED = '2026-10-17'

/** Stable @id values that link the JSON-LD entities across pages (AC-SEO-015). */
export const ORG_ID = `${SITE_URL}/#organization`
export const WEBSITE_ID = `${SITE_URL}/#website`
export const SOFTWARE_ID = `${SITE_URL}/#software`

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`
export const OG_IMAGE_WIDTH = '1200'
export const OG_IMAGE_HEIGHT = '630'

/** "17 października 2026" – deterministic on the server and in the browser (no Intl differences between them). */
const MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']
export function formatPlDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}
