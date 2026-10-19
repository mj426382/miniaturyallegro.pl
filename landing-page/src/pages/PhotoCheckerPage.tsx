import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import PageHead from '../components/PageHead'
import { blogIndex } from '../data/blogIndex'
import { seoPages } from '../data/seoPages'
import { ORG_ID, SITE_URL, WEBSITE_ID, formatPlDate } from '../data/site'
import { PHOTO_CHECKER_CTA_URL, PHOTO_CHECKER_LABEL, PHOTO_CHECKER_LINKED_FROM, PHOTO_CHECKER_OG_IMAGE, PHOTO_CHECKER_PATH, PHOTO_CHECKER_UPDATED } from '../data/photoChecker'
import { trackCta } from '../services/analytics'
import { pageTitle } from '../utils/pageTitle'
import { FREE_GRAPHICS } from '../data/pricing'
import PhotoChecker from '../tools/photoCheck/PhotoChecker'
import { CHECKED_AT, NO_OFFICIAL_VALUE, PLATFORMS, heicSupport, sourceOf } from '../tools/photoCheck/requirements'

const TITLE = pageTitle('Sprawdź zdjęcie produktu – darmowe narzędzie')
const H1 = 'Sprawdź zdjęcie produktu'
const H1_ACCENT = 'za darmo, bez wysyłania pliku'
const DESCRIPTION = 'Darmowe narzędzie: sprawdź format, wymiary, wagę i białe tło zdjęcia produktu pod OLX, Vinted, eBay, Amazon i sklep. Działa w przeglądarce, bez wysyłki.'
const PAGE_URL = `${SITE_URL}${PHOTO_CHECKER_PATH}`
const EMBED_SNIPPET = `<a href="${PAGE_URL}">Sprawdź zdjęcie produktu – darmowe narzędzie AllGrafika.pl</a>`
const CHECKED = formatPlDate(CHECKED_AT)

const RELATED_POSTS = [
  'wymiary-zdjec-olx-vinted-ebay-amazon',
  'zdjecie-glowne-oferty-wymagania-platform',
  'jpg-vs-webp-vs-png-format-zdjec-produktowych',
  'jaki-rozmiar-zdjecia-do-sklepu-internetowego',
  'zdjecia-produktow-telefonem-poradnik',
]

const heic = heicSupport()

const FAQ = [
  {
    q: 'Czy moje zdjęcie jest gdzieś wysyłane?',
    a: 'Nie. Narzędzie działa w całości w Twojej przeglądarce: plik jest odczytywany i analizowany na Twoim urządzeniu, a ani zdjęcie, ani wynik nie trafiają na nasz serwer ani do nikogo innego. Po wczytaniu strony możesz nawet wyłączyć internet – sprawdzanie nadal działa.',
  },
  {
    q: 'Skąd biorą się wymagania platform?',
    a: `Tylko z oficjalnych stron pomocy i dokumentacji platform – przy każdej wartości jest link do źródła i data sprawdzenia (${CHECKED}). Gdy platforma nie publikuje danej wartości, piszemy „${NO_OFFICIAL_VALUE}” i tego punktu nie oceniamy. Platformy zmieniają zasady, więc przed publikacją zajrzyj do źródła.`,
  },
  {
    q: 'Dlaczego zdjęcie HEIC z iPhone’a dostaje ostrzeżenie?',
    a: `Według dokumentacji format HEIC nie jest na liście formatów: ${heic.rejected.join(', ')}. Przyjmują go: ${heic.accepted.join(', ')}. Najprościej zapisać zdjęcie jako JPEG – w iPhonie: Ustawienia → Aparat → Formaty → „Najbardziej zgodne”.`,
  },
  {
    q: 'Jak dokładne jest sprawdzanie białego tła?',
    a: 'To szacunek. Narzędzie liczy, ile pikseli w wąskim pasie przy krawędziach zdjęcia jest czystą bielą (z tolerancją na kompresję JPEG). Nie rozpoznaje produktu, nie mierzy, ile kadru zajmuje, i nie sprawdza cieni – ostateczną ocenę zdjęcia głównego robi platforma.',
  },
  {
    q: 'Czy narzędzie sprawdzi napisy, ramki i znaki wodne?',
    a: 'Nie. Sprawdza parametry pliku: format, wymiary, proporcje, wagę, przezroczystość i szacunek tła. Zasady dotyczące treści zdjęcia (np. zakaz napisów i znaków wodnych) wypisujemy w tabeli wymagań przy każdej platformie.',
  },
  {
    q: 'Czy mogę podlinkować to narzędzie na swojej stronie?',
    a: 'Tak, zachęcamy. Skopiuj gotowy link z sekcji „Jak umieścić to narzędzie u siebie” – narzędzie jest darmowe i nie wymaga konta.',
  },
]

function structuredData() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      '@id': `${PAGE_URL}#app`,
      name: PHOTO_CHECKER_LABEL,
      description: DESCRIPTION,
      url: PAGE_URL,
      inLanguage: 'pl-PL',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Dowolny (przeglądarka internetowa)',
      browserRequirements: 'Wymaga JavaScript. Zdjęcia są analizowane lokalnie w przeglądarce.',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' },
      dateModified: PHOTO_CHECKER_UPDATED,
      isPartOf: { '@id': WEBSITE_ID },
      publisher: { '@id': ORG_ID },
      image: `${SITE_URL}${PHOTO_CHECKER_OG_IMAGE}`,
      citation: [...new Set(PLATFORMS.flatMap((p) => p.sources.map((s) => s.url)))],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'AllGrafika.pl', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: PHOTO_CHECKER_LABEL, item: PAGE_URL },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ]
}

function EmbedSnippet() {
  const [copied, setCopied] = useState('')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(EMBED_SNIPPET)
      setCopied('Skopiowano link do schowka.')
    } catch {
      setCopied('Nie udało się skopiować – zaznacz kod i skopiuj go ręcznie.')
    }
  }
  return (
    <div>
      <pre className="whitespace-pre-wrap break-all rounded-xl bg-gray-900 p-4 text-sm text-gray-100" data-testid="embed-snippet">
        <code>{EMBED_SNIPPET}</code>
      </pre>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Kopiuj link
        </button>
        <span role="status" className="text-sm text-gray-700">
          {copied}
        </span>
      </div>
    </div>
  )
}

/** Spec 25: the free photo checker – a lazy chunk (src/data/photoCheckerLoader.ts), prerendered with all explanatory copy. */
export default function PhotoCheckerPage() {
  const landings = PHOTO_CHECKER_LINKED_FROM.map((p) => seoPages.find((s) => s.path === p)).filter((p) => p !== undefined)
  const posts = RELATED_POSTS.map((s) => blogIndex.find((p) => p.slug === s)).filter((p) => p !== undefined)

  return (
    <>
      <PageHead title={TITLE} description={DESCRIPTION} path={PHOTO_CHECKER_PATH} image={PHOTO_CHECKER_OG_IMAGE} imageAlt={`${H1} – ${H1_ACCENT}`} jsonLd={structuredData()} />

      <div className="min-h-screen bg-white">
        <Navbar />

        <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-14 text-center">
            <nav aria-label="Ścieżka" className="text-sm text-blue-100 mb-4">
              <Link to="/" className="hover:text-white underline-offset-2 hover:underline">
                AllGrafika.pl
              </Link>{' '}
              / <span>{PHOTO_CHECKER_LABEL}</span>
            </nav>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-4">
              {H1} <span className="block text-yellow-300">{H1_ACCENT}</span>
            </h1>
            <p className="text-base md:text-xl text-blue-50 max-w-2xl mx-auto">
              Sprawdź format, wymiary, proporcje, wagę, przezroczystość i białe tło zdjęcia, zanim wgrasz je na OLX, Vinted, eBay, Amazon, do sklepu Shopify, WooCommerce, Shoper, PrestaShop albo do
              Google Merchant Center. Każde wymaganie ma link do oficjalnej strony platformy.
            </p>
            <p className="mt-6 inline-block rounded-xl bg-white/10 border border-white/30 px-4 py-2 text-sm text-white">
              Prywatnie: zdjęcia są analizowane w Twojej przeglądarce i nie są nigdzie wysyłane.
            </p>
          </div>
        </section>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-14 text-gray-700 leading-relaxed">
          <section id="narzedzie" aria-labelledby="narzedzie-h">
            <h2 id="narzedzie-h" className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Sprawdź swoje zdjęcia
            </h2>
            <PhotoChecker />
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Co sprawdza narzędzie</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Format pliku</strong> – rozpoznany po zawartości, nie po rozszerzeniu: JPEG, PNG, WebP, HEIC, AVIF, GIF, BMP i TIFF. HEIC z iPhone’a oznaczamy tam, gdzie platforma go nie
                wymienia.
              </li>
              <li>
                <strong>Wymiary w pikselach</strong> – także dla HEIC i AVIF, z uwzględnieniem obrotu zapisanego w metadanych EXIF.
              </li>
              <li>
                <strong>Proporcje i orientację</strong> – np. 1:1, 4:3 czy 16:9, kwadrat, poziom, pion albo panorama.
              </li>
              <li>
                <strong>Wagę pliku i rozdzielczość</strong> w megapikselach – w porównaniu z limitami platform (1 MB liczymy jako 1 000 000 bajtów).
              </li>
              <li>
                <strong>Przezroczystość</strong> – kanał alfa w PNG, WebP i AVIF oraz faktycznie przezroczyste piksele.
              </li>
              <li>
                <strong>Białe tło (szacunek)</strong> – udział czystej bieli w pasie przy krawędziach zdjęcia, ważny dla zdjęcia głównego na Amazonie.
              </li>
            </ul>
            <p className="mt-4">
              Wynik dla każdej platformy to <strong>Zgodne</strong>, <strong>Uwaga</strong> (zalecenie, szacunek albo wymóg, który zacznie obowiązywać), <strong>Niezgodne</strong> (twardy limit z
              dokumentacji) albo <strong>Brak danych</strong> (platforma nie publikuje wartości, które da się sprawdzić w pliku).
            </p>
          </section>

          <section id="wymagania">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Wymagania platform i źródła</h2>
            <p className="mb-6">
              Poniższe wartości pochodzą wyłącznie z oficjalnych stron pomocy i dokumentacji. Sprawdziliśmy je <time dateTime={CHECKED_AT}>{CHECKED}</time>. Gdzie platforma nie podaje wartości,
              piszemy „{NO_OFFICIAL_VALUE}” – nie zgadujemy.
            </p>
            <div className="space-y-8">
              {PLATFORMS.map((p) => (
                <div key={p.id} id={`wymagania-${p.id}`}>
                  <h3 className="text-xl font-semibold text-gray-900">{p.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">Zakres: {p.scope}.</p>
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full table-fixed text-left text-sm">
                      <caption className="sr-only">Wymagania dotyczące zdjęć: {p.name}</caption>
                      <thead className="bg-gray-100 text-gray-900">
                        <tr>
                          <th scope="col" className="px-3 py-2 font-semibold">
                            Wymaganie
                          </th>
                          <th scope="col" className="w-[42%] px-3 py-2 font-semibold">
                            Źródło
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 align-top">
                        {p.requirements.map((r) => {
                          const s = sourceOf(p, r.source)
                          return (
                            <tr key={r.label}>
                              <td className="px-3 py-2 break-words">
                                <span className="font-medium text-gray-900">{r.label}:</span> {r.value}
                              </td>
                              <td className="px-3 py-2 break-words">
                                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">
                                  {s.label}
                                </a>{' '}
                                <span className="text-gray-500">(sprawdzono {formatPlDate(p.checkedAt)})</span>
                              </td>
                            </tr>
                          )
                        })}
                        {p.notes.map((n) => {
                          const s = sourceOf(p, n.source)
                          return (
                            <tr key={n.text}>
                              <td className="px-3 py-2 break-words">
                                <span className="font-medium text-gray-900">Zasada (narzędzie jej nie sprawdza):</span> {n.text}
                              </td>
                              <td className="px-3 py-2 break-words">
                                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">
                                  {s.label}
                                </a>{' '}
                                <span className="text-gray-500">(sprawdzono {formatPlDate(p.checkedAt)})</span>
                              </td>
                            </tr>
                          )
                        })}
                        {p.undocumented.map((u) => (
                          <tr key={u}>
                            <td className="px-3 py-2 break-words">
                              <span className="font-medium text-gray-900">{u}:</span> {NO_OFFICIAL_VALUE}
                            </td>
                            <td className="px-3 py-2 break-words text-gray-600">Brak w źródłach powyżej (sprawdzono {formatPlDate(p.checkedAt)})</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-gray-500">
              Nazwy platform są znakami towarowymi ich właścicieli i służą wyłącznie do opisu wymagań dotyczących plików. AllGrafika.pl nie jest powiązana z tymi platformami.
            </p>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Zdjęcia pod konkretną platformę</h2>
            <p className="mb-4">Wynik narzędzia to dopiero początek. Na stronach poniżej opisujemy, jakie zdjęcia przygotować na daną platformę i jak zrobić je telefonem:</p>
            <ul className="flex flex-wrap gap-3 mb-8">
              {landings.map((l) => (
                <li key={l.path}>
                  <Link to={l.path} className="inline-block border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-800 hover:border-blue-400 hover:text-blue-700">
                    {l.navLabel}
                  </Link>
                </li>
              ))}
            </ul>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Poradniki o wymiarach i formatach</h3>
            <ul className="list-disc pl-6 space-y-2">
              {posts.map((p) => (
                <li key={p.slug}>
                  <Link to={`/blog/${p.slug}`} className="text-blue-700 underline underline-offset-2">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section id="umiesc-u-siebie">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Jak umieścić to narzędzie u siebie</h2>
            <p className="mb-4">
              Piszesz poradnik dla sprzedawców albo prowadzisz kurs e-commerce? Podlinkuj narzędzie – czytelnicy sprawdzą swoje zdjęcia bez rejestracji i bez wysyłania plików. Wystarczy zwykły link,
              bez skryptów i ramek iframe:
            </p>
            <EmbedSnippet />
            <p className="mt-4 text-sm text-gray-600">
              Nie płacimy za linki do narzędzia. Jeśli link jest częścią płatnej współpracy, oznacz go atrybutem <code className="bg-gray-100 px-1 rounded">rel=&quot;sponsored&quot;</code> – tak jak w{' '}
              <Link to="/program-partnerski" className="text-blue-700 underline">
                programie partnerskim
              </Link>
              .
            </p>
          </section>

          <section id="faq">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Najczęstsze pytania</h2>
            <div className="space-y-4">
              {FAQ.map((item) => (
                <details key={item.q} className="bg-white rounded-2xl border border-gray-200 p-5 group">
                  <summary className="font-semibold text-gray-900 cursor-pointer list-none flex justify-between items-center gap-4">
                    {item.q}
                    <span className="text-blue-600 group-open:rotate-45 transition-transform text-xl" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="mt-3">{item.a}</p>
                </details>
              ))}
            </div>
            <p className="mt-6 text-sm text-gray-600">
              Aktualizacja: <time dateTime={PHOTO_CHECKER_UPDATED}>{formatPlDate(PHOTO_CHECKER_UPDATED)}</time>
            </p>
          </section>
        </main>

        <section className="py-16 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Popraw zdjęcie w AllGrafika</h2>
            <p className="text-blue-50 text-lg mb-8">
              Zdjęcie nie spełnia wymagań? AllGrafika zrobi z niego packshot na białym tle albo aranżację i wyeksportuje plik w rozmiarze pod wybraną platformę. Pierwsze {FREE_GRAPHICS} grafik za
              darmo.
            </p>
            <a
              href={PHOTO_CHECKER_CTA_URL}
              onClick={() => trackCta('photo_checker', 'register')}
              className="inline-block bg-yellow-400 text-gray-900 font-bold px-8 py-4 rounded-xl text-lg hover:bg-yellow-300 transition-colors"
            >
              Popraw zdjęcie w AllGrafika →
            </a>
          </div>
        </section>

        <Footer />
      </div>
    </>
  )
}
