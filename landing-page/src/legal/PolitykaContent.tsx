import { LEGAL_ENTITY, LEGAL_DATES, PROCESSORS } from './entity'

/**
 * Treść polityki prywatności – współdzielona przez landing page i aplikację.
 * Kopia: frontend/src/legal/PolitykaContent.tsx (oba pliki muszą być identyczne).
 */
export default function PolitykaContent() {
  return (
    <>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Polityka prywatności</h1>
      <p className="text-sm text-gray-400 mb-10">Obowiązuje od: {LEGAL_DATES.effective}</p>

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
              <strong>Pliki graficzne:</strong> zdjęcia produktów, które przesyłasz, grafiki wygenerowane przez AI oraz automatyczny tekstowy opis produktu tworzony na potrzeby generowania.
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
              <strong>Integracja z Allegro:</strong> login sprzedawcy, zaszyfrowane tokeny dostępu OAuth oraz identyfikatory ofert, z których pobrano zdjęcia – wyłącznie po połączeniu konta przez
              Użytkownika.
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
                  <td className="border border-gray-200 px-3 py-2">Wskazówki i przypomnienia e-mailem dla Użytkowników (np. o niewykorzystanych darmowych kredytach, stylach sezonowych)</td>
                  <td className="border border-gray-200 px-3 py-2">
                    art. 6 ust. 1 lit. a – zgoda wyrażona w formularzu rejestracji lub w ustawieniach konta; można ją cofnąć w ustawieniach konta albo linkiem w każdej wiadomości
                  </td>
                  <td className="border border-gray-200 px-3 py-2">do cofnięcia zgody lub usunięcia konta; historia wysłanych wiadomości – do usunięcia konta</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-3 py-2">Powiadomienie o zakończeniu generowania paczki zdjęć oraz indywidualne wiadomości obsługi klienta</td>
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
                  <td className="border border-gray-200 px-3 py-2">Integracja z Allegro (pobieranie zdjęć, publikacja grafik)</td>
                  <td className="border border-gray-200 px-3 py-2">art. 6 ust. 1 lit. b – wykonanie umowy</td>
                  <td className="border border-gray-200 px-3 py-2">do odłączenia konta Allegro</td>
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
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Odbiorcy danych i transfer poza EOG</h2>
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
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Pliki cookies i pamięć przeglądarki</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Niezbędne:</strong> token sesji zalogowanego użytkownika zapisany w pamięci lokalnej przeglądarki (localStorage) – usuwany przy wylogowaniu.
            </li>
            <li>
              <strong>Płatności:</strong> podczas płatności Stripe może ustawić własne pliki cookies niezbędne do obsługi transakcji i zapobiegania oszustwom.
            </li>
            <li>
              <strong>Logowanie Google:</strong> jeśli korzystasz z przycisku „Zaloguj przez Google”, Google może ustawić pliki cookies zgodnie ze swoją polityką.
            </li>
          </ul>
          <p className="mt-3">
            Do statystyk odwiedzin używamy narzędzia bez plików cookies i bez identyfikacji użytkowników (Plausible lub Umami; dane są agregowane i nie są łączone z Twoim kontem). Nie używamy
            marketingowych plików cookies; jeśli to się zmieni, poprosimy Cię o zgodę przed ich uruchomieniem.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Twoje prawa</h2>
          <p className="mb-3">Na podstawie RODO przysługują Ci prawa do:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>dostępu</strong> do danych oraz otrzymania ich kopii,
            </li>
            <li>
              <strong>sprostowania</strong> danych (imię i nazwisko zmienisz w ustawieniach konta),
            </li>
            <li>
              <strong>usunięcia</strong> danych – konto wraz ze wszystkimi plikami usuniesz samodzielnie w ustawieniach konta („Usuń konto”),
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
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Bezpieczeństwo</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Hasła są przechowywane wyłącznie jako skróty bcrypt; reset hasła odbywa się przez jednorazowy link ważny 1 godzinę.</li>
            <li>Komunikacja z Serwisem odbywa się przez HTTPS; pliki w chmurze są dostępne tylko przez podpisane, czasowe adresy URL.</li>
            <li>Dostęp do danych mają wyłącznie osoby upoważnione przez Administratora; stosujemy limity zapytań i monitoring nadużyć.</li>
            <li>O naruszeniu ochrony danych, które może powodować wysokie ryzyko dla Twoich praw, poinformujemy Cię bez zbędnej zwłoki.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Zmiany polityki prywatności</h2>
          <p>
            O istotnych zmianach poinformujemy Cię e-mailem lub w Serwisie z co najmniej 14-dniowym wyprzedzeniem. Aktualna wersja jest zawsze dostępna pod adresem allgrafika.pl/polityka-prywatnosci.
          </p>
        </section>
      </div>
    </>
  )
}
