import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import BeforeAfter from '../components/BeforeAfter'
import DemoWidget from '../components/DemoWidget'
import MobileAppTeaser from '../components/MobileAppTeaser'
import PageHead from '../components/PageHead'
import { blogIndex } from '../data/blogIndex'
import { samplePairs } from '../data/samples'
import { seoPages } from '../data/seoPages'
import { FREE_GRAPHICS, HIGHEST_PRICE, packages, perCredit, plans } from '../data/pricing'
import { APP_URL, ORG_ID, SITE_NAME, SITE_URL, SOFTWARE_ID, WEBSITE_ID } from '../data/site'
import { track, trackCta } from '../services/analytics'

// Spec 10, AC-SEO-008: e-commerce in general – the head term first, the title within 60 characters.
const PAGE_TITLE = 'Zdjęcia produktowe AI dla sklepów i ogłoszeń | AllGrafika.pl'
const PAGE_DESCRIPTION = 'Zdjęcia produktowe AI z fotki z telefonu: packshot na białym tle i aranżacje do sklepu internetowego i na marketplace (eBay, Amazon, OLX). 5 grafik gratis.'

const pains = [
  {
    icon: '👀',
    title: 'Kupujący przewija obok Twojego produktu',
    desc: 'Na liście produktów w sklepie, w Google i na marketplace widać dziesiątki podobnych ofert. Pierwsze, co je różni, to zdjęcie. Fotka z kuchennego blatu przegrywa z czystym packshotem.',
  },
  {
    icon: '💸',
    title: 'Sesja w studiu to koszt każdego ujęcia',
    desc: 'Packshot w studiu kosztuje średnio ok. 58 zł brutto za ujęcie (cennik KB.pl, 2026), a produkt potrzebuje kilku ujęć. Przy dziesiątkach SKU i nowościach co tydzień budżet i czas szybko się kończą.',
  },
  {
    icon: '🧩',
    title: 'Ogólne narzędzia AI zmieniają Twój produkt',
    desc: 'Generatory obrazów „upiększają” logo, zmieniają kształt i kolory. Dla sprzedawcy to reklamacja i zwrot, nie oszczędność.',
  },
]

const steps = [
  { number: '1', title: 'Prześlij zdjęcie', desc: 'Zwykła fotka z telefonu wystarczy (JPG, PNG, WebP, maks. 10 MB). Możesz przesłać do 50 zdjęć naraz.' },
  { number: '2', title: 'Wybierz style', desc: 'Zaczynasz od zestawu startowego 3 grafik: białe tło, wnętrze i ciemny luksus. Resztę stylów dogenerujesz, gdy zobaczysz pierwsze wyniki.' },
  {
    number: '3',
    title: 'Wyeksportuj i wstaw do sklepu lub oferty',
    desc: 'Kadrujesz, obracasz i poprawiasz grafiki, wybierasz preset eksportu (sklep internetowy, OLX, Vinted, eBay albo Amazon), kopiujesz opis dopasowany do platformy i pobierasz pliki, które sam dodajesz do sklepu lub ogłoszenia.',
  },
]

const features = [
  {
    icon: '🔒',
    title: 'Produkt zostaje wierny oryginałowi',
    desc: 'AI zmienia tylko tło, scenę i oświetlenie. Kształt, kolory, logo i napisy są chronione regułami integralności w każdej generacji. Nieudane generacje zwracamy automatycznie, a wadliwą grafikę zgłaszasz jednym kliknięciem – zwracamy kredyt.',
  },
  {
    icon: '🛒',
    title: 'Opis produktu pod platformę',
    desc: 'Do każdego zdjęcia z gotową grafiką dostajesz tytuł i opis dopasowany do miejsca sprzedaży – od opisu karty produktu w sklepie internetowym po krótkie ogłoszenie na OLX. Kopiujesz i wklejasz.',
  },
  {
    icon: '🎯',
    title: 'Płacisz za to, co wybierzesz',
    desc: 'Zestaw startowy to 3 style za 3 kredyty. Pozostałe z 19 stylów – także sezonowe i branżowe – dogenerujesz jednym kliknięciem. Infografiki i paczki ZIP są gratis.',
  },
  {
    icon: '📐',
    title: 'Presety eksportu pod sklep i marketplace',
    desc: 'Gotowe ustawienia proporcji, rozmiaru i formatu pod własny sklep internetowy, OLX, Vinted, eBay i Amazon oraz plakietki typu „-20%” lub „NOWOŚĆ” na kolejne zdjęcia – tam, gdzie zasady platformy na to pozwalają.',
  },
  {
    icon: '✏️',
    title: 'Własny styl i przeróbka',
    desc: 'Opisz po polsku scenę, dołącz zdjęcie referencyjne albo poproś o zmianę w gotowej grafice: „jaśniejsze tło”, „bez cienia”, „produkt bardziej z lewej”.',
  },
  {
    icon: '📦',
    title: 'Cały katalog naraz',
    desc: 'Prześlij do 50 zdjęć naraz. System wygeneruje zestaw startowy dla każdego produktu w kolejce, a Ty pobierasz gotowe pliki w paczce ZIP.',
  },
]

const styles = [
  { name: 'Białe tło', desc: 'Packshot na jednolitym białym tle – pod zdjęcie główne w sklepie i na marketplace.', starter: true },
  { name: 'Lifestyle – wnętrze', desc: 'Produkt w jasnym, nowoczesnym wnętrzu dopasowanym do kategorii.', starter: true },
  { name: 'Ciemny luksus', desc: 'Dramatyczne światło i ciemne tło – dla produktów premium.', starter: true },
  { name: 'Gradient', desc: 'Elegancki gradient w kolorystyce dopasowanej do produktu.', starter: false },
  { name: 'Produkt w użyciu', desc: 'Realistyczna scena pokazująca zastosowanie produktu.', starter: false },
  { name: 'Wiele ujęć', desc: 'Kolaż 3–4 ujęć z różnych stron w jednej grafice.', starter: false },
  { name: 'Sezonowe (5)', desc: 'Boże Narodzenie, Black Friday, Walentynki, Wielkanoc i Lato – w sezonie podpowiadamy je jako pierwsze.', starter: false },
  { name: 'Branżowe (8)', desc: 'Moda, elektronika, kosmetyki, dom i ogród, dziecięce, sport, motoryzacja oraz żywność.', starter: false },
  { name: 'Infografiki gratis', desc: 'Cechy z ikonami albo wymiary produktu na zdjęcie dodatkowe – z poprawnym polskim tekstem.', starter: false },
]

const cheapestPackage = packages.reduce((a, b) => (a.price / a.credits < b.price / b.credits ? a : b))
const cheapestPlan = plans.reduce((a, b) => (a.price / a.credits < b.price / b.credits ? a : b))

const faq = [
  {
    q: 'Czym są zdjęcia produktowe AI?',
    a: 'To zdjęcia produktu, w których tło, światło i scenę tworzy model AI, a sam produkt pochodzi z Twojego zdjęcia. Z jednej fotki z telefonu powstaje packshot na białym tle, aranżacja wnętrza albo scena sezonowa – do sklepu internetowego, na marketplace i do reklam.',
  },
  {
    q: 'Czy AI zmieni wygląd mojego produktu?',
    a: 'Nie powinno. Każda generacja zawiera reguły integralności produktu: zachowujemy kształt, proporcje, kolory, logo i napisy, a zmieniamy wyłącznie tło, scenę i oświetlenie. Modele generatywne nie są jednak idealne, dlatego przed publikacją porównaj grafikę z oryginałem, a nieudaną zgłoś – zwracamy kredyt.',
  },
  {
    q: 'Czy to działa w moim sklepie na Shopify, WooCommerce, Shoper lub PrestaShop?',
    a: 'Tak – pliki działają na każdej platformie sklepowej, bo AllGrafika nie wymaga integracji. Eksportujesz grafiki z presetem „Sklep internetowy” (proporcje 1:1, 4:3, 3:4 lub 16:9, 1600 px na dłuższym boku, JPG, PNG lub WebP) i wgrywasz je w panelu sklepu razem z opisem produktu.',
  },
  {
    q: 'Czy zdjęcia z AI spełnią wymagania eBay, Amazon, OLX i Vinted?',
    a: 'Styl „Białe tło” tworzy packshot na jednolitym białym tle, bez napisów, ramek i znaków wodnych – tego Amazon wymaga dla zdjęcia głównego, a eBay zabrania napisów i ramek na zdjęciach. Na Vinted obowiązują własne zdjęcia bez edycji, więc tam nie używaj grafik AI. Przed publikacją sprawdź gotową grafikę z aktualnymi zasadami miejsca, w którym sprzedajesz.',
  },
  {
    q: 'Ile to kosztuje?',
    a: `Pierwsze ${FREE_GRAPHICS} grafik jest darmowych i nie wymaga karty – wystarczy potwierdzić adres e-mail. Potem 1 kredyt = 1 grafika: pakiety jednorazowe od ${perCredit(cheapestPackage.price, cheapestPackage.credits)} do ${perCredit(packages[0].price, packages[0].credits)} za grafikę albo abonament od ${perCredit(cheapestPlan.price, cheapestPlan.credits)} za grafikę. Opis oferty dostajesz gratis do każdego zdjęcia z gotową grafiką, z 5 poprawkami AI w cenie (kolejne 15 poprawek to 1 kredyt). Kredyty nie wygasają, a do każdej płatności dostajesz fakturę.`,
  },
  {
    q: 'Czy AllGrafika publikuje zdjęcia w moim sklepie albo na platformie?',
    a: 'Nie. AllGrafika nie łączy się z kontami w sklepach ani na platformach sprzedażowych i niczego za Ciebie nie publikuje – nie podajesz nam żadnych haseł. Pobierasz zdjęcia (pojedynczo albo w paczce ZIP) i kopiujesz opis, a potem sam dodajesz je do sklepu lub ogłoszenia.',
  },
  {
    q: 'Jak długo trwa generowanie?',
    a: 'Zestaw startowy jest zwykle gotowy w ciągu 1–3 minut. Generowanie działa w tle, więc w tym czasie możesz przesyłać kolejne zdjęcia.',
  },
  {
    q: 'Czy mogę używać grafik komercyjnie?',
    a: 'Tak. Wygenerowane grafiki możesz wykorzystywać w sklepie internetowym, w ogłoszeniach na marketplace i w reklamach. Odpowiadasz za to, by przesłane zdjęcie było Twoje lub byś miał prawo z niego korzystać.',
  },
  {
    q: 'Co dzieje się z moimi zdjęciami?',
    a: 'Zdjęcia i grafiki są przechowywane w chmurze (Backblaze B2) i dostępne tylko dla Ciebie. Do wygenerowania grafiki zdjęcie jest przekazywane dostawcom modeli AI (Google, OpenAI), którzy zgodnie z warunkami API nie używają go do trenowania modeli. Konto wraz ze wszystkimi plikami możesz usunąć w każdej chwili.',
  },
]

const latestPosts = [...blogIndex].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 3)

const offers = [
  { '@type': 'Offer', price: '0', priceCurrency: 'PLN', description: `Pierwsze ${FREE_GRAPHICS} grafik za darmo` },
  ...packages.map((p) => ({ '@type': 'Offer', price: String(p.price), priceCurrency: 'PLN', description: `${p.name} – ${p.credits} kredytów (1 kredyt = 1 grafika)` })),
  ...plans.map((p) => ({
    '@type': 'Offer',
    price: String(p.price),
    priceCurrency: 'PLN',
    description: `Abonament ${p.name} – ${p.credits} grafik miesięcznie`,
    priceSpecification: { '@type': 'UnitPriceSpecification', price: String(p.price), priceCurrency: 'PLN', billingDuration: 'P1M', unitText: 'miesiąc' },
  })),
]

const structuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png`, width: 500, height: 500 },
    email: 'kontakt@allgrafika.pl',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: 'pl-PL',
    publisher: { '@id': ORG_ID },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': SOFTWARE_ID,
    name: 'AllGrafika – generator zdjęć produktowych AI',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web',
    url: APP_URL,
    description: PAGE_DESCRIPTION,
    inLanguage: 'pl-PL',
    publisher: { '@id': ORG_ID },
    offers: { '@type': 'AggregateOffer', priceCurrency: 'PLN', lowPrice: '0', highPrice: String(HIGHEST_PRICE), offerCount: offers.length, offers },
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
      <PageHead title={PAGE_TITLE} description={PAGE_DESCRIPTION} path="/" imageAlt="AllGrafika – zdjęcia produktowe AI dla sklepów internetowych i marketplace’ów" jsonLd={structuredData} />

      <div className="min-h-screen bg-white">
        <Navbar />

        {/* Hero – lead with the seller's outcome, then the proof (before/after, demo) */}
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
          <div className="absolute inset-0 opacity-10" aria-hidden="true">
            <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-300 rounded-full blur-3xl"></div>
          </div>
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-24 text-center">
            <p className="inline-block bg-white/20 text-white text-sm font-medium px-4 py-1.5 rounded-full mb-6">Dla sklepów internetowych i sprzedawców na marketplace’ach</p>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
              Zdjęcia produktowe AI <span className="block text-yellow-300">dla sklepów internetowych i marketplace’ów</span>
            </h1>
            <p className="text-xl text-blue-50 max-w-2xl mx-auto mb-10">
              Zamień zwykłe zdjęcie z telefonu na packshot na białym tle, aranżację wnętrza albo scenę sezonową – w kilka minut, bez fotografa i studia. Zmieniamy tło i światło, a kształt, kolory i
              logo produktu chronią reguły integralności.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#demo"
                onClick={() => {
                  track('hero_demo_click')
                  trackCta('hero', 'demo')
                }}
                className="bg-yellow-400 text-gray-900 font-bold px-8 py-4 rounded-xl text-lg hover:bg-yellow-300 transition-colors"
              >
                Sprawdź na swoim produkcie →
              </a>
              <a
                href={`${APP_URL}/register`}
                onClick={() => {
                  track('hero_register_click')
                  trackCta('hero', 'register')
                }}
                className="bg-blue-900/40 text-white font-medium px-8 py-4 rounded-xl text-lg hover:bg-blue-900/60 transition-colors border border-white/30"
              >
                Załóż konto – 5 grafik gratis
              </a>
            </div>
            <p className="mt-6 text-blue-100 text-sm">Bez karty • Bez konta do pierwszej próby • Gotowe w kilka minut</p>
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
                  <p className="text-gray-600 text-sm leading-relaxed">{p.desc}</p>
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
                Jak powstają <span className="text-blue-600">zdjęcia produktowe</span> w AllGrafika?
              </h2>
              <p className="text-gray-600 mt-4 text-lg">Trzy kroki od zdjęcia z telefonu do grafiki w sklepie i w ofercie</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map((step) => (
                <div key={step.number} className="text-center">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6">{step.number}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
                  <p className="text-gray-600">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Use cases – internal links to every landing page (AC-SEO-008) */}
        <section id="zastosowania" className="py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Gdzie wykorzystasz <span className="text-blue-600">zdjęcia produktowe</span>
              </h2>
              <p className="text-gray-600 mt-4 text-lg max-w-3xl mx-auto">
                We własnym sklepie internetowym, w Google Zakupach, na eBayu i Amazonie oraz w ogłoszeniach. Każde miejsce ma inne zasady – zebraliśmy je w poradnikach.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {seoPages.map((p) => (
                <Link key={p.path} to={p.path} className="block bg-white rounded-2xl p-5 border border-gray-200 hover:border-blue-400 hover:shadow-md transition">
                  <h3 className="font-semibold text-gray-900">{p.navLabel} →</h3>
                  <p className="text-sm text-gray-600 mt-1">{p.teaser}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Zrobione pod <span className="text-blue-600">sprzedaż online</span>, nie pod „ładne obrazki”
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f) => (
                <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="text-4xl mb-4" aria-hidden="true">
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Styles */}
        <section id="styles" className="py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                19 stylów grafik – <span className="text-blue-600">Ty decydujesz, które generujesz</span>
              </h2>
              <p className="text-gray-600 mt-4 text-lg">
                Zestaw startowy (oznaczony) to 3 kredyty. Pozostałe style dogenerujesz, kiedy zobaczysz pierwsze wyniki. Czym jest{' '}
                <Link to="/packshot-online" className="text-blue-700 underline underline-offset-2">
                  packshot
                </Link>{' '}
                i kiedy wybrać scenę, opisujemy w{' '}
                <Link to="/blog/najlepsze-style-zdjec-produktowych" className="text-blue-700 underline underline-offset-2">
                  poradniku o stylach zdjęć
                </Link>
                .
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {styles.map((s) => (
                <div key={s.name} className="bg-white rounded-2xl p-5 border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900">{s.name}</h3>
                    {s.starter && <span className="text-[10px] uppercase tracking-wide bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">zestaw startowy</span>}
                  </div>
                  <p className="text-sm text-gray-600">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing – single source: src/data/pricing.ts (AC-SEO-016) */}
        <section id="pricing" className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Prosty i przejrzysty <span className="text-blue-600">cennik</span>
              </h2>
              <p className="text-gray-600 mt-4">
                1 kredyt = 1 grafika, opis produktu gratis do każdej.{' '}
                <span className="font-medium text-blue-700">Pierwsze {FREE_GRAPHICS} grafik za darmo po rejestracji i potwierdzeniu e-maila.</span>
              </p>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-1">Abonament miesięczny</h3>
            <p className="text-sm text-gray-600 mb-5">Kredyty co miesiąc dla sklepów, które dodają produkty regularnie. Anulujesz w każdej chwili w panelu Stripe.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              {plans.map((plan) => (
                <div key={plan.name} className={`rounded-2xl p-8 ${plan.highlighted ? 'bg-blue-600 text-white ring-4 ring-blue-300' : 'bg-white border border-gray-200'}`}>
                  <h4 className={`text-xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>Plan {plan.name}</h4>
                  <div className="mt-2 mb-1">
                    <span className={`text-4xl font-extrabold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>{plan.price} zł</span>
                    <span className={`text-sm ml-2 ${plan.highlighted ? 'text-white' : 'text-gray-600'}`}>/ miesiąc · {plan.credits} grafik</span>
                  </div>
                  <p className={`text-xs mb-4 ${plan.highlighted ? 'text-white' : 'text-gray-600'}`}>{perCredit(plan.price, plan.credits)} / grafikę · ceny brutto</p>
                  <p className={`text-sm mb-6 ${plan.highlighted ? 'text-white' : 'text-gray-700'}`}>{plan.desc}</p>
                  <a
                    href={`${APP_URL}/credits`}
                    onClick={() => trackCta('pricing_plan', 'credits')}
                    className={`block text-center py-3 px-6 rounded-xl font-semibold transition-colors ${plan.highlighted ? 'bg-white text-blue-700 hover:bg-blue-50' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                  >
                    Wybierz plan {plan.name}
                  </a>
                </div>
              ))}
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-1">Pakiety jednorazowe</h3>
            <p className="text-sm text-gray-600 mb-5">Bez zobowiązań. Kredyty nie wygasają.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {packages.map((pkg) => (
                <div key={pkg.name} className="rounded-2xl p-6 bg-white border border-gray-200 flex flex-col">
                  <h4 className="text-lg font-bold text-gray-900">{pkg.name}</h4>
                  <p className="min-h-[1.75rem] mt-1 mb-2">
                    {pkg.saving && <span className="inline-block text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800">{pkg.saving}</span>}
                  </p>
                  <p>
                    <span className="text-3xl font-extrabold text-gray-900">{pkg.price} zł</span>
                    <span className="text-sm ml-2 text-gray-600">za {pkg.credits} kredytów</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-1 mb-5">{perCredit(pkg.price, pkg.credits)} / grafikę · ceny brutto</p>
                  <a
                    href={`${APP_URL}/credits`}
                    onClick={() => trackCta('pricing_package', 'credits')}
                    className="mt-auto block text-center py-2.5 px-6 rounded-xl font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
                  >
                    Kup {pkg.credits} kredytów
                  </a>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-gray-600 mt-6">Bezpieczne płatności przez Stripe (karta; BLIK dla pakietów jednorazowych) · Nieudane generacje zwracamy automatycznie</p>
          </div>
        </section>

        {/* Spec 18: mobile apps announcement */}
        <MobileAppTeaser />

        {/* FAQ – the same questions as the FAQPage JSON-LD (AC-SEO-008) */}
        <section id="faq" className="py-20 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Najczęstsze pytania o zdjęcia produktowe AI</h2>
            <div className="space-y-4">
              {faq.map((item) => (
                <details key={item.q} className="bg-white rounded-2xl border border-gray-100 p-6 group">
                  <summary className="font-semibold text-gray-900 cursor-pointer list-none flex justify-between items-center gap-4">
                    {item.q}
                    <span className="text-blue-600 group-open:rotate-45 transition-transform text-xl" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="text-gray-700 mt-4 leading-relaxed">{item.a}</p>
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
                <Link to="/blog" className="text-blue-700 font-medium hover:underline hidden sm:inline">
                  Wszystkie poradniki →
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {latestPosts.map((p) => (
                  <Link key={p.id} to={`/blog/${p.slug}`} className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow">
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">{p.category}</span>
                    <h3 className="font-semibold text-gray-900 mt-3 mb-2 leading-snug">{p.title}</h3>
                    <p className="text-gray-600 text-sm line-clamp-3">{p.excerpt}</p>
                  </Link>
                ))}
              </div>
              <Link to="/blog" className="sm:hidden inline-block mt-6 text-blue-700 font-medium hover:underline">
                Wszystkie poradniki →
              </Link>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Zrób pierwsze zdjęcia produktowe już dziś</h2>
            <p className="text-blue-50 text-lg mb-8">Sprawdź na jednym produkcie bez konta albo załóż darmowe konto i wygeneruj {FREE_GRAPHICS} grafik bez podawania karty.</p>
            <a
              href={`${APP_URL}/register`}
              onClick={() => {
                track('cta_register_click')
                trackCta('final_cta', 'register')
              }}
              className="inline-block bg-yellow-400 text-gray-900 font-bold px-10 py-4 rounded-xl text-lg hover:bg-yellow-300 transition-colors"
            >
              Rejestracja za darmo – {FREE_GRAPHICS} grafik gratis →
            </a>
          </div>
        </section>

        <Footer />
      </div>
    </>
  )
}
