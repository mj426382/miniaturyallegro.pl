import { LEGAL_ENTITY, LEGAL_DATES, PRICING, PROCESSORS } from './entity'
import { CONSENT_CONFIGURED, openCookieSettings } from '../consent/googleTag'

/**
 * Treść polityki prywatności – współdzielona przez landing page i aplikację.
 * Kopia: frontend/src/legal/PolitykaContent.tsx (oba pliki muszą być identyczne).
 */
export default function PolitykaContent() {
  return (
    <>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Polityka prywatności</h1>
      <p className="text-sm text-gray-400 mb-10">
        Obowiązuje od: {LEGAL_DATES.effective} · ostatnia zmiana: {LEGAL_DATES.changesPublished} (usuwanie metadanych EXIF, oznaczenie grafik AI, limity przesyłania i skrót adresu e-mail po usunięciu
        konta – sekcja 10) · poprzednia zmiana: {LEGAL_DATES.integrationRemoved} (usunięcie integracji z zewnętrzną platformą sprzedażową)
      </p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Administrator danych</h2>
          <p>
            Administratorem Twoich danych osobowych jest <strong>{LEGAL_ENTITY.name}</strong>, {LEGAL_ENTITY.address}, NIP {LEGAL_ENTITY.nip} (dalej: „Administrator”), operator serwisu AllGrafika.pl
            dostępnego pod adresami {LEGAL_ENTITY.domains}. W sprawach ochrony danych skontaktuj się z nami pod adresem e-mail: <strong>{LEGAL_ENTITY.email}</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Jakie dane przetwarzamy</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Dane konta:</strong> adres e-mail, opcjonalnie imię i nazwisko, hasło w postaci skrótu (bcrypt) albo identyfikator konta Google – jeśli logujesz się przez Google; data akceptacji
              regulaminu.
            </li>
            <li>
              <strong>Pliki graficzne:</strong> zdjęcia produktów, które przesyłasz, grafiki wygenerowane przez AI oraz automatyczny tekstowy opis produktu tworzony na potrzeby generowania. Z
              przesłanych zdjęć usuwamy metadane (EXIF, w tym lokalizację GPS). Szczegóły w sekcji 5.
            </li>
            <li>
              <strong>Liczba i czas przesłania zdjęć</strong> – do pilnowania limitów przesyłania (sekcja 3).
            </li>
            <li>
              <strong>Po usunięciu konta:</strong> wyłącznie skrót (HMAC) adresu e-mail z datą usunięcia, przez {PRICING.deletedEmailHashMonths} miesięcy (sekcja 4).
            </li>
            <li>
              <strong>Dane rozliczeniowe:</strong> historia zakupów kredytów (pakiet, kwota, status, identyfikator sesji płatności). Dane kart płatniczych przetwarza wyłącznie Stripe.
            </li>
            <li>
              <strong>Dane techniczne:</strong> adres IP, typ przeglądarki i czas żądania zapisywane w logach serwera w celu zapewnienia bezpieczeństwa i ograniczania nadużyć.
            </li>
            <li>
              <strong>Treść korespondencji</strong>, jeśli kontaktujesz się z nami e-mailem.
            </li>
            <li>
              <strong>Darmowa próba bez konta:</strong> adres e-mail, przesłane zdjęcie, wygenerowana grafika oraz skrót (hash) adresu IP używany wyłącznie do ograniczenia liczby prób; ewentualna
              dobrowolna zgoda na wiadomości marketingowe.
            </li>
            <li>
              <strong>Subskrypcja:</strong> identyfikator klienta i subskrypcji w systemie Stripe, status i okres rozliczeniowy.
            </li>
            <li>
              <strong>Ocena grafik:</strong> dobrowolne oceny (kciuk w górę/dół) i powody odrzucenia, używane do poprawy jakości stylów.
            </li>
          </ul>
          <p className="mt-3">
            Podanie danych konta jest dobrowolne, ale niezbędne do korzystania z Serwisu. Nie profilujemy użytkowników i nie podejmujemy wobec nich zautomatyzowanych decyzji wywołujących skutki
            prawne.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Cele, podstawy prawne i okres przetwarzania</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Cel</th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Podstawa prawna (RODO)</th>
                  <th className="border border-gray-200 px-3 py-2 text-left font-semibold">Okres</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 px-3 py-2">Prowadzenie konta i generowanie grafik</td>
                  <td className="border border-gray-200 px-3 py-2">art. 6 ust. 1 lit. b – wykonanie umowy</td>
                  <td className="border border-gray-200 px-3 py-2">do usunięcia konta (pliki usuwane razem z kontem)</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2">Obsługa płatności, faktury, księgowość</td>
                  <td className="border border-gray-200 px-3 py-2">art. 6 ust. 1 lit. b i c – umowa oraz obowiązek prawny (przepisy podatkowe)</td>
                  <td className="border border-gray-200 px-3 py-2">5 lat od końca roku podatkowego</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2">Reklamacje, odstąpienie od umowy, obrona roszczeń</td>
                  <td className="border border-gray-200 px-3 py-2">art. 6 ust. 1 lit. c i f</td>
                  <td className="border border-gray-200 px-3 py-2">do upływu terminów przedawnienia</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2">Bezpieczeństwo, zapobieganie nadużyciom, logi serwera</td>
                  <td className="border border-gray-200 px-3 py-2">art. 6 ust. 1 lit. f – prawnie uzasadniony interes</td>
                  <td className="border border-gray-200 px-3 py-2">logi są nadpisywane rotacyjnie (limit objętości na usługę), nie dłużej niż 90 dni</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2">Wiadomości transakcyjne (np. reset hasła, zmiany regulaminu)</td>
                  <td className="border border-gray-200 px-3 py-2">art. 6 ust. 1 lit. b</td>
                  <td className="border border-gray-200 px-3 py-2">czas posiadania konta</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2">Darmowa próba bez konta (wygenerowanie i wysłanie grafiki)</td>
                  <td className="border border-gray-200 px-3 py-2">art. 6 ust. 1 lit. b – wykonanie usługi na żądanie</td>
                  <td className="border border-gray-200 px-3 py-2">30 dni</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2">Wiadomości marketingowe po darmowej próbie</td>
                  <td className="border border-gray-200 px-3 py-2">art. 6 ust. 1 lit. a – zgoda (można ją cofnąć w każdej chwili, pisząc na adres kontaktowy)</td>
                  <td className="border border-gray-200 px-3 py-2">do cofnięcia zgody, nie dłużej niż 12 miesięcy</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2">
                    Wskazówki, przypomnienia i oferty e-mailem dla Użytkowników (np. o niewykorzystanych darmowych kredytach, stylach sezonowych, zniżkach na kredyty)
                  </td>
                  <td className="border border-gray-200 px-3 py-2">
                    art. 6 ust. 1 lit. a – zgoda wyrażona w formularzu rejestracji lub w ustawieniach konta; można ją cofnąć w ustawieniach konta albo linkiem w każdej wiadomości
                  </td>
                  <td className="border border-gray-200 px-3 py-2">do cofnięcia zgody lub usunięcia konta; historia wysłanych wiadomości – do usunięcia konta</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2">Powiadomienie o zakończeniu generowania grafik z masowego przesyłania zdjęć oraz indywidualne wiadomości obsługi klienta</td>
                  <td className="border border-gray-200 px-3 py-2">art. 6 ust. 1 lit. b – wykonanie umowy (powiadomienie można wyłączyć w ustawieniach konta)</td>
                  <td className="border border-gray-200 px-3 py-2">czas posiadania konta</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2">
                    Wgląd administratora w przesłane zdjęcia i wygenerowane grafiki – obsługa zgłoszeń, kontrola jakości usługi, przeciwdziałanie nadużyciom (każdy wgląd jest rejestrowany)
                  </td>
                  <td className="border border-gray-200 px-3 py-2">art. 6 ust. 1 lit. f – prawnie uzasadniony interes Administratora</td>
                  <td className="border border-gray-200 px-3 py-2">czas przechowywania zdjęć na koncie</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2">Pomiar skuteczności reklam Google Ads (pliki cookies reklamowe – tylko po Twojej zgodzie)</td>
                  <td className="border border-gray-200 px-3 py-2">art. 6 ust. 1 lit. a RODO – zgoda (oraz art. 399 Prawa komunikacji elektronicznej)</td>
                  <td className="border border-gray-200 px-3 py-2">do wycofania zgody; pliki cookies Google Ads wygasają po maks. 90 dniach</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2">
                    Statystyki odwiedzin i skuteczności stron, kampanii i zakupów w Google Analytics 4 (pliki cookies analityczne – tylko po Twojej zgodzie)
                  </td>
                  <td className="border border-gray-200 px-3 py-2">art. 6 ust. 1 lit. a RODO – zgoda (oraz art. 399 Prawa komunikacji elektronicznej)</td>
                  <td className="border border-gray-200 px-3 py-2">do wycofania zgody; dane w Google Analytics przechowujemy 14 miesięcy, pliki _ga wygasają po maks. 13 miesiącach</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2">
                    Limity przesyłania zdjęć: do {PRICING.uploadLimitUnconfirmed} zdjęć łącznie przed potwierdzeniem adresu e-mail i do {PRICING.uploadLimitDaily} zdjęć w ciągu 24 godzin po jego
                    potwierdzeniu (od {LEGAL_DATES.limitsEffective}) – liczymy przesłane zdjęcia i czas ich przesłania
                  </td>
                  <td className="border border-gray-200 px-3 py-2">art. 6 ust. 1 lit. b i f – wykonanie umowy oraz prawnie uzasadniony interes (ochrona Serwisu przed nadużyciami i przeciążeniem)</td>
                  <td className="border border-gray-200 px-3 py-2">czas przesłania zapisujemy przy zdjęciu – do jego usunięcia albo usunięcia konta</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-200 px-3 py-2">
                    Zapobieganie ponownemu wykorzystaniu darmowej puli kredytów i nagród za polecenia po usunięciu konta – przechowujemy wyłącznie skrót (HMAC) adresu e-mail z datą usunięcia, bez
                    samego adresu (sekcja 4)
                  </td>
                  <td className="border border-gray-200 px-3 py-2">
                    art. 6 ust. 1 lit. f RODO – prawnie uzasadniony interes Administratora (ochrona darmowej oferty i programu poleceń przed nadużyciami)
                  </td>
                  <td className="border border-gray-200 px-3 py-2">
                    {PRICING.deletedEmailHashMonths} miesięcy od usunięcia konta (dotyczy kont usuniętych od {LEGAL_DATES.limitsEffective}), potem skrót jest automatycznie usuwany
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2">Statystyki użycia (Plausible/Umami – bez cookies, bez identyfikacji osób)</td>
                  <td className="border border-gray-200 px-3 py-2">art. 6 ust. 1 lit. f – prawnie uzasadniony interes</td>
                  <td className="border border-gray-200 px-3 py-2">dane zagregowane</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3">Nie wysyłamy informacji handlowych bez odrębnej, dobrowolnej zgody.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Usunięcie konta – skrót adresu e-mail</h2>
          <p>
            Gdy usuniesz konto, usuwamy je razem z przesłanymi zdjęciami, grafikami i opisami (dane, które musimy przechowywać na podstawie przepisów, np. dotyczące płatności, zostają na okres
            wskazany w sekcji 3).
          </p>
          <p className="mt-3">
            Po usunięciu konta przechowujemy wyłącznie skrót kryptograficzny (HMAC) adresu e-mail tego konta wraz z datą usunięcia – bez samego adresu – w celu zapobiegania nadużyciom darmowej puli
            grafik i programu poleceń (ponowna rejestracja tego samego adresu nie otrzymuje ponownie darmowych grafik ani nagród za polecenie); podstawą prawną jest nasz prawnie uzasadniony interes
            (art. 6 ust. 1 lit. f RODO), a skrót usuwamy po 12 miesiącach od usunięcia konta.
          </p>
          <p className="mt-3">
            Dotyczy kont usuniętych od {LEGAL_DATES.limitsEffective}. Skrót obliczamy funkcją HMAC z tajnym kluczem, który zna tylko Administrator – nie da się z niego odczytać adresu; możemy jedynie
            sprawdzić, czy nowe konto używa tego samego adresu. Nie zachowujemy imienia, plików, historii korzystania ani innych danych konta. Konto założone w tym czasie na ten sam adres działa
            normalnie, ale bez ponownej darmowej puli i nagrody za polecenie. Wobec tego przetwarzania możesz wnieść sprzeciw (sekcja 8).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Metadane zdjęć i oznaczenie grafik AI</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Bez EXIF i GPS:</strong> Z przesłanych zdjęć usuwamy metadane (EXIF, w tym lokalizację GPS). Robimy to automatycznie przy przesłaniu, więc zapisane zdjęcie i pliki tworzone na
              jego podstawie nie zdradzają np. miejsca wykonania zdjęcia.
            </li>
            <li>
              <strong>Oznaczenie grafik AI:</strong> grafiki wygenerowane przez AI, które eksportujesz z Serwisu, zawierają w metadanych IPTC/XMP informację, że powstały z użyciem sztucznej
              inteligencji (pole DigitalSourceType). To standard przejrzystości odczytywany przez platformy sprzedażowe i serwisy internetowe. Znacznik nie zawiera Twoich danych osobowych ani
              identyfikatora konta.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Odbiorcy danych i transfer poza EOG</h2>
          <p className="mb-3">Aby świadczyć usługę, korzystamy z następujących podmiotów przetwarzających:</p>
          <ul className="list-disc list-inside space-y-2">
            {PROCESSORS.map((p) => (
              <li key={p.name}>
                <strong>{p.name}</strong> – {p.role}. {p.location}.{' '}
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Polityka prywatności dostawcy
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3">
            Przesłane zdjęcia są przekazywane dostawcom modeli AI wyłącznie w celu wygenerowania grafiki. Nie wysyłaj zdjęć zawierających wizerunek osób ani dane osobowe, jeśli nie masz do tego
            podstawy. Administrator nie sprzedaje danych osobowych i nie udostępnia ich w celach marketingowych podmiotów trzecich. Dane mogą zostać udostępnione organom publicznym wyłącznie na
            podstawie przepisów prawa.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Pliki cookies i pamięć przeglądarki</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Niezbędne:</strong> token sesji zalogowanego użytkownika zapisany w pamięci lokalnej przeglądarki (localStorage) – usuwany przy wylogowaniu.
            </li>
            <li>
              <strong>Płatności:</strong> podczas płatności Stripe może ustawić własne pliki cookies niezbędne do obsługi transakcji i zapobiegania oszustwom.
            </li>
            <li>
              <strong>Zapamiętanie decyzji o cookies:</strong> plik <code>ag_consent</code> (180 dni) – niezbędny, aby nie pytać Cię ponownie.
            </li>
            <li>
              <strong>Logowanie Google:</strong> jeśli korzystasz z przycisku „Zaloguj przez Google”, Google może ustawić pliki cookies zgodnie ze swoją polityką.
            </li>
          </ul>
          <p className="mt-3">
            Do statystyk odwiedzin używamy narzędzia bez plików cookies i bez identyfikacji użytkowników (Plausible lub Umami; dane są agregowane i nie są łączone z Twoim kontem).
          </p>
          <p className="mt-3">
            <strong>Reklamy Google Ads (tylko za zgodą):</strong> jeśli zgodzisz się na pliki cookies marketingowe („Akceptuję” albo „Dostosuj” → „Marketingowe”), uruchamiamy tag Google Ads, który
            zapisuje pliki <code>_gcl_aw</code> i <code>_gcl_au</code> (do 90 dni) na domenie allgrafika.pl, aby sprawdzić, czy wizyta z reklamy zakończyła się rejestracją lub zakupem. Google
            otrzymuje identyfikator kliknięcia reklamy, rodzaj konwersji i wartość zakupu – nie przekazujemy mu Twojego adresu e-mail ani innych danych konta. Bez zgody skrypt Google w ogóle się nie
            ładuje. Twoją decyzję zapisujemy w pliku <code>ag_consent</code> (180 dni), wspólnym dla allgrafika.pl i app.allgrafika.pl. Zgodę możesz w każdej chwili wycofać – nie wpływa to na zgodność
            z prawem przetwarzania przed jej wycofaniem.
          </p>
          <p className="mt-3">
            <strong>Google Analytics 4 (tylko za zgodą):</strong> jeśli zgodzisz się na pliki cookies analityczne („Akceptuję” albo „Dostosuj” → „Analityczne”), uruchamiamy Google Analytics 4
            dostarczane przez Google Ireland Limited (Gordon House, Barrow Street, Dublin 4, Irlandia). Celem jest poznanie, jak korzystasz z allgrafika.pl i app.allgrafika.pl – które strony
            odwiedzasz, skąd przychodzisz (np. z reklamy), które przyciski klikasz, czy zakładasz konto i kupujesz kredyty (rodzaj pakietu, kwota, losowy numer transakcji) – abyśmy mogli ulepszać
            Serwis i oceniać opłacalność reklam. Google Analytics zapisuje pliki <code>_ga</code> i <code>_ga_&lt;identyfikator&gt;</code> (do 13 miesięcy) na domenie allgrafika.pl; zawierają one
            losowy identyfikator przeglądarki. Nie przekazujemy Google Twojego adresu e-mail, imienia ani innych danych konta, a adresy stron wysyłamy bez parametrów innych niż kampanii reklamowych.
            Google Analytics 4 nie zapisuje adresu IP (używa go wyłącznie do ustalenia przybliżonej lokalizacji, np. miasta). Dane w Google Analytics przechowujemy 14 miesięcy. Podstawą prawną jest
            Twoja zgoda (art. 6 ust. 1 lit. a RODO); możesz ją w każdej chwili wycofać w „Ustawieniach cookies” – usuniemy wtedy pliki <code>_ga</code> i wyłączymy pomiar, co nie wpływa na zgodność z
            prawem przetwarzania przed wycofaniem. Google może przekazywać dane do USA na podstawie EU-U.S. Data Privacy Framework.
          </p>
          {CONSENT_CONFIGURED && (
            <p className="mt-3">
              <button type="button" onClick={openCookieSettings} className="text-blue-600 hover:underline font-medium">
                Ustawienia cookies – zmień swoją decyzję
              </button>
            </p>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Twoje prawa</h2>
          <p className="mb-3">Na podstawie RODO przysługują Ci prawa do:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>dostępu</strong> do danych oraz otrzymania ich kopii,
            </li>
            <li>
              <strong>sprostowania</strong> danych (imię i nazwisko zmienisz w ustawieniach konta),
            </li>
            <li>
              <strong>usunięcia</strong> danych – konto wraz ze wszystkimi plikami usuniesz samodzielnie w ustawieniach konta („Usuń konto”); po usunięciu zostaje tylko skrót adresu e-mail opisany w
              sekcji 4,
            </li>
            <li>
              <strong>ograniczenia przetwarzania</strong> i <strong>przenoszenia</strong> danych,
            </li>
            <li>
              <strong>sprzeciwu</strong> wobec przetwarzania opartego na prawnie uzasadnionym interesie,
            </li>
            <li>
              wniesienia <strong>skargi</strong> do Prezesa Urzędu Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa.
            </li>
          </ul>
          <p className="mt-3">
            Żądania prosimy kierować na adres <strong>{LEGAL_ENTITY.email}</strong>. Odpowiadamy w terminie 30 dni.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Bezpieczeństwo</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Hasła są przechowywane wyłącznie jako skróty bcrypt; reset hasła odbywa się przez jednorazowy link ważny 1 godzinę.</li>
            <li>Komunikacja z Serwisem odbywa się przez HTTPS; pliki w chmurze są dostępne tylko przez podpisane, czasowe adresy URL.</li>
            <li>Dostęp do danych mają wyłącznie osoby upoważnione przez Administratora; stosujemy limity zapytań i monitoring nadużyć.</li>
            <li>O naruszeniu ochrony danych, które może powodować wysokie ryzyko dla Twoich praw, poinformujemy Cię bez zbędnej zwłoki.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Zmiany polityki prywatności</h2>
          <p>
            O istotnych zmianach poinformujemy Cię e-mailem lub w Serwisie z co najmniej 14-dniowym wyprzedzeniem. Aktualna wersja jest zawsze dostępna pod adresem allgrafika.pl/polityka-prywatnosci.
          </p>
          <p className="mt-3">
            Zmiana z {LEGAL_DATES.changesPublished} (data publikacji): dodaliśmy informacje o usuwaniu metadanych EXIF (w tym GPS) z przesyłanych zdjęć i o oznaczaniu eksportowanych grafik AI (sekcja
            5) – obowiązują od dnia publikacji, bo nie rozszerzają przetwarzania Twoich danych; o limitach przesyłania zdjęć (sekcja 3) i o przechowywaniu skrótu adresu e-mail po usunięciu konta
            (sekcja 4) – te zmiany obowiązują od {LEGAL_DATES.limitsEffective}, czyli 14 dni po publikacji. Funkcję przesyłania wielu zdjęć naraz nazywamy jak w Serwisie: „masowe przesyłanie”.
          </p>
        </section>
      </div>
    </>
  )
}
