import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

const features = [
  {
    icon: '⚡',
    title: '12 wariantów w minutę',
    desc: 'Generuj 12 różnych stylów miniaturek dla każdego produktu jednym kliknięciem.',
  },
  {
    icon: '🎨',
    title: 'Profesjonalne style',
    desc: 'Białe tło, lifestyle, luksusowe, minimalistyczne i wiele więcej dopasowanych do Allegro.',
  },
  {
    icon: '🤖',
    title: 'Technologia AI (Gemini)',
    desc: 'Google Gemini AI analizuje Twój produkt i tworzy optymalne opisy dla każdego stylu.',
  },
  {
    icon: '☁️',
    title: 'Bezpieczne przechowywanie',
    desc: 'Wszystkie zdjęcia przechowywane w chmurze. Dostępne zawsze i wszędzie.',
  },
  {
    icon: '📱',
    title: 'Prosty w obsłudze',
    desc: 'Prześlij zdjęcie, wybierz styl, pobierz miniaturkę. Tak proste!',
  },
  {
    icon: '📈',
    title: 'Zwiększ sprzedaż',
    desc: 'Lepsze zdjęcia = więcej kliknięć = więcej sprzedaży na Allegro.',
  },
]

const steps = [
  { number: '1', title: 'Prześlij zdjęcie', desc: 'Załaduj zdjęcie swojego produktu (JPG, PNG, WebP)' },
  { number: '2', title: 'AI generuje warianty', desc: 'Nasz algorytm tworzy 12 profesjonalnych miniaturek w różnych stylach' },
  { number: '3', title: 'Pobierz i publikuj', desc: 'Wybierz najlepszą miniaturkę i wylistuj produkt na Allegro' },
]

const testimonials = [
  {
    name: 'Katarzyna M.',
    role: 'Sprzedawca Allegro • Elektronika',
    text: 'Po zmianie miniaturek moja sprzedaż wzrosła o 40%. Narzędzie jest niesamowite, oszczędza mnóstwo czasu i pieniędzy.',
  },
  {
    name: 'Piotr K.',
    role: 'Sprzedawca Allegro • Odzież',
    text: 'Generuję miniaturki dla 50 produktów dziennie. Bez tego narzędzia nie wyobrażam sobie pracy.',
  },
  {
    name: 'Anna W.',
    role: 'Sprzedawca Allegro • Dom i ogród',
    text: 'Profesjonalne zdjęcia produktowe kosztowały mnie 200 zł za sztukę. Teraz mam je w sekundy za ułamek ceny!',
  },
]

const pricingPlans = [
  {
    name: 'Starter',
    price: '0',
    period: 'za darmo',
    features: ['10 generacji miesięcznie', '12 stylów na generację', 'Przechowywanie 30 dni', 'Podstawowe wsparcie'],
    cta: 'Zacznij za darmo',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '49',
    period: 'miesięcznie',
    features: ['200 generacji miesięcznie', '12 stylów na generację', 'Nieograniczone przechowywanie', 'Priorytetowe wsparcie', 'API dostęp'],
    cta: 'Wybierz Pro',
    highlighted: true,
  },
  {
    name: 'Business',
    price: '149',
    period: 'miesięcznie',
    features: ['Nieograniczone generacje', '12 stylów na generację', 'Nieograniczone przechowywanie', '24/7 wsparcie', 'API dostęp', 'Własny branding'],
    cta: 'Wybierz Business',
    highlighted: false,
  },
]

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Miniatury Allegro - Generator miniaturek produktowych AI | MiniaturyAllegro.pl</title>
        <meta name="description" content="Generuj profesjonalne miniaturki Allegro w kilka sekund. 12 stylów na każdy produkt. Zwiększ CTR i sprzedaż dzięki AI. Wypróbuj za darmo!" />
        <meta name="keywords" content="miniaturki allegro, zdjęcia allegro, zdjęcia produktowe allegro, generator miniaturek allegro, AI miniaturki" />
        <meta property="og:title" content="Miniatury Allegro - Generator miniaturek produktowych AI" />
        <meta property="og:description" content="Generuj profesjonalne miniaturki Allegro w kilka sekund dzięki AI. 12 różnych stylów dla każdego produktu." />
        <link rel="canonical" href="https://miniaturyallegro.pl" />
      </Helmet>

      <div className="min-h-screen bg-white">
        <Navbar />

        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-300 rounded-full blur-3xl"></div>
          </div>
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-24 text-center">
            <span className="inline-block bg-white/20 text-white text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              🚀 Powered by Google Gemini AI
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
              Profesjonalne<br />
              <span className="text-yellow-300">miniaturki Allegro</span><br />
              w kilka sekund
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-10">
              Prześlij zdjęcie produktu i wygeneruj <strong className="text-white">12 wariantów miniaturek</strong> w różnych stylach.
              Zwiększ CTR nawet o 40% i sprzedawaj więcej na Allegro.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://app.miniaturyallegro.pl/register"
                className="bg-yellow-400 text-gray-900 font-bold px-8 py-4 rounded-xl text-lg hover:bg-yellow-300 transition-colors"
              >
                Wypróbuj za darmo →
              </a>
              <a
                href="#features"
                className="bg-white/10 text-white font-medium px-8 py-4 rounded-xl text-lg hover:bg-white/20 transition-colors border border-white/20"
              >
                Zobacz jak działa
              </a>
            </div>
            <p className="mt-6 text-blue-200 text-sm">
              Bez karty kredytowej • 10 generacji za darmo • Gotowe w 60 sekund
            </p>
          </div>
        </section>

        {/* Social proof */}
        <section className="bg-gray-50 border-b border-gray-100 py-6">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-500">
              <span>⭐ 4.9/5 ocena</span>
              <span>•</span>
              <span>🛍️ 2,400+ sprzedawców Allegro</span>
              <span>•</span>
              <span>🖼️ 180,000+ wygenerowanych miniaturek</span>
              <span>•</span>
              <span>📈 Średni wzrost CTR: 38%</span>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Jak działają <span className="text-blue-600">miniaturki Allegro AI</span>?
            </h2>
            <p className="text-gray-500 mt-4 text-lg">
              Trzy proste kroki do profesjonalnych zdjęć produktowych
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="text-center">
                <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Wszystko czego potrzebujesz do<br />
                <span className="text-blue-600">zdjęć produktowych na Allegro</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f) => (
                <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="text-4xl mb-4">{f.icon}</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">
              Co mówią nasi sprzedawcy?
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex mb-3">
                  {[1,2,3,4,5].map((s) => (
                    <span key={s} className="text-yellow-400">★</span>
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                  <p className="text-gray-400 text-xs">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Prosty i przejrzysty <span className="text-blue-600">cennik</span>
              </h2>
              <p className="text-gray-500 mt-4">Zacznij za darmo, skaluj kiedy potrzebujesz</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-2xl p-8 ${
                    plan.highlighted
                      ? 'bg-blue-600 text-white ring-4 ring-blue-300'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <h3 className={`text-xl font-bold mb-2 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    {plan.name}
                  </h3>
                  <div className="mb-6">
                    <span className={`text-4xl font-extrabold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                      {plan.price === '0' ? 'Gratis' : `${plan.price} zł`}
                    </span>
                    {plan.price !== '0' && (
                      <span className={`text-sm ml-1 ${plan.highlighted ? 'text-blue-200' : 'text-gray-500'}`}>
                        /{plan.period}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className={`flex items-center gap-2 text-sm ${plan.highlighted ? 'text-blue-100' : 'text-gray-600'}`}>
                        <span className={plan.highlighted ? 'text-yellow-300' : 'text-green-500'}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="https://app.miniaturyallegro.pl/register"
                    className={`block text-center py-3 px-6 rounded-xl font-semibold transition-colors ${
                      plan.highlighted
                        ? 'bg-white text-blue-600 hover:bg-blue-50'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {plan.cta}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Zacznij generować miniaturki Allegro już dziś
            </h2>
            <p className="text-blue-100 text-lg mb-8">
              Dołącz do tysięcy sprzedawców którzy zwiększyli swoją sprzedaż dzięki profesjonalnym zdjęciom produktowym.
            </p>
            <a
              href="https://app.miniaturyallegro.pl/register"
              className="inline-block bg-yellow-400 text-gray-900 font-bold px-10 py-4 rounded-xl text-lg hover:bg-yellow-300 transition-colors"
            >
              Wypróbuj za darmo – 10 generacji gratis →
            </a>
          </div>
        </section>

        <Footer />
      </div>
    </>
  )
}
