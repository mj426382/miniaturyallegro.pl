import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-gray-900">
            <img src="/logo.webp" alt="AllGrafika.pl" className="h-9 w-auto mix-blend-multiply" />
            <span>AllGrafika</span>
          </Link>

          {/* Desktop nav */}
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

          {/* Mobile hamburger button */}
          <button
            className="md:hidden flex flex-col items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Menu"
          >
            <span className={`block w-5 h-0.5 bg-gray-700 rounded transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-[3px]' : ''}`} />
            <span className={`block w-5 h-0.5 bg-gray-700 rounded mt-1 transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-gray-700 rounded mt-1 transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-3">
            <Link to="/#features" onClick={() => setMenuOpen(false)} className="text-gray-600 hover:text-gray-900 text-sm font-medium py-2">
              Funkcje
            </Link>
            <Link to="/#pricing" onClick={() => setMenuOpen(false)} className="text-gray-600 hover:text-gray-900 text-sm font-medium py-2">
              Cennik
            </Link>
            <Link to="/blog" onClick={() => setMenuOpen(false)} className="text-gray-600 hover:text-gray-900 text-sm font-medium py-2">
              Blog
            </Link>
            <a
              href="https://app.allgrafika.pl/login"
              className="text-gray-600 hover:text-gray-900 text-sm font-medium py-2"
            >
              Zaloguj się
            </a>
            <a
              href="https://app.allgrafika.pl/register"
              className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors text-center mt-1"
            >
              Wypróbuj za darmo
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
