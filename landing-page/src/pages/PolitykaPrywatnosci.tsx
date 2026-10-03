import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import PolitykaContent from '../legal/PolitykaContent'

export default function PolitykaPrywatnosci() {
  return (
    <>
      <Helmet>
        <title>Polityka prywatności | AllGrafika.pl</title>
        <meta name="description" content="Polityka prywatności serwisu AllGrafika.pl – jak przetwarzamy dane osobowe i pliki graficzne użytkowników." />
        <link rel="canonical" href="https://allgrafika.pl/polityka-prywatnosci" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <PolitykaContent />
        </main>
        <Footer />
      </div>
    </>
  )
}
