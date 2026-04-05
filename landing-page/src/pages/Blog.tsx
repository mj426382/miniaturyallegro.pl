import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { blogPosts } from '../data/blogPosts'

export default function Blog() {
  return (
    <>
      <Helmet>
        <title>Blog – Grafiki produktowe, Zdjęcia Allegro | AllGrafika.pl</title>
        <meta
          name="description"
          content="Porady dotyczące miniaturek Allegro, zdjęć produktowych i sprzedaży online. Dowiedz się jak zwiększyć sprzedaż na Allegro."
        />
        <meta name="keywords" content="blog miniaturki allegro, zdjęcia produktowe allegro, porady sprzedaż allegro" />
        <link rel="canonical" href="https://allgrafika.pl/blog" />
      </Helmet>

      <div className="min-h-screen bg-white">
        <Navbar />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Blog o miniaturkach Allegro
            </h1>
            <p className="text-lg text-gray-500">
              Porady, wskazówki i strategie dla sprzedawców Allegro
            </p>
          </div>

          <div className="space-y-8">
            {blogPosts.map((post) => (
              <article
                key={post.id}
                className="bg-white border border-gray-100 rounded-2xl p-8 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-4">
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
                  <span className="text-gray-400 text-sm">•</span>
                  <span className="text-gray-400 text-sm">{post.readTime} min czytania</span>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  <Link
                    to={`/blog/${post.slug}`}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {post.title}
                  </Link>
                </h2>

                <p className="text-gray-600 leading-relaxed mb-4">{post.excerpt}</p>

                <Link
                  to={`/blog/${post.slug}`}
                  className="text-blue-600 font-medium hover:text-blue-700 text-sm"
                >
                  Czytaj dalej →
                </Link>
              </article>
            ))}
          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}
