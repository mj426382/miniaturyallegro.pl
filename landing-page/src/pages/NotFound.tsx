import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

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
          <p className="text-gray-500 mb-8">Adres mógł się zmienić albo artykuł został przeniesiony.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700">
              Strona główna
            </Link>
            <Link to="/blog" className="border border-gray-200 px-6 py-3 rounded-xl font-medium hover:bg-gray-50">
              Blog
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
