import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import BeforeAfter from '../components/BeforeAfter'
import DemoWidget from '../components/DemoWidget'
import MobileAppTeaser from '../components/MobileAppTeaser'
import { blogIndex } from '../data/blogIndex'
import { samplePairs } from '../data/samples'
import { track } from '../services/analytics'

const SITE_URL = 'https://allgrafika.pl'
const APP_URL = 'https://app.allgrafika.pl'
const OG_IMAGE = `${SITE_URL}/og-image.png`

const PAGE_TITLE = 'Miniaturki Allegro z AI – lepsze zdjęcia ofert w kilka minut | AllGrafika.pl'
const PAGE_DESCRIPTION =
  'Oferta nie klika, bo konkurent ma ładniejsze zdjęcia? Prześlij zdjęcie z telefonu, a AI zrobi z niego profesjonalną miniaturkę Allegro. Produkt zostaje wierny oryginałowi. Wypróbuj bez konta, pierwsze 10 grafik za darmo.'

const pains = [
  {
    icon: '👀',
    title: 'Kupujący przewija obok Twojej oferty',
    desc: 'Na liście wyników widać dziesiątki niemal identycznych produktów. Jedyne, co różni Twoją ofertę od konkurencji, to miniaturka. Zdjęcie z kuchennego blatu przegrywa z packshotem.',
  },
  {
    icon: '💸',
    title: 'Fotograf to 200–500 zł za produkt i tydzień czekania',
    desc: 'Przy kilkudziesięciu SKU sesja jest poza budżetem, a nowe produkty i tak dochodzą co tydzień. Grafik freelancer liczy od 30 zł za jedno przerobione zdjęcie.',
  },
  {
    icon: '🧩',
    title: 'Ogólne narzędzia AI zmieniają Twój produkt',
    desc: 'Generatory obrazów „upiększają” logo, zmieniają kształt i kolory. Dla sprzedawcy to reklamacja i zwrot, nie oszczędność.',
  },
]

const steps = [
  { number: '1', title: 'Prześlij zdjęcie', desc: 'Zwykła fotka z telefonu wystarczy (JPG, PNG, WebP, maks. 10 MB). Możesz też pobrać zdjęcia prosto ze swoich ofert Allegro.' },
  { number: '2', title: 'Wybierz style', desc: 'Zaczynasz od zestawu startowego 3 grafik. Dodatkowe wskazówki wpisujesz po polsku, resztę stylów dogenerujesz, gdy zobaczysz pierwsze wyniki.' },
  {
    number: '3',
    title: 'Pobierz albo opublikuj',
    desc: 'Kadrujesz, obracasz i poprawiasz grafiki w formatach Allegro (1:1, galeria 4:3, baner Ads, plakietka promocyjna), dopisujesz opis oferty pod SEO i publikujesz jednym kliknięciem do oferty.',
  },
]

const features = [
  {
    icon: '🔒',
    title: 'Produkt zostaje wierny oryginałowi',
    desc: 'AI zmienia tylko tło, scenę i oświetlenie. Kształt, kolory, logo i napisy są chronione twardymi regułami w każdej generacji. Nieudane generacje zwracamy automatycznie, a wadliwą grafikę zgłaszasz jednym kliknięciem – zwracamy kredyt.',
  },
  {
    icon: '🛒',
    title: 'Integracja z Allegro',
    desc: 'Połącz konto sprzedawcy, pobierz zdjęcia z ofert, wygeneruj grafiki i ustaw je jako zdjęcie główne lub dodaj do galerii, a tytuł i opis wyślij do oferty jednym kliknięciem.',
  },
  {
    icon: '🎯',
    title: 'Płacisz za to, co wybierzesz',
    desc: 'Zestaw startowy to 3 style za 3 kredyty. Pozostałe z 19 stylów – także sezonowe i branżowe – dogenerujesz jednym kliknięciem. Infografiki i paczki ZIP są gratis.',
  },
  {
    icon: '📐',
    title: 'Formaty gotowe pod Allegro',
    desc: 'Zdjęcie główne 1:1, galeria 4:3, baner 16:9 pod Allegro Ads, PNG w wysokiej jakości i plakietki typu „-20%” lub „NOWOŚĆ” na kolejne zdjęcia.',
  },
  {
    icon: '✏️',
    title: 'Własny styl i przeróbka',
    desc: 'Opisz po polsku scenę, dołącz zdjęcie referencyjne albo poproś o zmianę w gotowej grafice: „jaśniejsze tło”, „bez cienia”, „produkt bardziej z lewej”.',
  },
  {
    icon: '📦',
    title: 'Hurtem do 50 zdjęć',
    desc: 'Prześlij do 50 zdjęć naraz. System wygeneruje zestaw startowy dla każdego produktu w kolejce, a Ty wracasz po gotowe pliki.',
  },
]

const styles = [
  { name: 'Białe tło', desc: 'Packshot zgodny z wymaganiami zdjęcia głównego Allegro.', starter: true },
  { name: 'Lifestyle – wnętrze', desc: 'Produkt w jasnym, nowoczesnym wnętrzu dopasowanym do kategorii.', starter: true },
  { name: 'Ciemny luksus', desc: 'Dramatyczne światło i ciemne tło – dla produktów premium.', starter: true },
  { name: 'Gradient', desc: 'Elegancki gradient w kolorystyce dopasowanej do produktu.', starter: false },
  { name: 'Produkt w użyciu', desc: 'Realistyczna scena pokazująca zastosowanie produktu.', starter: false },
  { name: 'Wiele ujęć', desc: 'Kolaż 3–4 ujęć z różnych stron w jednej grafice.', starter: false },
  { name: 'Sezonowe (5)', desc: 'Boże Narodzenie, Black Friday, Walentynki, Wielkanoc i Lato – w sezonie podpowiadamy je jako pierwsze.', starter: false },
  { name: 'Branżowe (8)', desc: 'Moda, elektronika, kosmetyki, dom i ogród, dziecięce, sport, motoryzacja oraz żywność.', starter: false },
  { name: 'Infografiki gratis', desc: 'Cechy z ikonami albo wymiary produktu na zdjęcie dodatkowe – z poprawnym polskim tekstem.', starter: false },
]

const packages = [
  { name: 'Pakiet Startowy', credits: 5, price: '10', perCredit: '2,00 zł / grafikę', saving: null },
  { name: 'Pakiet Popularny', credits: 15, price: '28', perCredit: '1,87 zł / grafikę', saving: 'Oszczędzasz 2 zł vs. pakiet 5', highlighted: true },
  { name: 'Pakiet Pro', credits: 40, price: '70', perCredit: '1,75 zł / grafikę', saving: 'Oszczędzasz 10 zł vs. pakiet 5' },
]

const plans = [
  { name: 'Start', price: '49', credits: 40, perCredit: '1,23 zł / grafikę', desc: 'Dla sklepów dodających kilka produktów tygodniowo.' },
  { name: 'Pro', price: '149', credits: 150, perCredit: '0,99 zł / grafikę', desc: 'Dla sklepów z setkami SKU i hurtowym przesyłaniem.', highlighted: true },
]

const faq = [
  {
    q: 'Czy miniaturki wygenerowane przez AI są zgodne z wymaganiami Allegro?',
    a: 'Styl „Białe tło” tworzy packshot na jednolitym białym tle, bez napisów, ramek i znaków wodnych, tak jak wymaga tego Allegro dla zdjęcia głównego. Pozostałe style i plakietki promocyjne stosuj na kolejnych zdjęciach galerii. Zawsze zweryfikuj gotową grafikę z aktualnym regulaminem Allegro przed publikacją.',
  },
  {
    q: 'Czy AI zmieni wygląd mojego produktu?',
    a: 'Nie. Każda generacja zawiera twarde reguły integralności produktu: zachowujemy kształt, proporcje, kolory, logo i napisy, a zmieniamy wyłącznie tło, scenę i oświetlenie. Modele generatywne nie są jednak idealne, dlatego przed publikacją porównaj grafikę z oryginałem i oceń ją kciukiem, a nieudane generacje ponów bezpłatnie.',
  },
  {
    q: 'Ile to kosztuje?',
    a: 'Pierwsze 10 grafik jest darmowych i nie wymaga karty – wystarczy potwierdzić adres e-mail. Do każdej płatności dostajesz fakturę (NIP podajesz w formularzu płatności). Potem 1 kredyt = 1 grafika: pakiety jednorazowe od 1,75 zł do 2 zł za grafikę albo abonament miesięczny od 0,99 zł za grafikę. Opis oferty pod SEO Allegro dostajesz gratis do każdego zdjęcia z gotową grafiką, z 5 poprawkami AI w cenie (kolejne 15 poprawek to 1 kredyt). Kredyty nie wygasają, a nieudane generacje są zwracane automatycznie.',
  },
  {
    q: 'Jak działa integracja z Allegro?',
    a: 'W aplikacji łączysz konto sprzedawcy przez oficjalną autoryzację Allegro (nie podajesz nam hasła). Potem przeglądasz swoje oferty, pobierasz z nich zdjęcie główne, generujesz grafiki i publikujesz je do oferty jako zdjęcie główne lub do galerii, a wygenerowany tytuł i opis wysyłasz do oferty jednym kliknięciem. Dostęp możesz cofnąć w każdej chwili.',
  },
  {
    q: 'Jak długo trwa generowanie?',
    a: 'Zestaw startowy jest zwykle gotowy w ciągu 1–3 minut. Generowanie działa w tle, więc w tym czasie możesz przesyłać kolejne zdjęcia.',
  },
  {
    q: 'Czy mogę używać grafik komercyjnie?',
    a: 'Tak. Wygenerowane grafiki możesz wykorzystywać bez ograniczeń w ofertach na Allegro, w sklepie internetowym i w reklamach. Odpowiadasz za to, by przesłane zdjęcie było Twoje lub byś miał prawo z niego korzystać.',
  },
  {
    q: 'Co dzieje się z moimi zdjęciami?',
    a: 'Zdjęcia i grafiki są przechowywane w chmurze (Backblaze B2) i dostępne tylko dla Ciebie. Do wygenerowania grafiki zdjęcie jest przekazywane dostawcom modeli AI (Google, OpenAI), którzy zgodnie z warunkami API nie używają go do trenowania modeli. Konto wraz ze wszystkimi plikami możesz usunąć w każdej chwili.',
  },
]

const latestPosts = [...blogIndex].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 3)

const structuredData = [
  { '@context': 'https://schema.org', '@type': 'Organization', name: 'AllGrafika.pl', url: SITE_URL, logo: `${SITE_URL}/logo.png`, email: 'kontakt@allgrafika.pl' },
  { '@context': 'https://schema.org', '@type': 'WebSite', name: 'AllGrafika.pl', url: SITE_URL, inLanguage: 'pl-PL' },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AllGrafika – generator miniaturek Allegro AI',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web',
    url: APP_URL,
    description: PAGE_DESCRIPTION,
    offers: [
      { '@type': 'Offer', price: '0', priceCurrency: 'PLN', description: 'Pierwsze 10 grafik za darmo' },
      { '@type': 'Offer', price: '10', priceCurrency: 'PLN', description: 'Pakiet 5 kredytów' },
      { '@type': 'Offer', price: '28', priceCurrency: 'PLN', description: 'Pakiet 15 kredytów' },
      { '@type': 'Offer', price: '70', priceCurrency: 'PLN', description: 'Pakiet 40 kredytów' },
      { '@type': 'Offer', price: '49', priceCurrency: 'PLN', description: 'Abonament Start – 40 grafik miesięcznie' },
      { '@type': 'Offer', price: '149', priceCurrency: 'PLN', description: 'Abonament Pro – 150 grafik miesięcznie' },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
  },
]

export default function Home() {
  return (
    <>
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <link rel="canonical" href={`${SITE_URL}/`} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={PAGE_TITLE} />
        <meta property="og:description" content={PAGE_DESCRIPTION} />
        <meta property="og:url" content={`${SITE_URL}/`} />
        <meta property="og:site_name" content="AllGrafika.pl" />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="AllGrafika – generator miniaturek Allegro AI" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={PAGE_TITLE} />
        <meta name="twitter:description" content={PAGE_DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE} />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <div className="min-h-screen bg-white">
        <Navbar />

        {/* Hero – lead with the seller's pain, not with styles */}
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
          <div className="absolute inset-0 opacity-10" aria-hidden="true">
            <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-300 rounded-full blur-3xl"></div>
          </div>
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-24 text-center">
            <span className="inline-block bg-white/20 text-white text-sm font-medium px-4 py-1.5 rounded-full mb-6">Dla sprzedawców Allegro, którzy nie mają czasu i budżetu na sesje zdjęciowe</span>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
              Twoja oferta nie klika?
              <br />
              <span className="text-yellow-300">Zacznij od miniaturki.</span>
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-10">
              Prześlij zwykłe zdjęcie z telefonu, a AI zrobi z niego profesjonalną miniaturkę Allegro w kilka minut. Zmieniamy tylko tło i światło, a kształt, kolory i logo produktu są chronione
              regułami integralności. Bez fotografa, bez grafika, bez czekania.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#demo" onClick={() => track('hero_demo_click')} className="bg-yellow-400 text-gray-900 font-bold px-8 py-4 rounded-xl text-lg hover:bg-yellow-300 transition-colors">
                Sprawdź na swoim produkcie →
              </a>
              <a
                href={`${APP_URL}/register`}
                onClick={() => track('hero_register_click')}
                className="bg-white/10 text-white font-medium px-8 py-4 rounded-xl text-lg hover:bg-white/20 transition-colors border border-white/20"
              >
                Załóż konto – 10 grafik gratis
              </a>
            </div>
            <p className="mt-6 text-blue-200 text-sm">Bez karty • Bez konta do pierwszej próby • Gotowe w kilka minut</p>
          </div>
        </section>

        {/* Pain points */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-12">
              Dlaczego dobre produkty <span className="text-blue-600">przegrywają na liście wyników</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pains.map((p) => (
                <div key={p.title} className="bg-white rounded-2xl p-6 border border-gray-100">
                  <div className="text-4xl mb-4" aria-hidden="true">
                    {p.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{p.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <BeforeAfter pairs={samplePairs} />

        <DemoWidget />

        {/* How it works */}
        <section id="how-it-works" className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Jak powstają <span className="text-blue-600">miniaturki na Allegro</span> w AllGrafika?
              </h2>
              <p className="text-gray-500 mt-4 text-lg">Trzy kroki od zdjęcia z telefonu do grafiki w ofercie</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map((step) => (
                <div key={step.number} className="text-center">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6">{step.number}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
                  <p className="text-gray-500">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Zrobione pod <span className="text-blue-600">sprzedaż na Allegro</span>, nie pod „ładne obrazki”
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f) => (
                <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="text-4xl mb-4" aria-hidden="true">
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Styles */}
        <section id="styles" className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                19 stylów grafik – <span className="text-blue-600">Ty decydujesz, które generujesz</span>
              </h2>
              <p className="text-gray-500 mt-4 text-lg">Zestaw startowy (oznaczony) to 3 kredyty. Pozostałe style dogenerujesz, kiedy zobaczysz pierwsze wyniki.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {styles.map((s) => (
                <div key={s.name} className="bg-white rounded-2xl p-5 border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900">{s.name}</h3>
                    {s.starter && <span className="text-[10px] uppercase tracking-wide bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">zestaw startowy</span>}
                  </div>
                  <p className="text-sm text-gray-500">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Prosty i przejrzysty <span className="text-blue-600">cennik</span>
              </h2>
              <p className="text-gray-500 mt-4">
                1 kredyt = 1 grafika, opis oferty pod SEO gratis do każdej. <span className="font-medium text-blue-600">Pierwsze 10 grafik za darmo po rejestracji i potwierdzeniu e-maila.</span>
              </p>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-1">Abonament miesięczny</h3>
            <p className="text-sm text-gray-500 mb-5">Najtaniej za grafikę. Kredyty co miesiąc, anulujesz w każdej chwili w panelu Stripe.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              {plans.map((plan) => (
                <div key={plan.name} className={`rounded-2xl p-8 ${plan.highlighted ? 'bg-blue-600 text-white ring-4 ring-blue-300' : 'bg-white border border-gray-200'}`}>
                  <h4 className={`text-xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>Plan {plan.name}</h4>
                  <div className="mt-2 mb-1">
                    <span className={`text-4xl font-extrabold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>{plan.price} zł</span>
                    <span className={`text-sm ml-2 ${plan.highlighted ? 'text-blue-200' : 'text-gray-500'}`}>/ miesiąc · {plan.credits} grafik</span>
                  </div>
                  <p className={`text-xs mb-4 ${plan.highlighted ? 'text-blue-200' : 'text-gray-400'}`}>{plan.perCredit} · ceny brutto</p>
                  <p className={`text-sm mb-6 ${plan.highlighted ? 'text-blue-100' : 'text-gray-600'}`}>{plan.desc}</p>
                  <a
                    href={`${APP_URL}/credits`}
                    className={`block text-center py-3 px-6 rounded-xl font-semibold transition-colors ${plan.highlighted ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                  >
                    Wybierz plan {plan.name}
                  </a>
                </div>
              ))}
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-1">Pakiety jednorazowe</h3>
            <p className="text-sm text-gray-500 mb-5">Bez zobowiązań. Kredyty nie wygasają.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {packages.map((pkg) => (
                <div key={pkg.name} className="rounded-2xl p-6 bg-white border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-lg font-bold text-gray-900">{pkg.name}</h4>
                    {pkg.saving && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">{pkg.saving}</span>}
                  </div>
                  <span className="text-3xl font-extrabold text-gray-900">{pkg.price} zł</span>
                  <span className="text-sm ml-2 text-gray-500">za {pkg.credits} kredytów</span>
                  <p className="text-xs text-gray-400 mt-1 mb-5">{pkg.perCredit} · ceny brutto</p>
                  <a href={`${APP_URL}/credits`} className="block text-center py-2.5 px-6 rounded-xl font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors">
                    Kup {pkg.credits} kredytów
                  </a>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-gray-400 mt-6">Bezpieczne płatności przez Stripe (karta; BLIK dla pakietów jednorazowych) · Nieudane generacje zwracamy automatycznie</p>
          </div>
        </section>

        {/* Spec 18: mobile apps announcement */}
        <MobileAppTeaser />

        {/* FAQ */}
        <section id="faq" className="py-20 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Najczęstsze pytania</h2>
            <div className="space-y-4">
              {faq.map((item) => (
                <details key={item.q} className="bg-white rounded-2xl border border-gray-100 p-6 group">
                  <summary className="font-semibold text-gray-900 cursor-pointer list-none flex justify-between items-center gap-4">
                    {item.q}
                    <span className="text-blue-600 group-open:rotate-45 transition-transform text-xl" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="text-gray-600 mt-4 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Latest from the blog */}
        {latestPosts.length > 0 && (
          <section className="py-20">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <div className="flex items-end justify-between mb-8">
                <h2 className="text-3xl font-bold text-gray-900">Z bloga: poradniki dla sprzedawców</h2>
                <Link to="/blog" className="text-blue-600 font-medium hover:underline hidden sm:inline">
                  Wszystkie artykuły →
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {latestPosts.map((p) => (
                  <Link key={p.id} to={`/blog/${p.slug}`} className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow">
                    <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">{p.category}</span>
                    <h3 className="font-semibold text-gray-900 mt-3 mb-2 leading-snug">{p.title}</h3>
                    <p className="text-gray-500 text-sm line-clamp-3">{p.excerpt}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Zrób pierwsze miniaturki Allegro już dziś</h2>
            <p className="text-blue-100 text-lg mb-8">Sprawdź na jednym produkcie bez konta albo załóż darmowe konto i wygeneruj 10 grafik bez podawania karty.</p>
            <a
              href={`${APP_URL}/register`}
              onClick={() => track('cta_register_click')}
              className="inline-block bg-yellow-400 text-gray-900 font-bold px-10 py-4 rounded-xl text-lg hover:bg-yellow-300 transition-colors"
            >
              Rejestracja za darmo – 10 grafik gratis →
            </a>
          </div>
        </section>

        <Footer />
      </div>
    </>
  )
}
