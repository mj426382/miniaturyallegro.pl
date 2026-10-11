/**
 * `<title>` rule (spec 10, AC-SEO-009): Google cuts titles at roughly 60 characters, so the brand
 * suffix is appended only when the whole title still fits; otherwise the bare title is used.
 */
export const BRAND_SUFFIX = ' | AllGrafika.pl'
export const MAX_TITLE_LENGTH = 60

export function pageTitle(title: string): string {
  const branded = `${title}${BRAND_SUFFIX}`
  return branded.length <= MAX_TITLE_LENGTH ? branded : title
}
