import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2">
            <Link to="/" className="text-white font-bold text-xl">
              AllGrafika.pl
            </Link>
            <p className="mt-3 text-sm leading-relaxed">
              Profesjonalne grafiki produktowe dla sprzedawców Allegro.
              Generuj dziesiątki wariantów w kilka sekund dzięki AI.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Produkt</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#features" className="hover:text-white transition-colors">Funkcje</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Cennik</a></li>
              <li><Link to="/blog" className="hover:text-white transition-colors">Blog</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Firma</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">O nas</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Kontakt</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Polityka prywatności</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Regulamin</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 text-sm text-center space-y-2">
          <p>© {new Date().getFullYear()} AllGrafika.pl · Wszelkie prawa zastrzeżone</p>
          <p>Powered by <a href="https://jan-mat.pl" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">jan-mat.pl</a></p>
        </div>
      </div>
    </footer>
  )
}
