import { Helmet } from 'react-helmet-async'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function PolitykaPrywatnosci() {
  return (
    <>
      <Helmet>
        <title>Polityka prywatności – AllGrafika.pl</title>
        <meta name="description" content="Polityka prywatności serwisu AllGrafika.pl – informacje o przetwarzaniu danych osobowych i plików graficznych." />
        <link rel="canonical" href="https://allgrafika.pl/polityka-prywatnosci" />
      </Helmet>

      <div className="min-h-screen bg-white">
        <Navbar />

        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Polityka prywatności</h1>
          <p className="text-sm text-gray-400 mb-10">Ostatnia aktualizacja: 11 maja 2025 r.</p>

          <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Administrator danych</h2>
              <p>
                Administratorem Twoich danych osobowych jest właściciel i operator serwisu <strong>AllGrafika.pl</strong>,
                dostępnego pod adresem allgrafika.pl oraz app.allgrafika.pl (dalej: „Administrator").
                W sprawach dotyczących ochrony danych osobowych możesz skontaktować się z Administratorem
                pod adresem e-mail: <strong>kontakt@allgrafika.pl</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Jakie dane zbieramy</h2>
              <p className="mb-3">W trakcie korzystania z Serwisu przetwarzamy następujące kategorie danych:</p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Dane rejestracyjne:</strong> adres e-mail, imię i nazwisko lub pseudonim podany przy rejestracji.</li>
                <li><strong>Dane logowania:</strong> zaszyfrowane hasło, historia logowań (adres IP, data i godzina).</li>
                <li><strong>Pliki graficzne:</strong> zdjęcia produktów przesyłane przez Użytkownika oraz grafiki wygenerowane przez AI.</li>
                <li><strong>Dane rozliczeniowe:</strong> historia zakupów kredytów. Dane kart płatniczych są przetwarzane wyłącznie przez operatora Stripe i nie są przechowywane przez Administratora.</li>
                <li><strong>Dane techniczne:</strong> adres IP, typ przeglądarki, dane o urządzeniu, pliki cookies.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Cele i podstawy prawne przetwarzania</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Cel</th>
                      <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Podstawa prawna (RODO)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 px-3 py-2">Realizacja usługi (generowanie grafik)</td>
                      <td className="border border-gray-200 px-3 py-2">Art. 6 ust. 1 lit. b – wykonanie umowy</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 px-3 py-2">Obsługa płatności i kredytów</td>
                      <td className="border border-gray-200 px-3 py-2">Art. 6 ust. 1 lit. b – wykonanie umowy</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 px-3 py-2">Rozpatrywanie reklamacji</td>
                      <td className="border border-gray-200 px-3 py-2">Art. 6 ust. 1 lit. c – obowiązek prawny</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 px-3 py-2">Bezpieczeństwo i przeciwdziałanie nadużyciom</td>
                      <td className="border border-gray-200 px-3 py-2">Art. 6 ust. 1 lit. f – prawnie uzasadniony interes</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 px-3 py-2">Marketing własnych usług</td>
                      <td className="border border-gray-200 px-3 py-2">Art. 6 ust. 1 lit. f – prawnie uzasadniony interes</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 px-3 py-2">Analityka i poprawa jakości Serwisu</td>
                      <td className="border border-gray-200 px-3 py-2">Art. 6 ust. 1 lit. f – prawnie uzasadniony interes</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Przechowywanie plików graficznych – Backblaze B2</h2>
              <p className="mb-3">
                Przesłane przez Ciebie zdjęcia produktów oraz grafiki wygenerowane przez AI są przechowywane
                w usłudze <strong>Backblaze B2 Cloud Storage</strong> (Backblaze, Inc., 500 Ben Franklin Ct,
                San Mateo, CA 94401, USA).
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>Pliki są przesyłane i pobierane przez szyfrowane połączenie HTTPS.</li>
                <li>Backblaze B2 zapewnia replikację danych i standardowe środki ochrony fizycznej serwerów.</li>
                <li>Transfer danych do USA odbywa się na podstawie standardowych klauzul umownych (SCC) lub innych mechanizmów zgodnych z RODO.</li>
                <li>Polityka prywatności Backblaze dostępna jest pod adresem: <a href="https://www.backblaze.com/company/privacy.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">backblaze.com/company/privacy.html</a>.</li>
                <li>Pliki są przechowywane przez czas posiadania aktywnego konta. Po usunięciu konta lub po upływie 12 miesięcy od ostatniego logowania pliki mogą zostać trwale usunięte.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Odbiorcy danych</h2>
              <p className="mb-3">Twoje dane mogą być przekazywane następującym kategoriom podmiotów:</p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Backblaze, Inc.</strong> – przechowywanie plików graficznych (patrz § 4).</li>
                <li><strong>Stripe, Inc.</strong> – obsługa płatności kartą.</li>
                <li><strong>Dostawca modelu AI</strong> – zdjęcia produktów są przesyłane do modelu AI w celu wygenerowania grafiki. Dane nie są przez niego zatrzymywane do celów treningowych.</li>
                <li><strong>Dostawca infrastruktury serwerowej</strong> – hosting aplikacji.</li>
                <li><strong>Narzędzia analityczne</strong> – np. Google Analytics (dane zanonimizowane).</li>
              </ul>
              <p className="mt-3">Administrator nie sprzedaje danych osobowych Użytkowników podmiotom trzecim.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Pliki cookies</h2>
              <p className="mb-3">
                Serwis używa plików cookies w następujących celach:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Niezbędne:</strong> utrzymanie sesji zalogowanego Użytkownika (token JWT w localStorage).</li>
                <li><strong>Analityczne:</strong> anonimowe statystyki odwiedzin (Google Analytics lub podobne).</li>
              </ul>
              <p className="mt-3">
                Możesz wyłączyć pliki cookies w ustawieniach przeglądarki, jednak może to ograniczyć działanie Serwisu.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Twoje prawa</h2>
              <p className="mb-3">Na podstawie RODO przysługują Ci następujące prawa:</p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Prawo dostępu</strong> – możesz zażądać informacji o przetwarzanych danych.</li>
                <li><strong>Prawo do sprostowania</strong> – możesz poprawić nieprawidłowe lub niekompletne dane.</li>
                <li><strong>Prawo do usunięcia</strong> – możesz zażądać usunięcia danych („prawo do bycia zapomnianym").</li>
                <li><strong>Prawo do ograniczenia przetwarzania</strong> – możesz ograniczyć zakres przetwarzania swoich danych.</li>
                <li><strong>Prawo do przenoszenia danych</strong> – możesz otrzymać dane w ustrukturyzowanym formacie.</li>
                <li><strong>Prawo sprzeciwu</strong> – możesz sprzeciwić się przetwarzaniu opartemu na prawnie uzasadnionym interesie.</li>
              </ul>
              <p className="mt-3">
                Aby skorzystać z powyższych praw, skontaktuj się pod adresem: <strong>kontakt@allgrafika.pl</strong>.
                Masz również prawo do złożenia skargi do Prezesa Urzędu Ochrony Danych Osobowych (UODO), ul. Stawki 2, 00-193 Warszawa.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Bezpieczeństwo danych</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>Hasła Użytkowników są przechowywane w formie zaszyfrowanej (bcrypt).</li>
                <li>Komunikacja z Serwisem odbywa się przez protokół HTTPS.</li>
                <li>Dostęp do danych Użytkowników jest ograniczony do osób upoważnionych przez Administratora.</li>
                <li>Administrator stosuje środki techniczne i organizacyjne adekwatne do ryzyk związanych z przetwarzaniem danych.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Zmiany polityki prywatności</h2>
              <p>
                Administrator zastrzega prawo do zmiany niniejszej Polityki prywatności. O istotnych zmianach
                Użytkownicy zostaną poinformowani drogą e-mail lub poprzez powiadomienie w Serwisie
                z co najmniej 7-dniowym wyprzedzeniem.
              </p>
            </section>

          </div>
        </main>

        <Footer />
      </div>
    </>
  )
}
