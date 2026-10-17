import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { seoPages } from '../data/seoPages'

export default function NotFound() {
  return (
    <>
      <Helmet>
        <title>Strona nie została znaleziona | AllGrafika.pl</title>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-24 text-center">
          <p className="text-6xl font-extrabold text-blue-600 mb-4">404</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Tej strony nie ma</h1>
          <p className="text-gray-600 mb-8">Adres mógł się zmienić albo artykuł został przeniesiony.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700">
              Strona główna
            </Link>
            <Link to="/blog" className="border border-gray-200 px-6 py-3 rounded-xl font-medium hover:bg-gray-50">
              Blog
            </Link>
          </div>
          <nav aria-label="Popularne strony" className="mt-12">
            <p className="text-sm text-gray-600 mb-3">Popularne strony:</p>
            <ul className="flex flex-wrap justify-center gap-2">
              {seoPages.map((p) => (
                <li key={p.path}>
                  <Link to={p.path} className="inline-block border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-800 hover:border-blue-400 hover:text-blue-700">
                    {p.navLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </main>
        <Footer />
      </div>
    </>
  )
}
