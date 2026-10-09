import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import BeforeAfter from '../components/BeforeAfter'
import DemoWidget from '../components/DemoWidget'
import { blogIndex } from '../data/blogIndex'
import { samplePairs } from '../data/samples'
import type { SeoPage } from '../data/seoPages'
import { track } from '../services/analytics'

const SITE_URL = 'https://allgrafika.pl'
const APP_URL = 'https://app.allgrafika.pl'
const OG_IMAGE = `${SITE_URL}/og-image.png`

/** Landing page for one tool-intent query (spec 10, AC-SEO-007). Content lives in src/data/seoPages.ts. */
export default function SeoLanding({ page }: { page: SeoPage }) {
  const url = `${SITE_URL}${page.path}`
  const title = `${page.title} | AllGrafika.pl`
  const related = page.related.map((slug) => blogIndex.find((p) => p.slug === slug)).filter((p) => p !== undefined)

  const structuredData = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description: page.description, url, inLanguage: 'pl-PL' },
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
      mainEntity: page.faq.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
    },
  ]

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={page.description} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={page.description} />
        <meta property="og:url" content={url} />
        <meta property="og:site_name" content="AllGrafika.pl" />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:image" content={OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={page.description} />
        <meta name="twitter:image" content={OG_IMAGE} />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="min-h-screen bg-white">
        <Navbar />

        <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-20 text-center">
            <nav aria-label="Ścieżka" className="text-sm text-blue-200 mb-4 md:mb-6">
              <Link to="/" className="hover:text-white">
                AllGrafika.pl
              </Link>{' '}
              / <span>{page.h1}</span>
            </nav>
            <h1 className="text-3xl md:text-6xl font-extrabold leading-tight mb-4 md:mb-6">
              {page.h1}
              <br />
              <span className="text-yellow-300">{page.h1Accent}</span>
            </h1>
            <p className="text-base md:text-xl text-blue-100 max-w-2xl mx-auto mb-8 md:mb-10">{page.lead}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#demo"
                onClick={() => track('seo_demo_click', { page: page.path })}
                className="bg-yellow-400 text-gray-900 font-bold px-8 py-4 rounded-xl text-lg hover:bg-yellow-300 transition-colors"
              >
                Sprawdź na swoim produkcie →
              </a>
              <a
                href={`${APP_URL}/register`}
                onClick={() => track('seo_register_click', { page: page.path })}
                className="bg-white/10 text-white font-medium px-8 py-4 rounded-xl text-lg hover:bg-white/20 transition-colors border border-white/20"
              >
                Załóż konto – 5 grafik gratis
              </a>
            </div>
            <p className="mt-6 text-blue-200 text-sm">Bez karty • Bez konta do pierwszej próby • Gotowe w kilka minut</p>
          </div>
        </section>

        <BeforeAfter pairs={samplePairs} />

        <DemoWidget />

        <section className="py-16 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-12">
            {page.sections.map((s) => (
              <article key={s.heading}>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">{s.heading}</h2>
                {s.paragraphs.map((p) => (
                  <p key={p} className="text-gray-600 leading-relaxed mb-4">
                    {p}
                  </p>
                ))}
                {s.bullets && (
                  <ul className="list-disc pl-6 space-y-2 text-gray-700">
                    {s.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>

        <section id="faq" className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">Najczęstsze pytania</h2>
            <div className="space-y-4">
              {page.faq.map((item) => (
                <details key={item.q} className="bg-white rounded-2xl border border-gray-100 p-6 group">
                  <summary className="font-semibold text-gray-900 cursor-pointer list-none flex justify-between items-center gap-4">
                    {item.q}
                    <span className="text-blue-600 group-open:rotate-45 transition-transform text-xl" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="text-gray-600 mt-4 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {related.length > 0 && (
          <section className="py-16 bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">Poradniki na ten temat</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {related.map((p) => (
                  <Link key={p.id} to={`/blog/${p.slug}`} className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow">
                    <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">{p.category}</span>
                    <h3 className="font-semibold text-gray-900 mt-3 mb-2 leading-snug">{p.title}</h3>
                    <p className="text-gray-500 text-sm line-clamp-3">{p.excerpt}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Zamień zdjęcie z telefonu na grafikę Allegro</h2>
            <p className="text-blue-100 text-lg mb-8">Sprawdź na jednym produkcie bez konta albo załóż darmowe konto i wygeneruj 5 grafik bez podawania karty.</p>
            <a
              href={`${APP_URL}/register`}
              onClick={() => track('seo_cta_register_click', { page: page.path })}
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
