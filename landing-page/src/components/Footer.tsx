import { Link } from 'react-router-dom'
import { LEGAL_ENTITY } from '../legal/entity'
import { seoPages } from '../data/seoPages'
import { APP_URL } from '../data/site'
import { PARTNER_PAGE_PATH } from '../data/partnerProgram'
import { PHOTO_CHECKER_LABEL, PHOTO_CHECKER_PATH } from '../data/photoChecker'
import { CONSENT_CONFIGURED, openCookieSettings } from '../consent/googleTag'

const CONTACT_EMAIL = 'kontakt@allgrafika.pl'

/** Column titles are plain text, not headings – the footer is navigation, not part of the page outline (AC-SEO-019). */
export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div>
            <Link to="/" className="text-white font-bold text-xl">
              AllGrafika.pl
            </Link>
            <p className="mt-3 text-sm leading-relaxed">
              Generator zdjęć produktowych AI dla sklepów internetowych i sprzedawców na marketplace’ach. Prześlij zdjęcie z telefonu, wybierz style i pobierz gotowe grafiki w kilka minut.
            </p>
          </div>

          <nav aria-label="Zastosowania">
            <p className="text-white font-semibold mb-4">Zastosowania</p>
            <ul className="space-y-2 text-sm">
              {seoPages.map((p) => (
                <li key={p.path}>
                  <Link to={p.path} className="hover:text-white transition-colors">
                    {p.navLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Produkt">
            <p className="text-white font-semibold mb-4">Produkt</p>
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
              <li>
                <Link to="/blog" className="hover:text-white transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link to={PHOTO_CHECKER_PATH} className="hover:text-white transition-colors">
                  {PHOTO_CHECKER_LABEL}
                </Link>
              </li>
              <li>
                <a href={`${APP_URL}/login`} className="hover:text-white transition-colors">
                  Logowanie
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Firma">
            <p className="text-white font-semibold mb-4">Firma</p>
            <ul className="space-y-2 text-sm">
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white transition-colors">
                  Kontakt: {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <Link to={PARTNER_PAGE_PATH} className="hover:text-white transition-colors">
                  Program partnerski
                </Link>
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
              {CONSENT_CONFIGURED && (
                <li>
                  <button type="button" onClick={openCookieSettings} className="hover:text-white transition-colors">
                    Ustawienia cookies
                  </button>
                </li>
              )}
            </ul>
          </nav>
        </div>

        <div className="border-t border-gray-800 pt-8 text-sm text-center space-y-2">
          <p>© {new Date().getFullYear()} AllGrafika.pl · Wszelkie prawa zastrzeżone</p>
          <p className="text-xs text-gray-400">
            {LEGAL_ENTITY.name}, {LEGAL_ENTITY.address}, NIP {LEGAL_ENTITY.nip} · {LEGAL_ENTITY.email} · {LEGAL_ENTITY.phone}
          </p>
          <p className="text-xs text-gray-400">
            Nazwy platform (OLX, Vinted, eBay, Amazon, Shopify, WooCommerce, Shoper, PrestaShop, Google) są znakami towarowymi ich właścicieli i służą wyłącznie do opisu zgodności plików;
            AllGrafika.pl nie jest z nimi powiązana.
          </p>
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
