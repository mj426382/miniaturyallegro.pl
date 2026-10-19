import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import PageHead from '../components/PageHead'
import { ORG_ID, SITE_URL, WEBSITE_ID, formatPlDate } from '../data/site'
import { PARTNER_OG_IMAGE, PARTNER_PAGE_PATH, PARTNER_PAGE_UPDATED, PARTNER_PROGRAM as P } from '../data/partnerProgram'
import { pageTitle } from '../utils/pageTitle'

const TITLE = pageTitle(`Program partnerski – ${P.commissionPercent}% prowizji`)
const H1 = 'Program partnerski AllGrafika.pl'
const DESCRIPTION = `Polecaj AllGrafika.pl: Twoi czytelnicy dostają ${P.customerDiscountPercent}% rabatu z Twoim kodem, a Ty ${P.commissionPercent}% prowizji od ich opłaconych zakupów przez ${P.commissionMonths} miesięcy.`
const MAILTO = `mailto:${P.contactEmail}?subject=${encodeURIComponent('Program partnerski AllGrafika.pl')}`

function structuredData() {
  const url = `${SITE_URL}${PARTNER_PAGE_PATH}`
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      name: TITLE,
      headline: H1,
      description: DESCRIPTION,
      url,
      inLanguage: 'pl-PL',
      dateModified: PARTNER_PAGE_UPDATED,
      isPartOf: { '@id': WEBSITE_ID },
      publisher: { '@id': ORG_ID },
      primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE_URL}${PARTNER_OG_IMAGE}`, width: 1200, height: 630 },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'AllGrafika.pl', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Program partnerski', item: url },
      ],
    },
  ]
}

/**
 * Spec 24 / spec 10, AC-SEO-027: description of the partner (affiliate) programme for partners – not consumer terms.
 * The numbers come from src/data/partnerProgram.ts (equal to the backend defaults).
 */
export default function ProgramPartnerski() {
  return (
    <>
      <PageHead title={TITLE} description={DESCRIPTION} path={PARTNER_PAGE_PATH} image={PARTNER_OG_IMAGE} imageAlt={`${H1} – ${P.commissionPercent}% prowizji`} jsonLd={structuredData()} />

      <div className="min-h-screen bg-white">
        <Navbar />

        <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-16 text-center">
            <nav aria-label="Ścieżka" className="text-sm text-blue-100 mb-4">
              <Link to="/" className="hover:text-white underline-offset-2 hover:underline">
                AllGrafika.pl
              </Link>{' '}
              / <span>Program partnerski</span>
            </nav>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-4">{H1}</h1>
            <p className="text-base md:text-xl text-blue-50 max-w-2xl mx-auto mb-8">
              Piszesz dla sprzedawców internetowych? Twoi czytelnicy dostają <strong>{P.customerDiscountPercent}% rabatu</strong> na pakiety kredytów z Twoim kodem, a Ty{' '}
              <strong>{P.commissionPercent}% prowizji</strong> od tego, co naprawdę zapłacą – przez {P.commissionMonths} miesięcy.
            </p>
            <a href={MAILTO} className="inline-block bg-yellow-400 text-gray-900 font-bold px-8 py-4 rounded-xl text-lg hover:bg-yellow-300 transition-colors">
              Zgłoś się: {P.contactEmail}
            </a>
          </div>
        </section>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-12 text-gray-700 leading-relaxed">
          <p className="text-sm text-gray-600">
            Aktualizacja: <time dateTime={PARTNER_PAGE_UPDATED}>{formatPlDate(PARTNER_PAGE_UPDATED)}</time>
          </p>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Jak to działa</h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Dostajesz własny kod rabatowy, np. z nazwą Twojej strony.</li>
              <li>
                Czytelnik wpisuje kod na stronie płatności Stripe i płaci {P.customerDiscountPercent}% mniej za pakiet kredytów. Kredytów dostaje tyle samo, co bez kodu. Kod nie łączy się z pakietem
                powitalnym.
              </li>
              <li>Pierwsza płatność z Twoim kodem przypisuje konto klienta do Ciebie na {P.commissionMonths} miesięcy. Przypisanie jest jedno – liczy się pierwszy kod partnera.</li>
              <li>
                Od każdej opłaconej płatności tego klienta w tym okresie – pakiety kredytów i abonament – dostajesz {P.commissionPercent}% prowizji, także wtedy, gdy przy kolejnym zakupie nie wpisze
                kodu.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Prowizja i rozliczenie</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Prowizja to {P.commissionPercent}% kwoty faktycznie zapłaconej przez klienta (po rabacie). Zwroty i obciążenia zwrotne (chargeback) pomniejszają prowizję w miesiącu, w którym
                nastąpiły.
              </li>
              <li>Rozliczamy się co miesiąc kalendarzowy. Na początku miesiąca dostajesz zestawienie zamówień z poprzedniego miesiąca – bez danych osobowych klientów.</li>
              <li>Wypłata przelewem na podstawie Twojej faktury (albo rachunku), gdy saldo wynosi co najmniej {P.minPayoutZl} zł. Mniejsza kwota przechodzi na kolejny miesiąc.</li>
              <li>Prowizja dotyczy zakupów w AllGrafika.pl – nie płacimy za same rejestracje ani kliknięcia.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Zasady programu</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Bez spamu: żadnych niezamówionych e-maili, SMS-ów ani masowych komentarzy z kodem.</li>
              <li>Bez licytowania marki: nie kupujesz reklam (np. w Google Ads) na hasła z nazwą AllGrafika ani jej wariantami i literówkami.</li>
              <li>Bez zakupów własnych: zakupy z Twojego konta i za pomocą Twojego kodu nie dają prowizji.</li>
              <li>
                Oznaczone linki: płatne linki do AllGrafika.pl oznaczasz atrybutem <code className="bg-gray-100 px-1 rounded">rel=&quot;sponsored&quot;</code> (albo{' '}
                <code className="bg-gray-100 px-1 rounded">nofollow</code>), zgodnie z wytycznymi Google dotyczącymi linków.
              </li>
              <li>Uczciwy opis: piszesz o tym, co narzędzie naprawdę robi, i informujesz czytelników, że to współpraca reklamowa.</li>
              <li>Naruszenie zasad oznacza wyłączenie kodu i brak prowizji za zamówienia z naruszeniem.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Dla kogo jest program</h2>
            <p>
              Dla blogów, kanałów i newsletterów o sprzedaży internetowej, katalogów firm, szkół i kursów e-commerce oraz agencji, które obsługują sklepy internetowe i sprzedawców na marketplace’ach.
              Jeśli Twoi odbiorcy robią zdjęcia produktów, AllGrafika.pl oszczędza im czas i pieniądze na sesjach – zobacz, jak działa{' '}
              <Link to="/zdjecia-ai-do-ofert" className="text-blue-700 underline">
                generator zdjęć produktowych AI
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Jak dołączyć</h2>
            <p className="mb-4">Napisz do nas z adresem swojej strony lub kanału i krótkim opisem, jak chcesz polecać AllGrafika.pl. Odpowiadamy w ciągu kilku dni roboczych.</p>
            <a href={MAILTO} className="inline-block bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors">
              Napisz: {P.contactEmail}
            </a>
          </section>

          <section className="border-t border-gray-200 pt-6 text-sm text-gray-600">
            <h2 className="text-base font-semibold text-gray-800 mb-2">To opis programu, a nie regulamin dla klientów</h2>
            <p>
              Ta strona opisuje program partnerski dla osób i firm, które polecają AllGrafika.pl. Nie jest regulaminem dla klientów – zasady zakupów i kodów rabatowych opisuje{' '}
              <Link to="/regulamin" className="text-blue-700 underline">
                Regulamin
              </Link>{' '}
              (§ 4 ust. 12). Szczegóły współpracy, w tym stawki, okres prowizji i sposób rozliczenia, potwierdzamy w umowie z partnerem.
            </p>
          </section>
        </main>

        <Footer />
      </div>
    </>
  )
}
