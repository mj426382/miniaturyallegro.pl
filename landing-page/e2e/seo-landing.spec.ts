import { test, expect } from '@playwright/test'
import { seoPages } from '../src/data/seoPages'

/** Spec 10: keyword landing pages (AC-SEO-007) and the home page head terms (AC-SEO-008). */

function jsonLdTypes(blocks: string[]) {
  return blocks.flatMap((t) => [...t.matchAll(/"@type":"([A-Za-z]+)"/g)].map((m) => m[1]))
}

test('[AC-SEO-007] every landing page has its own SEO head, one keyword H1 and structured data', async ({ page, request }) => {
  expect(seoPages.map((p) => p.path)).toEqual(['/zdjecia-ai-allegro', '/biale-tlo-zdjecie-produktu'])
  const sitemap = await (await request.get('/sitemap.xml')).text()
  const titles = new Set<string>()

  for (const p of seoPages) {
    const html = await (await request.get(p.path)).text()
    // Prerendered: crawlers get the copy without JavaScript.
    expect(html).toContain(p.sections[0].heading)

    await page.goto(p.path)
    const title = await page.title()
    expect(title.length, title).toBeLessThanOrEqual(60)
    expect(titles.has(title), `duplicate title ${title}`).toBe(false)
    titles.add(title)

    const description = (await page.locator('meta[name="description"]').getAttribute('content')) ?? ''
    expect(description.length, description).toBeGreaterThanOrEqual(120)
    expect(description.length, description).toBeLessThanOrEqual(160)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://allgrafika.pl${p.path}`)

    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('h1')).toContainText(p.h1)

    const types = jsonLdTypes(await page.locator('script[type="application/ld+json"]').allTextContents())
    for (const type of ['FAQPage', 'BreadcrumbList']) expect(types).toContain(type)

    expect(sitemap).toContain(`<loc>https://allgrafika.pl${p.path}</loc>`)
    await expect(page.locator('footer').getByRole('link', { name: p.h1 })).toHaveAttribute('href', p.path)

    // The free demo is the conversion point of the page.
    await expect(page.locator('#demo')).toBeVisible()
  }
})

test('[AC-SEO-008] the home title and H1 carry the head terms', async ({ page }) => {
  await page.goto('/')
  const title = await page.title()
  expect(title.length).toBeLessThanOrEqual(60)
  for (const term of ['Grafiki', 'miniatury', 'zdjęcia Allegro']) expect(title).toContain(term)
  await expect(page.locator('h1')).toContainText('Grafiki i miniaturki Allegro')
})
