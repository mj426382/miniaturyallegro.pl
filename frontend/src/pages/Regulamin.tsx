export default function Regulamin() {
  return (
    <>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Regulamin świadczenia usług</h1>
        <p className="text-sm text-gray-400 mb-10">Ostatnia aktualizacja: 11 maja 2025 r.</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 1. Definicje</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li><strong>Usługodawca</strong> – właściciel i operator serwisu AllGrafika.pl (dalej: „AllGrafika"), dostępnego pod adresami allgrafika.pl oraz app.allgrafika.pl.</li>
              <li><strong>Użytkownik</strong> – osoba fizyczna lub prawna, która założyła konto w Serwisie i korzysta z jego funkcji.</li>
              <li><strong>Serwis</strong> – platforma AllGrafika.pl umożliwiająca generowanie grafik produktowych z wykorzystaniem sztucznej inteligencji.</li>
              <li><strong>Grafika / Generacja</strong> – obraz wytworzony przez model AI na podstawie zdjęcia produktu i/lub opisu przekazanego przez Użytkownika.</li>
              <li><strong>Kredyt</strong> – jednostka rozliczeniowa uprawniająca do wygenerowania jednej grafiki.</li>
              <li><strong>Backblaze B2</strong> – zewnętrzna usługa przechowywania plików w chmurze (Backblaze, Inc.), na której Usługodawca przechowuje zdjęcia oryginalne i wygenerowane grafiki Użytkowników.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 2. Postanowienia ogólne</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Niniejszy Regulamin określa zasady korzystania z Serwisu AllGrafika.pl.</li>
              <li>Korzystanie z Serwisu jest równoznaczne z akceptacją Regulaminu w całości.</li>
              <li>Usługodawca zastrzega prawo do zmiany Regulaminu. O zmianach Użytkownicy zostaną poinformowani co najmniej 7 dni przed ich wejściem w życie.</li>
              <li>W sprawach nieuregulowanych Regulaminem zastosowanie mają przepisy prawa polskiego, w szczególności Kodeksu cywilnego i ustawy o świadczeniu usług drogą elektroniczną.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 3. Rejestracja i konto</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Korzystanie z pełnych funkcji Serwisu wymaga założenia konta.</li>
              <li>Użytkownik zobowiązany jest podać prawdziwe dane podczas rejestracji.</li>
              <li>Jeden Użytkownik może posiadać jedno konto. Zakładanie wielu kont w celu uzyskania dodatkowych darmowych kredytów jest zabronione.</li>
              <li>Użytkownik jest odpowiedzialny za zachowanie poufności hasła oraz za wszelkie działania wykonane z jego konta.</li>
              <li>Usługodawca zastrzega prawo do zawieszenia lub usunięcia konta Użytkownika naruszającego Regulamin.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 4. Kredyty i płatności</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Każdy nowy Użytkownik otrzymuje 10 darmowych kredytów po rejestracji.</li>
              <li>Dodatkowe kredyty można nabyć zgodnie z aktualnym cennikiem dostępnym w Serwisie.</li>
              <li>Płatności obsługiwane są przez zewnętrznego operatora płatności (Stripe). Usługodawca nie przechowuje danych kart płatniczych.</li>
              <li>Zakupione kredyty nie wygasają i nie podlegają zwrotowi, chyba że przepisy prawa wyraźnie stanowią inaczej.</li>
              <li>Jeden kredyt uprawnia do wygenerowania jednej grafiki (jednego wariantu). Automatyczna sesja generująca 6 stylów zużywa 6 kredytów.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 5. Przechowywanie plików – Backblaze B2</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Przesłane przez Użytkownika zdjęcia produktów oraz wygenerowane grafiki są przechowywane w usłudze Backblaze B2 (Backblaze, Inc., USA).</li>
              <li>Pliki są szyfrowane podczas transmisji (HTTPS) i przechowywane na infrastrukturze Backblaze zgodnie z jej polityką bezpieczeństwa.</li>
              <li>Usługodawca dokłada starań w zakresie bezpieczeństwa przechowywanych plików, jednak nie gwarantuje ich nieprzerwanej dostępności z uwagi na uzależnienie od usług zewnętrznych.</li>
              <li>Użytkownik zobowiązuje się nie przesyłać plików zawierających treści nielegalne, naruszające prawa osób trzecich lub prawa autorskie.</li>
              <li>Usługodawca zastrzega prawo do usunięcia plików Użytkownika po upływie 12 miesięcy od ostatniego logowania lub po zamknięciu konta.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 6. Generowanie grafik przez AI – wyłączenie odpowiedzialności</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Grafiki są wytwarzane automatycznie przez model sztucznej inteligencji (AI). Usługodawca nie ingeruje ręcznie w proces generowania.</li>
              <li><strong>Usługodawca nie ponosi odpowiedzialności za jakość, poprawność ani przydatność wygenerowanych grafik</strong>, w tym za wyniki niezgodne z oczekiwaniami Użytkownika.</li>
              <li>AI może niekiedy generować grafiki zawierające błędy, artefakty wizualne, nieprawidłowe odwzorowanie produktu lub inne niepożądane elementy. Użytkownik korzysta z Serwisu ze świadomością tych ograniczeń.</li>
              <li>Usługodawca nie gwarantuje, że wygenerowane grafiki spełniają wymagania konkretnych platform sprzedażowych (np. Allegro). Użytkownik samodzielnie weryfikuje zgodność grafik z regulaminami zewnętrznych platform.</li>
              <li>Odpowiedzialność Usługodawcy z tytułu niewykonania lub nienależytego wykonania usługi (w tym generowania grafik) jest ograniczona do wartości kredytów faktycznie zużytych przez Użytkownika na daną generację.</li>
              <li>Usługodawca nie ponosi odpowiedzialności za decyzje biznesowe Użytkownika podjęte na podstawie wygenerowanych grafik.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 7. Prawa własności intelektualnej</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Użytkownik zachowuje wszelkie prawa do przesłanych przez siebie zdjęć produktów.</li>
              <li>Wygenerowane grafiki mogą być przez Użytkownika swobodnie wykorzystywane komercyjnie, w tym do celów sprzedażowych.</li>
              <li>Użytkownik oświadcza, że posiada prawa do przesyłanych plików i nie narusza nimi praw osób trzecich. Wszelkie roszczenia osób trzecich wynikłe z naruszenia ich praw przez materiały przesłane przez Użytkownika obciążają wyłącznie Użytkownika.</li>
              <li>Wszelkie prawa do oprogramowania, projektu graficznego i treści Serwisu (z wyłączeniem plików Użytkownika) należą do Usługodawcy.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 8. Niedozwolone użytkowanie</h2>
            <p className="mb-2">Zabrania się wykorzystywania Serwisu do:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>generowania treści niezgodnych z prawem polskim lub unijnym,</li>
              <li>obchodzenia mechanizmów zabezpieczeń Serwisu,</li>
              <li>automatycznego masowego pobierania danych (scraping),</li>
              <li>udostępniania konta osobom trzecim w celach komercyjnych,</li>
              <li>przesyłania wirusów lub innego złośliwego oprogramowania.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 9. Dostępność i przerwy techniczne</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Usługodawca dąży do zapewnienia ciągłości działania Serwisu, jednak nie gwarantuje jego dostępności przez 100% czasu.</li>
              <li>Usługodawca zastrzega prawo do przerw technicznych, konserwacyjnych i aktualizacji Serwisu.</li>
              <li>W przypadku przerwy trwającej dłużej niż 24 godziny z przyczyn leżących po stronie Usługodawcy, Użytkownikowi przysługuje zwrot niewykorzystanych kredytów za ten okres.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 10. Reklamacje</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Reklamacje dotyczące Serwisu należy kierować na adres e-mail: kontakt@allgrafika.pl.</li>
              <li>Reklamacja powinna zawierać: login lub adres e-mail Użytkownika, opis problemu oraz datę jego wystąpienia.</li>
              <li>Usługodawca rozpatruje reklamacje w terminie 14 dni roboczych od jej otrzymania.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">§ 11. Postanowienia końcowe</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Regulamin wchodzi w życie z dniem 11 maja 2025 r.</li>
              <li>Wszelkie spory wynikłe z korzystania z Serwisu strony będą starały się rozwiązać polubownie. W przypadku braku porozumienia spory podlegają jurysdykcji sądów powszechnych właściwych dla siedziby Usługodawcy.</li>
              <li>Nieważność lub bezskuteczność poszczególnych postanowień Regulaminu nie wpływa na ważność pozostałych postanowień.</li>
            </ol>
          </section>

        </div>
      </div>
    </>
  )
}
