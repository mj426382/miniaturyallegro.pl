import { APP_URL } from './site'

/**
 * Spec 25: metadata of the free photo checker tool – the only part of the tool in the shared bundle (route, footer,
 * home page and landing links). The page and the analysis code are a lazy chunk (src/data/photoCheckerLoader.ts).
 * scripts/prerender.js, generate-sitemap.js and generate-og-image.js read PHOTO_CHECKER_PATH / PHOTO_CHECKER_UPDATED
 * with a regex – keep them plain single-quoted literals.
 */
export const PHOTO_CHECKER_PATH = '/narzedzia/sprawdz-zdjecie-produktu'

/** Sitemap <lastmod> and "Aktualizacja" of the page – bump it when the copy or the requirement table changes. */
export const PHOTO_CHECKER_UPDATED = '2026-10-19'

export const PHOTO_CHECKER_LABEL = 'Sprawdź zdjęcie produktu'
export const PHOTO_CHECKER_OG_IMAGE = '/og/sprawdz-zdjecie-produktu.png'

/** Landing pages that link the tool (AC-TOOL-007). */
export const PHOTO_CHECKER_LINKED_FROM = [
  '/zdjecia-produktowe-olx',
  '/zdjecia-produktowe-vinted',
  '/zdjecia-produktowe-ebay',
  '/zdjecia-produktowe-amazon',
  '/zdjecia-produktowe-do-sklepu-internetowego',
  '/biale-tlo-zdjecie-produktu',
]

/** "Popraw zdjęcie w AllGrafika" – registration with the tool's UTM (spec 25). */
export const PHOTO_CHECKER_CTA_URL = `${APP_URL}/register?utm_source=landing&utm_medium=tool&utm_content=photo-checker`
