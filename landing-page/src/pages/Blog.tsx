import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import PageHead from '../components/PageHead'
import { blogIndex, type BlogPostMeta } from '../data/blogIndex'
import { findSeoPage } from '../data/seoPages'
import { ORG_ID, SITE_URL, WEBSITE_ID, formatPlDate } from '../data/site'
import { topicClusters } from '../data/topicClusters'

const TITLE = 'Blog – zdjęcia produktowe i sprzedaż online | AllGrafika.pl'
const DESCRIPTION = 'Poradniki o zdjęciach produktowych: packshot, białe tło, fotografia telefonem, zdjęcia do sklepu internetowego i na marketplace, opisy produktów i konwersja.'

const byDate = (a: BlogPostMeta, b: BlogPostMeta) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0)
const sortedPosts = [...blogIndex].sort(byDate)
const bySlug = new Map(blogIndex.map((p) => [p.slug, p]))

/** Hub sections (AC-SEO-017): one per topic cluster, plus the posts not assigned to any cluster yet. */
const hubs = topicClusters.map((c) => ({ ...c, items: c.posts.map((s) => bySlug.get(s)).filter((p): p is BlogPostMeta => p !== undefined) })).filter((c) => c.items.length > 0)
const clustered = new Set(hubs.flatMap((h) => h.items.map((p) => p.slug)))
const unclustered = sortedPosts.filter((p) => !clustered.has(p.slug))

const structuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${SITE_URL}/blog#blog`,
    name: 'Blog AllGrafika – zdjęcia produktowe i sprzedaż online',
    description: DESCRIPTION,
    url: `${SITE_URL}/blog`,
    inLanguage: 'pl-PL',
    isPartOf: { '@id': WEBSITE_ID },
    publisher: { '@id': ORG_ID },
    blogPost: sortedPosts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${SITE_URL}/blog/${p.slug}`,
      datePublished: p.publishedAt,
      dateModified: p.modifiedAt ?? p.publishedAt,
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Strona główna', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
    ],
  },
]

function PostCard({ post }: { post: BlogPostMeta }) {
  return (
    <article className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-sm text-gray-600">
        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-3 py-1 rounded-full">{post.category}</span>
        <time dateTime={post.publishedAt}>{formatPlDate(post.publishedAt)}</time>
        <span aria-hidden="true">•</span>
        <span>{post.readTime} min czytania</span>
      </p>
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        <Link to={`/blog/${post.slug}`} className="hover:text-blue-700 transition-colors">
          {post.title}
        </Link>
      </h3>
      <p className="text-gray-700 leading-relaxed">{post.excerpt}</p>
    </article>
  )
}

export default function Blog() {
  return (
    <>
      <PageHead title={TITLE} description={DESCRIPTION} path="/blog" image="/og/blog.png" imageAlt="Blog AllGrafika – poradniki o zdjęciach produktowych" jsonLd={structuredData} />

      <div className="min-h-screen bg-white">
        <Navbar />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <nav aria-label="Ścieżka" className="text-sm text-gray-600 mb-6">
            <Link to="/" className="hover:text-gray-900">
              Strona główna
            </Link>{' '}
            / <span className="text-gray-900">Blog</span>
          </nav>
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Blog AllGrafika – zdjęcia produktowe i sprzedaż online</h1>
            <p className="text-lg text-gray-600">Poradniki dla sklepów internetowych i sprzedawców na OLX, Vinted, eBay i Amazon – pogrupowane według tematów</p>
          </div>

          <nav aria-label="Tematy" className="mb-14">
            <ul className="flex flex-wrap justify-center gap-2">
              {hubs.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} className="inline-block border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-800 hover:border-blue-400 hover:text-blue-700">
                    {h.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-16">
            {hubs.map((h) => (
              <section key={h.id} id={h.id} aria-labelledby={`${h.id}-heading`} className="scroll-mt-24">
                <h2 id={`${h.id}-heading`} className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                  {h.name}
                </h2>
                <p className="text-gray-700 mb-3">{h.intro}</p>
                <p className="text-sm text-gray-700 mb-6">
                  Przewodnik:{' '}
                  {h.pillars.map((path, i) => {
                    const page = findSeoPage(path)
                    if (!page) return null
                    return (
                      <span key={path}>
                        {i > 0 && ' · '}
                        <Link to={path} className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900">
                          {page.navLabel}
                        </Link>
                      </span>
                    )
                  })}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {h.items.map((post) => (
                    <PostCard key={post.slug} post={post} />
                  ))}
                </div>
              </section>
            ))}

            {unclustered.length > 0 && (
              <section id="pozostale" aria-labelledby="pozostale-heading">
                <h2 id="pozostale-heading" className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
                  Pozostałe poradniki
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {unclustered.map((post) => (
                    <PostCard key={post.slug} post={post} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}
