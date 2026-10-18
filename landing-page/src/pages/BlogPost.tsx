import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import PageHead from '../components/PageHead'
import { blogIndex } from '../data/blogIndex'
import { getCachedPost, loadPost, postExists } from '../data/blogLoader'
import { FREE_GRAPHICS } from '../data/pricing'
import { findSeoPage } from '../data/seoPages'
import { APP_URL, ORG_ID, SITE_URL, formatPlDate } from '../data/site'
import { clusterOfPost } from '../data/topicClusters'
import { pageTitle } from '../utils/pageTitle'
import { extractFaq, parsePost, renderInline, wordCount, type Block } from '../utils/postMarkdown'
import { trackCta } from '../services/analytics'

const BLOG_OG_IMAGE = '/og/blog.png'

function renderBlock(block: Block, i: number) {
  switch (block.type) {
    case 'h2':
      return (
        <h2 key={i} className="text-2xl font-bold text-gray-900 mt-10 mb-4">
          {block.text}
        </h2>
      )
    case 'h3':
      return (
        <h3 key={i} className="text-xl font-semibold text-gray-900 mt-6 mb-3">
          {block.text}
        </h3>
      )
    case 'quote':
      return <blockquote key={i} className="border-l-4 border-amber-400 bg-amber-50 text-gray-800 px-4 py-3 rounded-r-lg mb-4" dangerouslySetInnerHTML={{ __html: renderInline(block.text) }} />
    case 'ul':
      return (
        <ul key={i} className={`mb-4 space-y-1 text-gray-700 leading-relaxed ${block.checklist ? 'list-none pl-0' : 'list-disc pl-6'}`}>
          {block.items.map((item, j) =>
            block.checklist ? (
              <li key={j} className="flex gap-2">
                <span aria-hidden="true">☐</span>
                <span dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
              </li>
            ) : (
              <li key={j} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
            ),
          )}
        </ul>
      )
    case 'ol':
      return (
        <ol key={i} className="mb-4 list-decimal pl-6 space-y-1 text-gray-700 leading-relaxed">
          {block.items.map((item, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
          ))}
        </ol>
      )
    case 'table':
      return (
        <div key={i} className="mb-6 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-900">
              <tr>
                {block.head.map((h, j) => (
                  <th key={j} scope="col" className="px-3 py-2 font-semibold" dangerouslySetInnerHTML={{ __html: renderInline(h) }} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700 align-top">
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2" dangerouslySetInnerHTML={{ __html: renderInline(cell) }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    default:
      return <p key={i} className="text-gray-700 leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: renderInline(block.text) }} />
  }
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const meta = blogIndex.find((p) => p.slug === slug)
  // Body: present synchronously when prerendering or after the pre-hydration preload;
  // on client-side navigation it is fetched as its own chunk.
  const [post, setPost] = useState(() => (slug ? getCachedPost(slug) : undefined))

  useEffect(() => {
    if (!slug || post?.slug === slug) return
    let cancelled = false
    setPost(getCachedPost(slug))
    loadPost(slug).then((loaded) => {
      if (!cancelled && loaded) setPost(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [slug, post?.slug])

  if (!meta || !slug || !postExists(slug)) return <Navigate to="/blog" replace />

  if (!post || post.slug !== slug) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <article className="max-w-3xl mx-auto px-4 sm:px-6 py-16 animate-pulse">
          <div className="h-4 w-40 bg-gray-100 rounded mb-8" />
          <div className="h-10 w-3/4 bg-gray-200 rounded mb-6" />
          <div className="h-5 w-full bg-gray-100 rounded mb-3" />
          <div className="h-5 w-5/6 bg-gray-100 rounded mb-3" />
          <div className="h-5 w-2/3 bg-gray-100 rounded" />
        </article>
        <Footer />
      </div>
    )
  }

  const canonicalUrl = `${SITE_URL}/blog/${post.slug}`
  const datePublished = post.publishedAt
  const dateModified = post.modifiedAt ?? post.publishedAt
  const blocks = parsePost(post.content)
  const faq = extractFaq(blocks)
  const cluster = clusterOfPost(post.slug)
  const pillars = (cluster?.pillars ?? []).map((p) => findSeoPage(p)).filter((p) => p !== undefined)

  // Related posts (AC-SEO-017, AC-SEO-025): the post's neighbours in its cluster first – next, the one after and
  // previous, rotating – so every post of a cluster gets links (a fixed "first 3" would starve the rest),
  // then the same category, newest first.
  const others = blogIndex.filter((p) => p.slug !== post.slug)
  const clusterPosts = cluster?.posts ?? []
  const at = clusterPosts.indexOf(post.slug)
  const neighbourSlugs = at < 0 ? [] : [1, 2, -1, 3, -2].map((d) => clusterPosts[(at + d + clusterPosts.length * 3) % clusterPosts.length])
  const sameCluster = neighbourSlugs.map((s) => others.find((p) => p.slug === s)).filter((p) => p !== undefined)
  const related = [...sameCluster, ...others.filter((p) => p.category === post.category && !sameCluster.includes(p)), ...others].filter((p, i, all) => all.indexOf(p) === i).slice(0, 3)

  const structuredData: object[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      '@id': `${canonicalUrl}#article`,
      headline: post.title,
      description: post.excerpt,
      datePublished,
      dateModified,
      inLanguage: 'pl-PL',
      wordCount: wordCount(post.content),
      author: { '@type': 'Organization', '@id': ORG_ID, name: 'AllGrafika.pl', url: `${SITE_URL}/` },
      publisher: { '@type': 'Organization', '@id': ORG_ID, name: 'AllGrafika.pl', logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` } },
      url: canonicalUrl,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
      isPartOf: { '@id': `${SITE_URL}/blog#blog` },
      articleSection: cluster?.name ?? post.category,
      image: { '@type': 'ImageObject', url: `${SITE_URL}${BLOG_OG_IMAGE}`, width: 1200, height: 630 },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Strona główna', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
        { '@type': 'ListItem', position: 3, name: post.title, item: canonicalUrl },
      ],
    },
  ]
  if (faq.length > 0) {
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
    })
  }

  return (
    <>
      <PageHead title={pageTitle(post.title)} description={post.excerpt} path={`/blog/${post.slug}`} image={BLOG_OG_IMAGE} imageAlt={post.title} type="article" jsonLd={structuredData}>
        {[
          <meta key="pt" property="article:published_time" content={datePublished} />,
          <meta key="mt" property="article:modified_time" content={dateModified} />,
          <meta key="s" property="article:section" content={cluster?.name ?? post.category} />,
        ]}
      </PageHead>

      <div className="min-h-screen bg-white">
        <Navbar />

        <article className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <nav aria-label="Ścieżka" className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mb-8">
            <Link to="/" className="hover:text-gray-900">
              Strona główna
            </Link>
            <span aria-hidden="true">/</span>
            <Link to="/blog" className="hover:text-gray-900">
              Blog
            </Link>
            {cluster && (
              <>
                <span aria-hidden="true">/</span>
                <Link to={`/blog#${cluster.id}`} className="hover:text-gray-900">
                  {cluster.name}
                </Link>
              </>
            )}
          </nav>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-6 text-sm text-gray-600">
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-3 py-1 rounded-full">{post.category}</span>
            <time dateTime={datePublished}>{formatPlDate(datePublished)}</time>
            {dateModified !== datePublished && (
              <span>
                aktualizacja: <time dateTime={dateModified}>{formatPlDate(dateModified)}</time>
              </span>
            )}
            <span>• {post.readTime} min czytania</span>
          </p>

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 leading-tight">{post.title}</h1>

          <p className="text-xl text-gray-600 mb-8 leading-relaxed border-l-4 border-blue-500 pl-4">{post.excerpt}</p>

          <div className="prose-content">{blocks.map(renderBlock)}</div>

          {pillars.length > 0 && cluster && (
            <aside aria-label="Temat" className="mt-12 rounded-2xl border border-blue-100 bg-blue-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-800">Temat: {cluster.name}</p>
              <p className="text-gray-800 mt-2">{cluster.intro}</p>
              <ul className="mt-3 space-y-1">
                {pillars.map((p) => (
                  <li key={p.path}>
                    <Link to={p.path} className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900">
                      {p.navLabel} →
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          )}

          <div className="mt-12 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white text-center">
            <p className="text-xl font-bold mb-3">Zrób zdjęcia produktowe z jednej fotki z telefonu</p>
            <p className="text-blue-50 mb-6">Wypróbuj AllGrafika.pl za darmo – {FREE_GRAPHICS} grafik gratis po potwierdzeniu e-maila, bez karty.</p>
            <a
              href={`${APP_URL}/register`}
              onClick={() => trackCta('blog_post', 'register')}
              className="inline-block bg-yellow-400 text-gray-900 font-bold px-8 py-3 rounded-xl hover:bg-yellow-300 transition-colors"
            >
              Zacznij za darmo →
            </a>
          </div>
        </article>

        {related.length > 0 && (
          <section data-related-posts className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{cluster ? `Więcej w temacie: ${cluster.name}` : 'Przeczytaj również'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((p) => (
                <Link key={p.id} to={`/blog/${p.slug}`} className="bg-white border border-gray-100 rounded-xl p-6 hover:shadow-md transition-shadow">
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">{p.category}</span>
                  <h3 className="font-semibold text-gray-900 mt-3 mb-2 leading-snug">{p.title}</h3>
                  <p className="text-gray-600 text-sm line-clamp-2">{p.excerpt}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <Footer />
      </div>
    </>
  )
}
