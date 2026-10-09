import { test, expect } from '@playwright/test'

/**
 * Spec 18, AC-MOB-008: the home page announces the mobile apps without touching its SEO head.
 * The expected title is the keyword title from spec 10, AC-SEO-008.
 */
test('[AC-MOB-008] the home page shows the mobile app section and keeps its SEO head', async ({ page, request }) => {
  const html = await (await request.get('/')).text()
  // Prerendered, so crawlers see it without JavaScript.
  expect(html).toContain('Aplikacja mobilna na Androida i iOS jest w drodze')

  await page.goto('/')
  const section = page.locator('#aplikacja-mobilna')
  await section.scrollIntoViewIfNeeded()
  await expect(section.getByRole('heading', { level: 2, name: /Aplikacja mobilna na Androida i iOS/ })).toBeVisible()
  await expect(section.getByRole('link', { name: 'Używaj już teraz w przeglądarce' })).toHaveAttribute('href', 'https://app.allgrafika.pl/register')

  await expect(page).toHaveTitle('Grafiki, miniatury i zdjęcia Allegro z AI | AllGrafika.pl')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://allgrafika.pl/')
  await expect(page.locator('h1')).toHaveCount(1)
  const types = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap((t) => [...t.matchAll(/"@type":"([A-Za-z]+)"/g)].map((m) => m[1]))
  for (const type of ['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage']) expect(types).toContain(type)
  // The announcement is not an app listing: no store badges or store links yet.
  await expect(section.locator('a[href*="apps.apple.com"], a[href*="play.google.com"]')).toHaveCount(0)
})
