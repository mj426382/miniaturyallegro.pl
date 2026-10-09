import { LEGAL_ENTITY, LEGAL_DATES, PRICING } from './entity'

/**
 * Treść regulaminu – współdzielona przez landing page i aplikację.
 * Kopia: frontend/src/legal/RegulaminContent.tsx (oba pliki muszą być identyczne).
 */
export default function RegulaminContent() {
  return (
    <>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Regulamin świadczenia usług</h1>
      <p className="text-sm text-gray-400 mb-10">Obowiązuje od: {LEGAL_DATES.effective}</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 1. Usługodawca i definicje</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              <strong>Usługodawca</strong> – {LEGAL_ENTITY.name}, {LEGAL_ENTITY.address}, NIP {LEGAL_ENTITY.nip}, {LEGAL_ENTITY.register}, e-mail: {LEGAL_ENTITY.email}, tel. {LEGAL_ENTITY.phone};
              właściciel i operator serwisu AllGrafika.pl dostępnego pod adresami {LEGAL_ENTITY.domains} (dalej: „Serwis”).
            </li>
            <li>
              <strong>Użytkownik</strong> – osoba fizyczna posiadająca pełną zdolność do czynności prawnych, osoba prawna lub jednostka organizacyjna, która założyła Konto w Serwisie.
            </li>
            <li>
              <strong>Konsument</strong> – Użytkownik będący konsumentem w rozumieniu art. 22¹ Kodeksu cywilnego, a także osoba fizyczna zawierająca umowę bezpośrednio związaną z jej działalnością
              gospodarczą, gdy z treści umowy wynika, że nie ma ona dla niej charakteru zawodowego.
            </li>
            <li>
              <strong>Konto</strong> – indywidualny profil Użytkownika w Serwisie, chroniony hasłem lub logowaniem Google.
            </li>
            <li>
              <strong>Grafika / Generacja</strong> – obraz wytworzony automatycznie przez model sztucznej inteligencji na podstawie zdjęcia produktu i/lub opisu przekazanego przez Użytkownika.
            </li>
            <li>
              <strong>Opis oferty</strong> – wygenerowany automatycznie tekst (tytuł, opis, frazy kluczowe) przeznaczony do oferty sprzedażowej, tworzony na podstawie informacji podanych przez
              Użytkownika i analizy przesłanego zdjęcia, dostępny po wygenerowaniu co najmniej jednej Grafiki dla danego zdjęcia.
            </li>
            <li>
              <strong>Kredyt</strong> – jednostka rozliczeniowa uprawniająca do wygenerowania jednej Grafiki albo do nabycia pakietu poprawek Opisu oferty.
            </li>
            <li>
              <strong>Treść cyfrowa</strong> – Grafiki, Opisy oferty oraz Kredyty stanowią treści cyfrowe / usługi cyfrowe w rozumieniu ustawy z dnia 30 maja 2014 r. o prawach konsumenta.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 2. Postanowienia ogólne</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Regulamin określa zasady korzystania z Serwisu, w tym rodzaje i zakres usług świadczonych drogą elektroniczną, warunki ich świadczenia, warunki zawierania i rozwiązywania umów oraz tryb
              postępowania reklamacyjnego.
            </li>
            <li>Założenie Konta wymaga zapoznania się z Regulaminem i Polityką prywatności oraz ich akceptacji. Moment akceptacji jest rejestrowany.</li>
            <li>Do korzystania z Serwisu niezbędne są: urządzenie z dostępem do Internetu, aktualna przeglądarka internetowa z włączoną obsługą JavaScript oraz aktywny adres e-mail.</li>
            <li>
              Usługodawca może zmienić Regulamin z ważnych przyczyn (zmiana przepisów, zmiana funkcji Serwisu, względy bezpieczeństwa). O zmianach Użytkownicy zostaną poinformowani e-mailem lub w
              Serwisie co najmniej 14 dni przed ich wejściem w życie. Użytkownik, który nie akceptuje zmian, może usunąć Konto; zakupione Kredyty pozostają ważne na dotychczasowych warunkach.
            </li>
            <li>W sprawach nieuregulowanych stosuje się prawo polskie, w szczególności Kodeks cywilny, ustawę o prawach konsumenta oraz ustawę o świadczeniu usług drogą elektroniczną.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 3. Konto</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Umowa o prowadzenie Konta zostaje zawarta z chwilą rejestracji, na czas nieokreślony i jest bezpłatna.</li>
            <li>
              Użytkownik zobowiązany jest podać prawdziwe dane oraz chronić hasło. Za działania wykonane z użyciem Konta odpowiada Użytkownik, chyba że doszło do nich mimo zachowania należytej
              staranności.
            </li>
            <li>
              Jeden Użytkownik może posiadać jedno Konto. Zakładanie wielu Kont w celu uzyskania dodatkowych darmowych Kredytów jest zabronione i może skutkować zablokowaniem Kont. Adresy e-mail
              różniące się wyłącznie wielkością liter, kropkami w adresach Gmail albo dopiskiem „+…” traktowane są jako ten sam adres.
            </li>
            <li>
              Usługodawca wysyła na adres e-mail Konta wiadomości związane z usługą (np. potwierdzenie adresu, reset hasła, zakończenie generowania paczki zdjęć). Wskazówki, przypomnienia i oferty
              (np. zniżki na Kredyty) o charakterze handlowym wysyłane są wyłącznie po wyrażeniu przez Użytkownika odrębnej, dobrowolnej zgody, którą można wycofać w ustawieniach Konta lub linkiem w
              każdej takiej wiadomości.
            </li>
            <li>
              Po rejestracji Usługodawca wysyła na podany adres link potwierdzający. Generowanie Grafik i zakup Kredytów są dostępne po potwierdzeniu adresu e-mail; przy logowaniu przez Google adres
              jest potwierdzony automatycznie.
            </li>
            <li>
              Użytkownik może w każdej chwili usunąć Konto w ustawieniach Serwisu („Konto → Usuń konto”) lub wysyłając żądanie na adres {LEGAL_ENTITY.email}. Usunięcie Konta powoduje trwałe usunięcie
              przesłanych zdjęć, Grafik i niewykorzystanych Kredytów.
            </li>
            <li>
              Usługodawca może wypowiedzieć umowę z zachowaniem 14-dniowego okresu wypowiedzenia z ważnych przyczyn, a ze skutkiem natychmiastowym w razie rażącego naruszenia Regulaminu (§ 8). O
              zablokowaniu Konta Użytkownik zostanie poinformowany wraz z uzasadnieniem.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 4. Kredyty, ceny i płatności</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Każdy nowy Użytkownik otrzymuje {PRICING.freeCredits} darmowych Kredytów, które może wykorzystać po potwierdzeniu adresu e-mail. Konta założone przed {PRICING.freeCreditsLegacyBefore}{' '}
              zachowują dotychczasową pulę {PRICING.freeCreditsLegacy} darmowych Kredytów. Darmowe Kredyty służą do przetestowania Serwisu i nie podlegają wymianie na pieniądze.
            </li>
            <li>
              Przy pierwszym zakupie Użytkownik, który nie opłacił wcześniej żadnego zamówienia, może jednorazowo kupić pakiet powitalny {PRICING.welcomePackCredits} Kredytów w cenie{' '}
              {PRICING.welcomePackPrice}. Usługodawca może też przyznać Użytkownikowi dodatkowe Kredyty nieodpłatnie (np. w ramach promocji lub obsługi zgłoszenia); takie Kredyty podlegają tym samym
              zasadom co Kredyty zakupione, z wyjątkiem zwrotu ceny.
            </li>
            <li>
              Jeden Kredyt uprawnia do wygenerowania jednej Grafiki. Domyślny zestaw startowy obejmuje {PRICING.starterStyles} style ({PRICING.starterStyles} Kredyty); Użytkownik sam wybiera, ile i
              jakie style generuje (maksymalnie {PRICING.allStyles} stylów automatycznych oraz dowolna liczba Grafik własnych).
            </li>
            <li>Kredyt jest pobierany z chwilą uruchomienia generowania. Jeżeli generowanie zakończy się błędem po stronie Serwisu, Kredyt jest automatycznie zwracany na Konto.</li>
            <li>Eksport Grafik w formatach marketplace, infografiki (zdjęcia dodatkowe z cechami lub wymiarami produktu) oraz pobieranie Grafik i Opisów w paczce ZIP są bezpłatne.</li>
            <li>
              Opis oferty jest bezpłatnym dodatkiem do zdjęcia, dla którego wygenerowano co najmniej jedną Grafikę. Dla każdego zdjęcia Użytkownik otrzymuje {PRICING.descriptionPromptEdits}{' '}
              bezpłatnych poprawek Opisu wykonywanych przez AI na podstawie jego polecenia (ponowne wygenerowanie Opisu od nowa jest liczone jako poprawka). Kolejne pakiety po{' '}
              {PRICING.descriptionEditPack} poprawek kosztują jeden Kredyt każdy. Ręczna edycja Opisu jest nieograniczona i bezpłatna.
            </li>
            <li>
              Ceny pakietów Kredytów podane w Serwisie są cenami brutto w złotych polskich. Płatności obsługuje Stripe; Usługodawca nie przechowuje danych kart płatniczych. Kredyty są udostępniane
              niezwłocznie po potwierdzeniu płatności, nie wygasają i nie są przypisane do terminu.
            </li>
            <li>
              <strong>Prawo odstąpienia od umowy.</strong> Konsument ma prawo odstąpić od umowy zakupu Kredytów w terminie 14 dni bez podania przyczyny, składając oświadczenie na adres{' '}
              {LEGAL_ENTITY.email}. Zgodnie z art. 38 ust. 1 pkt 13 ustawy o prawach konsumenta prawo to <strong>nie przysługuje</strong>, jeżeli Konsument przed zakupem wyraźnie zażądał
              natychmiastowego udostępnienia Kredytów i przyjął do wiadomości utratę prawa odstąpienia – zgoda ta jest zbierana w formularzu zakupu. W razie skutecznego odstąpienia Usługodawca zwraca
              cenę w terminie 14 dni, pomniejszoną proporcjonalnie o wartość Kredytów wykorzystanych do chwili odstąpienia.
            </li>
            <li>
              Do każdej płatności wystawiana jest faktura. Użytkownik będący przedsiębiorcą podaje nazwę firmy, adres i NIP w formularzu płatności; faktura jest dostępna w historii transakcji w
              Serwisie. Korektę danych na fakturze można zgłosić na adres {LEGAL_ENTITY.email}.
            </li>
            <li>
              <strong>Abonament.</strong> Użytkownik może wykupić plan miesięczny, w ramach którego na początku każdego okresu rozliczeniowego otrzymuje określoną w cenniku liczbę Kredytów. Opłata
              pobierana jest z góry za każdy miesiąc przez Stripe. Abonament odnawia się automatycznie do czasu jego anulowania, które jest możliwe w każdej chwili w panelu zarządzania subskrypcją;
              anulowanie działa od końca bieżącego okresu rozliczeniowego. Konsument, który zażądał rozpoczęcia świadczenia usługi przed upływem terminu odstąpienia (zgoda zbierana w formularzu), może
              odstąpić od umowy abonamentowej w terminie 14 dni, płacąc za świadczenia spełnione do chwili odstąpienia (udostępnione Kredyty według ceny jednostkowej planu), zgodnie z art. 35 ustawy o
              prawach konsumenta. Kredyty otrzymane w ramach abonamentu nie wygasają. Usługodawca informuje o zmianie ceny abonamentu z co najmniej 30-dniowym wyprzedzeniem; zmiana nie obowiązuje
              Użytkownika, który w tym czasie anuluje plan.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 4a. Darmowa próba bez konta</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Na stronie allgrafika.pl Usługodawca udostępnia możliwość jednorazowego wygenerowania jednej Grafiki bez zakładania Konta, po podaniu adresu e-mail i przesłaniu zdjęcia produktu.</li>
            <li>
              Usługa jest bezpłatna i ograniczona do jednej próby na adres e-mail oraz dwóch prób dziennie z jednego adresu IP. Wynik jest prezentowany na stronie oraz wysyłany na podany adres e-mail.
            </li>
            <li>Do darmowej próby stosuje się odpowiednio § 5–8 Regulaminu. Zdjęcie i wygenerowana Grafika są usuwane po 30 dniach.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 4b. Integracja z Allegro</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Użytkownik może połączyć Konto ze swoim kontem sprzedawcy w serwisie Allegro za pomocą oficjalnej autoryzacji Allegro (OAuth). Usługodawca nie otrzymuje hasła do Allegro; przechowuje
              wyłącznie tokeny dostępu w postaci zaszyfrowanej.
            </li>
            <li>
              Integracja umożliwia pobranie zdjęć z ofert Użytkownika oraz publikację Grafik w jego ofertach wyłącznie na wyraźne polecenie Użytkownika. Usługodawca nie modyfikuje ofert w inny sposób.
            </li>
            <li>Użytkownik odpowiada za zgodność publikowanych Grafik z regulaminem Allegro, w szczególności z wymaganiami dotyczącymi zdjęcia głównego oferty.</li>
            <li>
              Użytkownik może cofnąć dostęp w każdej chwili w ustawieniach Serwisu lub w panelu Allegro. Usługodawca nie ponosi odpowiedzialności za niedostępność lub zmiany interfejsu API Allegro.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 4c. Odstąpienie od umowy – informacje ogólne</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Konsument może odstąpić od umowy o prowadzenie Konta oraz od umowy o darmową próbę w terminie 14 dni od ich zawarcia bez podania przyczyny, wysyłając oświadczenie na adres{' '}
              {LEGAL_ENTITY.email}. Równoważne jest usunięcie Konta w ustawieniach Serwisu.
            </li>
            <li>
              Oświadczenie można złożyć na formularzu: „Ja, [imię i nazwisko], niniejszym informuję o odstąpieniu od umowy o świadczenie usługi AllGrafika.pl zawartej dnia [data]. Adres e-mail konta:
              [e-mail]. Data: [data], podpis (jeśli formularz jest przesyłany w wersji papierowej).”
            </li>
            <li>Zasady odstąpienia od umowy zakupu Kredytów i abonamentu określa § 4 ust. 5 i 7.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 5. Przechowywanie plików</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Przesłane zdjęcia produktów oraz Grafiki są przechowywane w usłudze Backblaze B2 (Backblaze, Inc., USA) i udostępniane wyłącznie zalogowanemu właścicielowi Konta za pomocą podpisanych,
              czasowych adresów URL.
            </li>
            <li>Pliki są przesyłane szyfrowanym połączeniem (HTTPS). Usługodawca nie gwarantuje nieprzerwanej dostępności plików i zaleca pobranie Grafik na własne urządzenie.</li>
            <li>Użytkownik zobowiązuje się nie przesyłać plików zawierających treści nielegalne, naruszające prawa osób trzecich, wizerunek osób bez ich zgody ani złośliwe oprogramowanie.</li>
            <li>
              Pliki są przechowywane przez czas posiadania Konta i usuwane niezwłocznie po jego usunięciu. Usługodawca może wprowadzić automatyczne usuwanie plików nieaktywnych Kont po uprzednim
              powiadomieniu e-mailem z co najmniej 30-dniowym wyprzedzeniem.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 6. Generowanie grafik przez AI</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Grafiki są wytwarzane automatycznie przez modele sztucznej inteligencji dostawców zewnętrznych (Google Gemini, OpenAI). Usługodawca nie ingeruje ręcznie w proces generowania ani nie
              weryfikuje pojedynczych wyników.
            </li>
            <li>
              Technologia generatywna ma charakter niedeterministyczny: wyniki mogą zawierać artefakty, błędy w odwzorowaniu produktu, napisów lub proporcji i mogą różnić się między generacjami.
              Usługodawca zobowiązuje się do świadczenia usługi z należytą starannością, nie gwarantuje jednak konkretnego efektu artystycznego.
            </li>
            <li>
              Użytkownik jest zobowiązany sprawdzić każdą Grafikę przed jej użyciem, w szczególności pod kątem zgodności z rzeczywistym wyglądem produktu oraz regulaminami platform sprzedażowych (np.
              Allegro). Użycie Grafiki, która wprowadza kupujących w błąd co do cech produktu, jest zabronione.
            </li>
            <li>
              Generacje zakończone błędem technicznym są oznaczane jako nieudane, a Kredyt wraca na Konto automatycznie. W przypadku Grafiki wadliwej (np. nieczytelnej, z artefaktami, niezgodnej z
              wybranym stylem lub zniekształcającej produkt) Użytkownik może ją ocenić w Serwisie lub zgłosić reklamację (§ 10); Usługodawca w pierwszej kolejności zwraca Kredyt lub generuje Grafikę
              ponownie.
            </li>
            <li>
              Opisy oferty są tworzone automatycznie przez model językowy na podstawie informacji podanych przez Użytkownika i analizy zdjęcia. Mogą zawierać nieścisłości; Użytkownik jest zobowiązany
              zweryfikować wszystkie podane w nich cechy, parametry i oświadczenia przed publikacją oraz odpowiada za ich zgodność z rzeczywistością, prawem (w tym przepisami o nieuczciwych praktykach
              rynkowych) i regulaminami platform sprzedażowych.
            </li>
            <li>
              Odpowiedzialność Usługodawcy wobec Użytkowników niebędących Konsumentami jest ograniczona do wysokości wynagrodzenia zapłaconego przez Użytkownika w ciągu 12 miesięcy poprzedzających
              zdarzenie i nie obejmuje utraconych korzyści. Wobec Konsumentów Usługodawca odpowiada na zasadach ogólnych, w tym za zgodność treści cyfrowej z umową (rozdział 5b ustawy o prawach
              konsumenta).
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 7. Prawa własności intelektualnej</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Użytkownik zachowuje wszelkie prawa do przesłanych zdjęć i udziela Usługodawcy nieodpłatnej licencji na ich przetwarzanie wyłącznie w zakresie niezbędnym do świadczenia usługi (w tym
              przekazania dostawcom modeli AI).
            </li>
            <li>
              Użytkownik oświadcza, że posiada prawa do przesyłanych zdjęć (w tym do znaków towarowych i wizerunku na nich widocznych) i ponosi wyłączną odpowiedzialność za roszczenia osób trzecich z
              tego tytułu.
            </li>
            <li>
              W zakresie, w jakim Grafikom przysługuje ochrona prawna, Usługodawca przenosi na Użytkownika wszelkie przysługujące mu prawa do Grafik z chwilą ich wygenerowania; Użytkownik może
              korzystać z Grafik bez ograniczeń, w tym komercyjnie. Użytkownik przyjmuje do wiadomości, że obrazy wygenerowane przez AI mogą nie podlegać ochronie prawnoautorskiej.
            </li>
            <li>Prawa do oprogramowania, projektu graficznego, nazwy i treści Serwisu (z wyłączeniem plików Użytkowników) należą do Usługodawcy.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 8. Niedozwolone użytkowanie</h2>
          <p className="mb-2">Zabrania się wykorzystywania Serwisu do:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>generowania treści niezgodnych z prawem, obraźliwych, naruszających dobra osobiste lub prawa własności intelektualnej osób trzecich,</li>
            <li>generowania treści wprowadzających kupujących w błąd co do rzeczywistych cech produktu,</li>
            <li>obchodzenia mechanizmów zabezpieczeń, limitów lub rozliczeń Serwisu,</li>
            <li>automatycznego, masowego pobierania danych (scraping) lub przeciążania infrastruktury,</li>
            <li>udostępniania Konta osobom trzecim oraz odsprzedaży Kredytów,</li>
            <li>przesyłania złośliwego oprogramowania.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 9. Dostępność i przerwy techniczne</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Usługodawca dokłada starań, aby Serwis działał nieprzerwanie, zastrzega jednak możliwość przerw technicznych i konserwacyjnych, o których – jeśli są planowane – informuje z
              wyprzedzeniem.
            </li>
            <li>
              Serwis zależy od usług dostawców zewnętrznych (modele AI, hosting, płatności); ich czasowa niedostępność może opóźnić generowanie Grafik. Kredyty za generacje, które nie mogły zostać
              ukończone, są zwracane automatycznie.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 10. Reklamacje i pozasądowe rozwiązywanie sporów</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Reklamacje należy kierować na adres e-mail {LEGAL_ENTITY.email}, podając adres e-mail Konta, opis problemu i datę jego wystąpienia (pomocne będą identyfikatory Grafik).</li>
            <li>Usługodawca odpowiada na reklamację w terminie 14 dni od jej otrzymania. Brak odpowiedzi w tym terminie oznacza uznanie reklamacji.</li>
            <li>
              Konsument może skorzystać z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń, m.in. z pomocy powiatowego (miejskiego) rzecznika konsumentów, organizacji
              konsumenckich oraz stałych sądów polubownych przy Wojewódzkich Inspektoratach Inspekcji Handlowej. Szczegółowe informacje dostępne są na stronie www.uokik.gov.pl.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 11. Postanowienia końcowe</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Regulamin w niniejszym brzmieniu obowiązuje od {LEGAL_DATES.effective}.</li>
            <li>Spory z Użytkownikami niebędącymi Konsumentami rozstrzyga sąd właściwy dla siedziby Usługodawcy. Spory z Konsumentami rozstrzyga sąd właściwy według przepisów ogólnych.</li>
            <li>Nieważność poszczególnych postanowień nie wpływa na ważność pozostałych. W miejsce postanowień nieważnych stosuje się przepisy prawa.</li>
            <li>Zasady przetwarzania danych osobowych określa Polityka prywatności.</li>
          </ol>
        </section>
      </div>
    </>
  )
}
