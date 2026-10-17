import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { test, expect, type APIRequestContext } from '@playwright/test'
import { blogIndex } from '../src/data/blogIndex'
import { plans } from '../src/data/pricing'
import { seoPages } from '../src/data/seoPages'

/**
 * Spec 10 (changes of 2026-10-18): subscription prices on the site and in JSON-LD (AC-SEO-022) and the legal texts
 * – deletion tombstone, EXIF removal, AI marker, upload limits with their effective date, new prices, change notes,
 * „masowe przesyłanie” wording and identical copies in the app (AC-SEO-023). Prerendered HTML is device-independent.
 */
const HERE = dirname(fileURLToPath(import.meta.url))

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop-chrome', 'prerendered HTML is device-independent')
})

/** Visible text of a prerendered page: no tags, no React text separators, entities decoded, spaces collapsed. */
async function pageText(request: APIRequestContext, route: string) {
  const html = await (await request.get(route)).text()
  const body = html.replace(/<!-- -->/g, '').replace(/<script[\s\S]*?<\/script>/g, ' ')
  return body
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ')
}

function jsonLd(html: string): Array<Record<string, any>> {
  return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]))
}

test('[AC-SEO-022] the home page, its FAQ and JSON-LD show Start 19 zł / 40 grafik and Pro 59 zł / 150 grafik', async ({ request }) => {
  expect(plans.map((p) => ({ name: p.name, credits: p.credits, price: p.price }))).toEqual([
    { name: 'Start', credits: 40, price: 19 },
    { name: 'Pro', credits: 150, price: 59 },
  ])
  const text = await pageText(request, '/')
  expect(text).toMatch(/Plan Start 19 zł \/ miesiąc · 40 grafik 0,48 zł \/ grafikę/)
  expect(text).toMatch(/Plan Pro 59 zł \/ miesiąc · 150 grafik 0,39 zł \/ grafikę/)
  expect(text).toContain('abonament od 0,39 zł za grafikę')
  expect(text).toContain('Najtaniej bez abonamentu')
  expect(text).not.toContain('Najniższa cena za grafikę')

  const html = (await (await request.get('/')).text()).replace(/<!-- -->/g, '')
  const app = jsonLd(html).find((b) => b['@type'] === 'SoftwareApplication')!
  const subscriptions = app.offers.offers.filter((o: any) => o.priceSpecification?.billingDuration === 'P1M')
  expect(subscriptions.map((o: any) => [o.description, o.price, o.priceSpecification.price])).toEqual([
    ['Abonament Start – 40 grafik miesięcznie', '19', '19'],
    ['Abonament Pro – 150 grafik miesięcznie', '59', '59'],
  ])
  const faq = jsonLd(html).find((b) => b['@type'] === 'FAQPage')!
  const priceAnswer = faq.mainEntity.find((q: any) => q.name === 'Ile to kosztuje?').acceptedAnswer.text
  expect(priceAnswer).toContain('abonament od 0,39 zł za grafikę')
})

test('[AC-SEO-022] no page mentions the old subscription prices (49 zł, 149 zł)', async ({ request }) => {
  for (const route of ['/', ...seoPages.map((p) => p.path), ...blogIndex.map((p) => `/blog/${p.slug}`)]) {
    const html = (await (await request.get(route)).text()).replace(/<!-- -->/g, '')
    expect(html, route).not.toMatch(/(?<![\d,])(49|149) zł ?\/ ?(mies|miesiąc)/)
    expect(html, route).not.toMatch(/"price":"(49|149)"/)
    expect(html, route).not.toMatch(/(1,23|0,99) zł ?\/ ?grafik/)
  }
  const pricePage = await pageText(request, '/biale-tlo-zdjecie-produktu')
  expect(pricePage).toContain('a w abonamencie Pro 0,39 zł')
})

test('[AC-SEO-023] the privacy policy describes the e-mail hash after deletion, EXIF removal, the AI marker and the upload limits', async ({ request }) => {
  const text = await pageText(request, '/polityka-prywatnosci')
  expect(text).toContain('ostatnia zmiana: 18 października 2026 r.')

  // Tombstone: the exact sentence agreed with the backend (HMAC + deletion date, no address, art. 6(1)(f), 12 months).
  expect(text).toContain('4. Usunięcie konta – skrót adresu e-mail')
  expect(text).toContain(
    'Po usunięciu konta przechowujemy wyłącznie skrót kryptograficzny (HMAC) adresu e-mail tego konta wraz z datą usunięcia – bez samego adresu – w celu zapobiegania nadużyciom darmowej puli grafik i programu poleceń (ponowna rejestracja tego samego adresu nie otrzymuje ponownie darmowych grafik ani nagród za polecenie); podstawą prawną jest nasz prawnie uzasadniony interes (art. 6 ust. 1 lit. f RODO), a skrót usuwamy po 12 miesiącach od usunięcia konta.',
  )
  expect(text).toContain('Dotyczy kont usuniętych od 1 listopada 2026 r.')
  expect(text).toContain('Nie zachowujemy imienia, plików, historii korzystania ani innych danych konta.')
  expect(text).toMatch(
    /Zapobieganie ponownemu wykorzystaniu darmowej puli kredytów i nagród za polecenia po usunięciu konta – przechowujemy wyłącznie skrót \(HMAC\) adresu e-mail z datą usunięcia, bez samego adresu .* art\. 6 ust\. 1 lit\. f RODO .* 12 miesięcy od usunięcia konta/,
  )

  // Photo metadata (exact backend sentence) and the AI marker.
  expect(text).toContain('5. Metadane zdjęć i oznaczenie grafik AI')
  expect(text.match(/Z przesłanych zdjęć usuwamy metadane \(EXIF, w tym lokalizację GPS\)\./g)).toHaveLength(2)
  expect(text).toContain('zawierają w metadanych IPTC/XMP informację, że powstały z użyciem sztucznej inteligencji (pole DigitalSourceType)')

  // Upload limits and the dated change note (limits 14 days after publication).
  expect(text).toContain('do 5 zdjęć łącznie przed potwierdzeniem adresu e-mail i do 200 zdjęć w ciągu 24 godzin po jego potwierdzeniu (od 1 listopada 2026 r.)')
  expect(text).toContain('Zmiana z 18 października 2026 r. (data publikacji)')
  expect(text).toContain('te zmiany obowiązują od 1 listopada 2026 r., czyli 14 dni po publikacji')
  expect(text).toContain('10. Zmiany polityki prywatności')
})

test('[AC-SEO-023] the terms state the upload limits with their effective date, the new prices and the change notes', async ({ request }) => {
  const text = await pageText(request, '/regulamin')
  expect(text).toContain(
    'Limity przesyłania. Od 1 listopada 2026 r. Konto z niepotwierdzonym adresem e-mail może przesłać łącznie najwyżej 5 zdjęć, a Konto z potwierdzonym adresem e-mail – najwyżej 200 zdjęć w ciągu ostatnich 24 godzin.',
  )
  expect(text).toContain('Plany od 18 października 2026 r.: Start – 19 zł / mies. za 40 Kredytów oraz Pro – 59 zł / mies. za 150 Kredytów (ceny brutto).')
  expect(text).toContain('przechowuje przez 12 miesięcy wyłącznie skrót adresu e-mail utworzony z użyciem tajnego klucza (HMAC) wraz z datą usunięcia')
  // § 2 ust. 4 promise: changes that limit users take effect 14 days after publication, the price cut at once.
  expect(text).toContain('co najmniej 14 dni przed ich wejściem w życie')
  expect(text).toContain(
    'Zmiana z 18 października 2026 r. (data publikacji): (a) obniżono ceny abonamentów – Start: 19 zł / mies. za 40 Kredytów (wcześniej 49 zł), Pro: 59 zł / mies. za 150 Kredytów (wcześniej 149 zł) – obniżka obowiązuje od dnia publikacji',
  )
  expect(text).toContain('zgodnie z § 2 ust. 4 postanowienia te obowiązują od 1 listopada 2026 r., czyli 14 dni po publikacji')
  expect(text).toContain('Zmiana z 17 października 2026 r.')
  expect(text).toContain('Zasady odstąpienia od umowy zakupu Kredytów i abonamentu określa § 4 ust. 9 i 11.')
})

test('[AC-SEO-023] bulk uploads are called „masowe przesyłanie” and both legal copies are identical in the app', async ({ request }) => {
  for (const route of ['/regulamin', '/polityka-prywatnosci']) {
    const text = await pageText(request, route)
    expect(text, route).not.toMatch(/paczk[aię] zdjęć/i)
    expect(text, route).toContain('masowego przesyłania zdjęć')
  }
  for (const file of ['RegulaminContent.tsx', 'PolitykaContent.tsx', 'entity.ts']) {
    const site = readFileSync(resolve(HERE, '../src/legal', file), 'utf-8')
    const app = readFileSync(resolve(HERE, '../../frontend/src/legal', file), 'utf-8')
    expect(app, `frontend/src/legal/${file} differs – run node frontend/scripts/sync-legal.js`).toBe(site)
  }
})
