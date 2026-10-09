import { Link } from 'react-router-dom'
import { LEGAL_ENTITY } from '../legal/entity'
import { seoPages } from '../data/seoPages'
import { ADS_CONFIGURED, openCookieSettings } from '../consent/googleAds'

const CONTACT_EMAIL = 'kontakt@allgrafika.pl'

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
              Generator miniaturek i grafik produktowych AI dla sprzedawców Allegro. Prześlij zdjęcie, wybierz style, pobierz gotowe grafiki w kilka minut.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Produkt</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/#features" className="hover:text-white transition-colors">
                  Funkcje
                </Link>
              </li>
              <li>
                <Link to="/#pricing" className="hover:text-white transition-colors">
                  Cennik
                </Link>
              </li>
              <li>
                <Link to="/#faq" className="hover:text-white transition-colors">
                  FAQ
                </Link>
              </li>
              {seoPages.map((p) => (
                <li key={p.path}>
                  <Link to={p.path} className="hover:text-white transition-colors">
                    {p.h1}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/blog" className="hover:text-white transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <a href="https://app.allgrafika.pl/login" className="hover:text-white transition-colors">
                  Logowanie
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Firma</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white transition-colors">
                  Kontakt: {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <Link to="/polityka-prywatnosci" className="hover:text-white transition-colors">
                  Polityka prywatności
                </Link>
              </li>
              <li>
                <Link to="/regulamin" className="hover:text-white transition-colors">
                  Regulamin
                </Link>
              </li>
              {ADS_CONFIGURED && (
                <li>
                  <button type="button" onClick={openCookieSettings} className="hover:text-white transition-colors">
                    Ustawienia cookies
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 text-sm text-center space-y-2">
          <p>© {new Date().getFullYear()} AllGrafika.pl · Wszelkie prawa zastrzeżone</p>
          <p className="text-xs text-gray-500">
            {LEGAL_ENTITY.name}, {LEGAL_ENTITY.address}, NIP {LEGAL_ENTITY.nip} · {LEGAL_ENTITY.email} · {LEGAL_ENTITY.phone}
          </p>
          <p className="text-xs text-gray-500">AllGrafika.pl nie jest powiązana z Allegro.pl sp. z o.o. Allegro jest znakiem towarowym jego właściciela.</p>
          <p>
            Powered by{' '}
            <a href="https://jan-mat.pl" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              jan-mat.pl
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
