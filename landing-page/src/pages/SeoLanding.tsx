import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import BeforeAfter from '../components/BeforeAfter'
import DemoWidget from '../components/DemoWidget'
import PageHead from '../components/PageHead'
import RichText from '../components/RichText'
import { blogIndex } from '../data/blogIndex'
import { samplePairs } from '../data/samples'
import { SEO_PAGES_UPDATED, seoOgImage, seoPages, seoSlug, type SeoPage } from '../data/seoPages'
import { getCachedSeoContent, loadSeoContent, type SeoContent } from '../data/seoContentLoader'
import { APP_URL, SITE_URL, SOFTWARE_ID, WEBSITE_ID, formatPlDate } from '../data/site'
import { track, trackCta } from '../services/analytics'
import { pageTitle } from '../utils/pageTitle'
import { PHOTO_CHECKER_LABEL, PHOTO_CHECKER_LINKED_FROM, PHOTO_CHECKER_PATH } from '../data/photoChecker'
import { plainText } from '../utils/richText'

function structuredData(page: SeoPage, content: SeoContent, title: string) {
  const url = `${SITE_URL}${page.path}`
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      name: title,
      headline: `${page.h1} – ${page.h1Accent}`,
      description: page.description,
      url,
      inLanguage: 'pl-PL',
      dateModified: SEO_PAGES_UPDATED,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': SOFTWARE_ID },
      primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE_URL}${seoOgImage(page)}`, width: 1200, height: 630 },
      citation: content.sources.map((s) => s.url),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'AllGrafika.pl', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: page.h1, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: content.faq.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: plainText(item.a) } })),
    },
  ]
}

/** Landing page for one keyword cluster (spec 10, AC-SEO-007/014). Metadata: src/data/seoPages.ts, copy: src/data/seoContent/. */
export default function SeoLanding({ page }: { page: SeoPage }) {
  const slug = seoSlug(page)
  // Present synchronously when prerendering or after the pre-hydration preload (main.tsx); fetched on client navigation.
  const [content, setContent] = useState(() => getCachedSeoContent(slug))
  useEffect(() => {
    if (content) return
    let cancelled = false
    loadSeoContent(slug).then((loaded) => {
      if (!cancelled && loaded) setContent(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [slug, content])

  const title = pageTitle(page.title)
  const related = page.related.map((s) => blogIndex.find((p) => p.slug === s)).filter((p) => p !== undefined)
  const others = seoPages.filter((p) => p.path !== page.path)

  return (
    <>
      <PageHead
        title={title}
        description={page.description}
        path={page.path}
        image={seoOgImage(page)}
        imageAlt={`${page.h1} – ${page.h1Accent}`}
        jsonLd={content ? structuredData(page, content, title) : []}
      />

      <div className="min-h-screen bg-white">
        <Navbar />

        <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-20 text-center">
            <nav aria-label="Ścieżka" className="text-sm text-blue-100 mb-4 md:mb-6">
              <Link to="/" className="hover:text-white underline-offset-2 hover:underline">
                AllGrafika.pl
              </Link>{' '}
              / <span>{page.h1}</span>
            </nav>
            <h1 className="text-3xl md:text-6xl font-extrabold leading-tight mb-4 md:mb-6">
              {page.h1} <span className="block text-yellow-300">{page.h1Accent}</span>
            </h1>
            {content ? <p className="text-base md:text-xl text-blue-50 max-w-2xl mx-auto mb-8 md:mb-10">{plainText(content.lead)}</p> : <div className="h-24" />}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#demo"
                onClick={() => {
                  track('seo_demo_click', { page: page.path })
                  trackCta('seo_hero', 'demo')
                }}
                className="bg-yellow-400 text-gray-900 font-bold px-8 py-4 rounded-xl text-lg hover:bg-yellow-300 transition-colors"
              >
                Sprawdź na swoim produkcie →
              </a>
              <a
                href={`${APP_URL}/register`}
                onClick={() => {
                  track('seo_register_click', { page: page.path })
                  trackCta('seo_hero', 'register')
                }}
                className="bg-blue-800 text-white font-medium px-8 py-4 rounded-xl text-lg hover:bg-blue-900 transition-colors border border-white/30"
              >
                Załóż konto – 5 grafik gratis
              </a>
            </div>
            <p className="mt-6 text-blue-100 text-sm">Bez karty • Bez konta do pierwszej próby • Gotowe w kilka minut</p>
          </div>
        </section>

        {content ? (
          <section className="py-16 bg-gray-50">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-12">
              <p className="text-sm text-gray-600">
                Aktualizacja: <time dateTime={SEO_PAGES_UPDATED}>{formatPlDate(SEO_PAGES_UPDATED)}</time>
              </p>
              {content.sections.map((s) => (
                <article key={s.heading}>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">{s.heading}</h2>
                  {s.paragraphs.map((p) => (
                    <p key={p} className="text-gray-700 leading-relaxed mb-4">
                      <RichText text={p} />
                    </p>
                  ))}
                  {s.bullets && (
                    <ul className="list-disc pl-6 space-y-2 text-gray-700">
                      {s.bullets.map((b) => (
                        <li key={b}>
                          <RichText text={b} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.steps && (
                    <ol className="list-decimal pl-6 space-y-2 text-gray-700">
                      {s.steps.map((b) => (
                        <li key={b}>
                          <RichText text={b} />
                        </li>
                      ))}
                    </ol>
                  )}
                  {s.table && (
                    <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
                      <table className="w-full text-left text-sm">
                        <caption className="sr-only">{s.table.caption}</caption>
                        <thead className="bg-gray-100 text-gray-900">
                          <tr>
                            {s.table.head.map((h) => (
                              <th key={h} scope="col" className="px-4 py-3 font-semibold">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700 align-top">
                          {s.table.rows.map((row) => (
                            <tr key={row[0]}>
                              {row.map((cell, i) =>
                                i === 0 ? (
                                  <th key={i} scope="row" className="px-4 py-3 font-medium text-gray-900">
                                    <RichText text={cell} />
                                  </th>
                                ) : (
                                  <td key={i} className="px-4 py-3">
                                    <RichText text={cell} />
                                  </td>
                                ),
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              ))}
              {PHOTO_CHECKER_LINKED_FROM.includes(page.path) && (
                <p className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-gray-800" data-photo-checker-link="">
                  Masz już zdjęcie? Sprawdź za darmo jego format, wymiary, wagę i tło –{' '}
                  <Link to={PHOTO_CHECKER_PATH} className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900">
                    {PHOTO_CHECKER_LABEL}
                  </Link>{' '}
                  działa w przeglądarce i nie wysyła pliku.
                </p>
              )}
            </div>
          </section>
        ) : (
          <div className="py-16 bg-gray-50" aria-busy="true">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 animate-pulse space-y-4">
              <div className="h-8 w-2/3 bg-gray-200 rounded" />
              <div className="h-4 w-full bg-gray-200 rounded" />
              <div className="h-4 w-5/6 bg-gray-200 rounded" />
            </div>
          </div>
        )}

        <BeforeAfter pairs={samplePairs} />

        <DemoWidget />

        {content && (
          <section id="faq" className="py-16">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
              <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">Najczęstsze pytania</h2>
              <div className="space-y-4">
                {content.faq.map((item) => (
                  <details key={item.q} className="bg-white rounded-2xl border border-gray-100 p-6 group">
                    <summary className="font-semibold text-gray-900 cursor-pointer list-none flex justify-between items-center gap-4">
                      {item.q}
                      <span className="text-blue-600 group-open:rotate-45 transition-transform text-xl" aria-hidden="true">
                        +
                      </span>
                    </summary>
                    <p className="text-gray-700 mt-4 leading-relaxed">
                      <RichText text={item.a} />
                    </p>
                  </details>
                ))}
              </div>
              {content.sources.length > 0 && (
                <div className="mt-10 text-sm text-gray-600">
                  <h3 className="font-semibold text-gray-900 mb-2">Źródła</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {content.sources.map((s) => (
                      <li key={s.url}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2 hover:text-blue-900">
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="py-16 bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">Poradniki na ten temat</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {related.map((p) => (
                  <Link key={p.id} to={`/blog/${p.slug}`} className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow">
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">{p.category}</span>
                    <h3 className="font-semibold text-gray-900 mt-3 mb-2 leading-snug">{p.title}</h3>
                    <p className="text-gray-600 text-sm line-clamp-3">{p.excerpt}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="py-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Zdjęcia produktowe do innych zastosowań</h2>
            <ul className="flex flex-wrap gap-3">
              {others.map((p) => (
                <li key={p.path}>
                  <Link to={p.path} className="inline-block border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-800 hover:border-blue-400 hover:text-blue-700">
                    {p.navLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Zamień zdjęcie z telefonu na zdjęcie produktowe</h2>
            <p className="text-blue-50 text-lg mb-8">Sprawdź na jednym produkcie bez konta albo załóż darmowe konto i wygeneruj 5 grafik bez podawania karty.</p>
            <a
              href={`${APP_URL}/register`}
              onClick={() => {
                track('seo_cta_register_click', { page: page.path })
                trackCta('seo_final_cta', 'register')
              }}
              className="inline-block bg-yellow-400 text-gray-900 font-bold px-10 py-4 rounded-xl text-lg hover:bg-yellow-300 transition-colors"
            >
              Rejestracja za darmo – 5 grafik gratis →
            </a>
          </div>
        </section>

        <Footer />
      </div>
    </>
  )
}
