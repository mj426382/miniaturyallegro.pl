import { useParams, Link, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { blogPosts } from '../data/blogPosts'

// Simple markdown-like renderer for bold and headers
function renderContent(content: string) {
  const lines = content.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('## ')) {
      return <h2 key={i} className="text-2xl font-bold text-gray-900 mt-8 mb-4">{line.slice(3)}</h2>
    }
    if (line.startsWith('### ')) {
      return <h3 key={i} className="text-xl font-semibold text-gray-900 mt-6 mb-3">{line.slice(4)}</h3>
    }
    if (line.startsWith('- ')) {
      return (
        <li key={i} className="text-gray-700 leading-relaxed ml-4 list-disc"
          dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
        />
      )
    }
    if (line.trim() === '') return <br key={i} />
    return (
      <p key={i} className="text-gray-700 leading-relaxed mb-4"
        dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
      />
    )
  })
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const post = blogPosts.find((p) => p.slug === slug)

  if (!post) return <Navigate to="/blog" replace />

  const otherPosts = blogPosts.filter((p) => p.slug !== slug).slice(0, 2)

  return (
    <>
      <Helmet>
        <title>{post.title} | AllGrafika.pl</title>
        <meta name="description" content={post.excerpt} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.excerpt} />
        <link rel="canonical" href={`https://allgrafika.pl/blog/${post.slug}`} />
      </Helmet>

      <div className="min-h-screen bg-white">
        <Navbar />

        <article className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
            <Link to="/" className="hover:text-gray-700">Strona główna</Link>
            <span>/</span>
            <Link to="/blog" className="hover:text-gray-700">Blog</Link>
            <span>/</span>
            <span className="text-gray-900">{post.title}</span>
          </nav>

          {/* Meta */}
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-blue-100 text-blue-700 text-xs font-medium px-3 py-1 rounded-full">
              {post.category}
            </span>
            <span className="text-gray-400 text-sm">
              {new Date(post.publishedAt).toLocaleDateString('pl-PL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <span className="text-gray-400 text-sm">• {post.readTime} min czytania</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 leading-tight">
            {post.title}
          </h1>

          <p className="text-xl text-gray-500 mb-8 leading-relaxed border-l-4 border-blue-500 pl-4">
            {post.excerpt}
          </p>

          <div className="prose-content">
            {renderContent(post.content)}
          </div>

          {/* CTA Box */}
          <div className="mt-12 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white text-center">
            <h3 className="text-xl font-bold mb-3">
              Gotowy na profesjonalne grafiki Allegro?
            </h3>
            <p className="text-blue-100 mb-6">
              Wypróbuj AllGrafika.pl za darmo – 10 generacji gratis, bez karty kredytowej.
            </p>
            <a
              href="https://app.allgrafika.pl/register"
              className="inline-block bg-yellow-400 text-gray-900 font-bold px-8 py-3 rounded-xl hover:bg-yellow-300 transition-colors"
            >
              Zacznij za darmo →
            </a>
          </div>
        </article>

        {/* Other posts */}
        {otherPosts.length > 0 && (
          <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Przeczytaj również</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {otherPosts.map((p) => (
                <Link
                  key={p.id}
                  to={`/blog/${p.slug}`}
                  className="bg-white border border-gray-100 rounded-xl p-6 hover:shadow-md transition-shadow"
                >
                  <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    {p.category}
                  </span>
                  <h3 className="font-semibold text-gray-900 mt-3 mb-2 leading-snug">
                    {p.title}
                  </h3>
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
