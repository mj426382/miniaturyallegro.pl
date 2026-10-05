import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import LegalDocument from '../components/LegalDocument'

export default function Regulamin() {
  return (
    <>
      <Helmet>
        <title>Regulamin | AllGrafika.pl</title>
        <meta name="description" content="Regulamin świadczenia usług serwisu AllGrafika.pl – generator grafik produktowych AI dla sprzedawców Allegro." />
        <link rel="canonical" href="https://allgrafika.pl/regulamin" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <LegalDocument doc="regulamin" />
        </main>
        <Footer />
      </div>
    </>
  )
}
