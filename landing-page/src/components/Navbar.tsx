import { Link } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-gray-900">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>AllGrafika.pl</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link to="/#features" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Funkcje
            </Link>
            <Link to="/#pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Cennik
            </Link>
            <Link to="/blog" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Blog
            </Link>
            <a
              href="https://app.allgrafika.pl/login"
              className="text-gray-600 hover:text-gray-900 text-sm font-medium"
            >
              Zaloguj się
            </a>
            <a
              href="https://app.allgrafika.pl/register"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Wypróbuj za darmo
            </a>
          </div>
        </div>
      </div>
    </nav>
  )
}
