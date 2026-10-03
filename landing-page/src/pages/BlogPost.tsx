import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { blogIndex } from '../data/blogIndex'
import { getCachedPost, loadPost, postExists } from '../data/blogLoader'

const SITE_URL = 'https://allgrafika.pl'

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

// Renders inline markdown (links [text](url) and bold **text**) from LLM-generated content.
// Everything is HTML-escaped first; only http(s) URLs without quotes/spaces become links.
function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)"'<>]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline font-semibold" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}

// Simple markdown-like renderer for bold and headers
function renderContent(content: string) {
  const lines = content.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('## ')) {
      return (
        <h2 key={i} className="text-2xl font-bold text-gray-900 mt-8 mb-4">
          {line.slice(3)}
        </h2>
      )
    }
    if (line.startsWith('### ')) {
      return (
        <h3 key={i} className="text-xl font-semibold text-gray-900 mt-6 mb-3">
          {line.slice(4)}
        </h3>
      )
    }
    if (line.startsWith('- ')) {
      return <li key={i} className="text-gray-700 leading-relaxed ml-4 list-disc" dangerouslySetInnerHTML={{ __html: renderInline(line.slice(2)) }} />
    }
    if (line.trim() === '') return <br key={i} />
    return <p key={i} className="text-gray-700 leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
  })
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

  if (!post) {
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

  // Related posts: prefer same category, exclude current, take up to 3
  const related = [...blogIndex.filter((p) => p.slug !== slug && p.category === post.category), ...blogIndex.filter((p) => p.slug !== slug && p.category !== post.category)].slice(0, 3)

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished,
    dateModified,
    author: {
      '@type': 'Organization',
      name: 'AllGrafika.pl',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'AllGrafika.pl',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
    },
    url: canonicalUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    articleSection: post.category,
    image: `${SITE_URL}/og-image.png`,
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Strona główna', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: canonicalUrl },
    ],
  }

  return (
    <>
      <Helmet>
        <title>{post.title} | AllGrafika.pl</title>
        <meta name="description" content={post.excerpt} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.excerpt} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="AllGrafika.pl" />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="article:published_time" content={datePublished} />
        <meta property="article:modified_time" content={dateModified} />
        <meta property="article:section" content={post.category} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.excerpt} />
        <meta name="twitter:image" content={`${SITE_URL}/og-image.png`} />

        {/* JSON-LD */}
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      <div className="min-h-screen bg-white">
        <Navbar />

        <article className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-gray-500 mb-8">
            <Link to="/" className="hover:text-gray-700">
              Strona główna
            </Link>
            <span>/</span>
            <Link to="/blog" className="hover:text-gray-700">
              Blog
            </Link>
            <span>/</span>
            <span className="text-gray-900">{post.title}</span>
          </nav>

          {/* Meta */}
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-blue-100 text-blue-700 text-xs font-medium px-3 py-1 rounded-full">{post.category}</span>
            <span className="text-gray-400 text-sm">
              <time dateTime={datePublished}>
                {new Date(datePublished).toLocaleDateString('pl-PL', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
            </span>
            <span className="text-gray-400 text-sm">• {post.readTime} min czytania</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 leading-tight">{post.title}</h1>

          <p className="text-xl text-gray-500 mb-8 leading-relaxed border-l-4 border-blue-500 pl-4">{post.excerpt}</p>

          <div className="prose-content">{renderContent(post.content)}</div>

          {/* CTA Box */}
          <div className="mt-12 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white text-center">
            <h3 className="text-xl font-bold mb-3">Gotowy na profesjonalne grafiki Allegro?</h3>
            <p className="text-blue-100 mb-6">Wypróbuj AllGrafika.pl za darmo – 10 generacji gratis, bez karty kredytowej.</p>
            <a href="https://app.allgrafika.pl/register" className="inline-block bg-yellow-400 text-gray-900 font-bold px-8 py-3 rounded-xl hover:bg-yellow-300 transition-colors">
              Zacznij za darmo →
            </a>
          </div>
        </article>

        {/* Related posts */}
        {related.length > 0 && (
          <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Przeczytaj również</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((p) => (
                <Link key={p.id} to={`/blog/${p.slug}`} className="bg-white border border-gray-100 rounded-xl p-6 hover:shadow-md transition-shadow">
                  <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">{p.category}</span>
                  <h3 className="font-semibold text-gray-900 mt-3 mb-2 leading-snug">{p.title}</h3>
                  <p className="text-gray-500 text-sm line-clamp-2">{p.excerpt}</p>
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
