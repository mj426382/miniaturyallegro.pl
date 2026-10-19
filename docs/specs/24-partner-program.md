# 24 – Program partnerski (afiliacja)

| Pole | Wartość |
|---|---|
| Status | Accepted |
| Właściciel | Mateusz Janduła |
| Data | 2026-10-19 |
| Powiązane | FR-PRT-001, FR-PRT-002, spec 09 (kody rabatowe AC-PAY-026..031, zwroty AC-PAY-017..022), spec 16 (panel, AC-ADM-015..020), spec 10 (landing AC-SEO-027), spec 20 (polecenia klientów – osobny program) |

## 1. Problem i cel

Od 2026-10-18 działają kody rabatowe (spec 09/16), a pierwsi partnerzy (katalogi firm, blogi dla sprzedawców) chcą
polecać AllGrafikę swoim czytelnikom. Kod sam w sobie daje tylko rabat – właściciel nie wie, ile zarobił partner,
i musi liczyć prowizje ręcznie z raportu Stripe. Cel: partner dostaje stałą prowizję od tego, co jego czytelnicy
naprawdę zapłacili, a właściciel widzi w panelu zestawienie miesięczne, saldo do wypłaty i historię wypłat.

Model zatwierdzony przez właściciela (2026-10-19): czytelnicy partnera dostają **10% rabatu** z kodem partnera,
partner dostaje **20% prowizji** od kwoty faktycznie zapłaconej przez tych klientów.

Miara sukcesu: liczba zamówień z kodów partnerów i przychód netto od przypisanych klientów (panel, zakładka „Partnerzy”).

## 2. Zakres

- W zakresie: partnerzy w panelu administratora (tworzenie, edycja, kody), przypisanie klienta do partnera przy
  zapłacie kodem partnera, naliczanie prowizji (pakiety i faktury abonamentu), zwroty i spory, zestawienie miesięczne
  w strefie Europe/Warsaw, wypłaty i saldo, publiczna strona `/program-partnerski` na landingu.
- Poza zakresem (świadomie):
  - panel dla partnera (logowanie partnera, własne statystyki) – zestawienie wysyła właściciel;
  - linki partnerskie z ciasteczkiem – przypisanie działa wyłącznie przez kod na stronie płatności (bez śledzenia,
    bez zgody na cookies);
  - automatyczne przelewy i faktury – partner wystawia fakturę, właściciel płaci przelewem i zapisuje wypłatę w panelu;
  - przypisanie przez kod użyty przy pierwszej płatności **abonamentu** (patrz decyzja 9);
  - wsteczne przypisanie zakupów zrobionych kodem, zanim kod podłączono do partnera.
- Klient: nic się nie zmienia (rabat działa jak dotąd, AC-PAY-026..031); dochodzi tylko przypisanie konta do partnera.
  Program partnerski nie zastępuje programu poleceń klientów (spec 20).

## 3. Decyzje produktowe

1. **Partner** (panel, zakładka „Partnerzy”): nazwa, e-mail kontaktowy, opcjonalnie nazwa firmy i NIP (10 cyfr
   z poprawną sumą kontrolną; zapisywany bez kresek i spacji), rabat dla klientów w % (domyślnie 10), prowizja w %
   (domyślnie 20), okres prowizji w miesiącach (domyślnie 12), flaga „aktywny”, notatka (do 500 znaków).
   Limity: rabat 1–100 (jak kody, AC-ADM-017), prowizja 1–50, okres 1–60 miesięcy – liczby całkowite.
2. **Kody partnera**: utworzenie partnera może od razu utworzyć jego kod (ta sama usługa co AC-ADM-017: kod
   procentowy z rabatem partnera, opcjonalnie limit użyć i data ważności, notatka = nazwa partnera). Kod jest
   podłączony do partnera (`discount_codes.partnerId`). Istniejący kod (np. `SMARTNET20`) można podłączyć do partnera
   i odłączyć. Kod podłączony do innego partnera → 409. Zmiana rabatu partnera nie zmienia istniejących kodów
   (kupony Stripe są niezmienne) – nowy rabat dostaje nowy kod. Lista kodów rabatowych pokazuje partnera kodu.
   Gdy tworzenie kodu się nie uda (duplikat → 409, Stripe → 503), partner też nie powstaje.
3. **Przypisanie klienta** (atrybucja): gdy zostaje zrealizowana opłacona sesja pakietu z kodem (ścieżka AC-PAY-027,
   także kod 100% i kod uzupełniony przy ponownym dostarczeniu zdarzenia, AC-PAY-029), a kod jest podłączony do
   **aktywnego** partnera, konto klienta zostaje przypisane do partnera z datą przypisania. **Pierwsze przypisanie
   wygrywa** – kod innego partnera przy późniejszym zakupie go nie zmienia. Data przypisania to czas płatności
   (utworzenia zdarzenia w Stripe), a koniec okresu prowizji jest zapisywany przy koncie w chwili przypisania
   (`data przypisania + okres partnera` w miesiącach kalendarzowych UTC; 31 stycznia + 1 miesiąc = 28/29 lutego).
4. **Ochrona przed samopoleceniem**: konto, którego adres kanoniczny (spec 13) jest równy adresowi kanonicznemu
   e-maila kontaktowego partnera, nie jest przypisywane (ostrzeżenie w logu). Partner, który kupuje z innego adresu,
   łamie zasady programu (strona programu) – tego nie da się wykryć automatycznie.
5. **Które płatności dają prowizję**: każda zrealizowana płatność przypisanego klienta – pakiety (także bez kodu)
   i faktury abonamentu (`subscription_create`, `subscription_cycle`) – której czas płatności mieści się w okresie
   `[data przypisania, koniec okresu)`, o ile partner jest aktywny w chwili płatności. Płatności sprzed przypisania
   i po końcu okresu nie dają prowizji. Prowizja w % jest zapisywana przy transakcji w chwili płatności, więc zmiana
   stawki działa tylko na kolejne płatności; zmiana okresu działa na kolejne przypisania.
6. **Kwota prowizji**: `prowizja = round(stawka% × netto / 100)` w groszach, zaokrąglenie połówek w górę, gdzie
   `netto = zapłacono − zwroty − kwota sporu otwartego/przegranego`, najmniej 0 (ta sama reguła co przychód w panelu,
   AC-ADM-015, `HELD_SQL`). Rabat pomniejsza podstawę automatycznie (liczymy od kwoty zapłaconej). Zamówienie z kodem
   100% liczy się jako zamówienie z prowizją 0 zł.
7. **Księga prowizji**: każda zmiana to wpis (zamówienie albo korekta) z datą księgowania. Wpis zamówienia ma datę
   płatności. Zwrot, spór, wygrany spór dają korektę z datą zdarzenia (nie wcześniejszą niż zamówienie), czyli w
   **miesiącu, w którym się wydarzyły** – zamknięte miesiące się nie zmieniają. Kwoty wpisów są liczone narastająco,
   więc suma wpisów transakcji zawsze równa się `round(stawka × aktualne netto)` (bez błędów zaokrągleń, niezależnie od
   kolejności i powtórzeń zdarzeń). Korekta może sprawić, że saldo spadnie poniżej zera – przechodzi na kolejny miesiąc.
   Wpisy nie znikają po usunięciu konta klienta (zostaje skrót klienta, bez danych osobowych).
8. **Miesiąc rozliczeniowy**: miesiąc kalendarzowy w strefie Europe/Warsaw (z uwzględnieniem zmiany czasu).
9. **Abonament z kodem partnera**: kod przy pierwszej płatności abonamentu obniża cenę (AC-PAY-026), ale w tej wersji
   **nie przypisuje** klienta – webhook faktury nie podaje czytelnego kodu bez dodatkowych zapytań. Faktury abonamentu
   klienta przypisanego wcześniej (pakietem z kodem) dają prowizję. Do decyzji właściciela, czy dodać.
10. **Nieaktywny partner**: nie dostaje nowych przypisań ani prowizji od płatności w czasie nieaktywności; korekty do
    wcześniejszych zamówień dalej się księgują. Wyłączenie partnera nie wyłącza jego kodów w Stripe (robi się to w
    zakładce „Kody rabatowe”).
11. **Wypłaty**: administrator zapisuje wypłatę („Oznacz wypłatę”): kwota w zł (> 0, maks. 2 miejsca po przecinku,
    najwyżej 100 000 zł), data wypłaty (nie z przyszłości) i numer faktury partnera albo notatka (1–200 znaków).
    Saldo = suma prowizji − suma wypłat. **Próg wypłaty 50 zł** to wskazówka: wypłata poniżej progu albo wyższa niż
    saldo jest zapisywana z ostrzeżeniem. Wypłat nie edytuje się i nie ma wypłat ujemnych – błędny wpis (rzadki)
    właściciel poprawia poza panelem.
12. **Prywatność**: zestawienie partnera nie pokazuje adresów e-mail ani nazw klientów – klient to skrót `K-xxxxxxxx`
    (pierwsze 8 znaków SHA-256 identyfikatora konta), więc zestawienie można przesłać partnerowi. API panelu nie zwraca
    identyfikatorów Stripe. E-mail kontaktowy partnera widzi tylko administrator.
13. **Strona `/program-partnerski`** (landing, PL) to **opis programu dla partnerów, a nie regulamin konsumencki**.
    Regulamin dla klientów się nie zmienia (kody partnerów opisuje już § 4 ust. 12, AC-SEO-026). Zasady na stronie:
    10% dla czytelników, 20% prowizji od opłaconych zakupów przez 12 miesięcy, rozliczenie miesięczne na podstawie
    faktury partnera, minimum 50 zł, zakaz spamu, zakaz licytowania marki AllGrafika w reklamach, zakaz zakupów
    własnych, linki płatne oznaczone `rel="sponsored"` (albo `nofollow`) zgodnie z wytycznymi Google; kontakt
    `mailto:kontakt@allgrafika.pl`. Szczegóły współpracy ustala umowa z partnerem.
14. **Polityka prywatności**: przypisanie konta do partnera i rozliczenie prowizji to przetwarzanie w ramach obsługi
    płatności i księgowości (art. 6 ust. 1 lit. b, c i f). Proponowany dopisek do sekcji 3 polityki (decyzja właściciela,
    poza tą zmianą, bo zmiana polityki wymaga zapowiedzi 14 dni): „Rozliczenie prowizji partnera, którego kod rabatowy
    wpisałeś przy płatności: zapisujemy, który partner Cię polecił, i liczymy prowizję od Twoich płatności przez okres
    programu. Partner nie otrzymuje Twoich danych – tylko zestawienie kwot bez danych osobowych.”

## 4. Przepływ użytkownika (UX)

- Panel → zakładka „Partnerzy” (obok „Kody rabatowe”):
  - formularz „Nowy partner”: nazwa, e-mail kontaktowy, firma i NIP (opcjonalnie), rabat %, prowizja %, okres
    (mies.), notatka, opcjonalnie kod rabatowy (z limitem i datą ważności); walidacja po polsku przed wysłaniem;
  - lista partnerów: nazwa, status, kody, liczba przypisanych klientów, „Ten miesiąc” i „Łącznie” (zamówienia, netto,
    prowizja), „Wypłacono”, „Do wypłaty” z podpowiedzią o progu 50 zł;
  - szczegóły partnera: edycja danych i stawek, podłączenie istniejącego kodu, nowy kod, odłączenie kodu, zestawienie
    miesięczne od najnowszego miesiąca (zamówienia i korekty z datą, produktem, skrótem klienta, netto i prowizją),
    historia wypłat i formularz „Oznacz wypłatę” z ostrzeżeniem poniżej 50 zł.
- Landing: strona `/program-partnerski` z linkiem w stopce (kolumna „Firma”).

## 5. Wymagania funkcjonalne

- **FR-PRT-001** – Partnerzy z kodami, przypisaniem klientów, prowizją, zestawieniem miesięcznym i wypłatami w panelu.
- **FR-PRT-002** – Publiczny opis programu partnerskiego na landingu.

## 6. Kryteria akceptacji

- **AC-PRT-001** – Given administrator, When tworzy partnera tylko z nazwą i e-mailem, Then partner ma rabat 10%, prowizję 20%, okres 12 miesięcy, jest aktywny i nie ma kodów; When tworzy partnera z firmą, NIP-em (z kreskami), notatką i kodem (z limitem i datą ważności), Then NIP jest zapisany jako 10 cyfr, w Stripe powstaje kupon `duration: once` z `percent_off` równym rabatowi partnera i kod promocyjny, kod w bazie ma `partnerId` partnera i notatkę z nazwą partnera, a odpowiedź nie zawiera identyfikatorów Stripe.
- **AC-PRT-002** – Given formularz partnera z błędem (brak lub za krótka/za długa nazwa, zły e-mail, NIP z błędną sumą kontrolną lub złą długością, rabat spoza 1–100, prowizja spoza 1–50, okres spoza 1–60, wartość niecałkowita, notatka > 500 znaków, zły format kodu, limit < 1, data ważności w przeszłości, nieznane pole), When `POST /admin/partners`, Then 400 z polskim komunikatem, bez wywołania Stripe i bez zapisu; Given kod już istniejący (w bazie albo w Stripe) albo błąd Stripe, Then 409 albo 503 i partner nie powstaje.
- **AC-PRT-003** – Given partner, When administrator zmienia dane, stawki, okres albo wyłącza partnera (`PATCH`), Then zmiany są zapisane (puste firma/NIP/notatka czyszczą pole), nowa stawka prowizji dotyczy tylko płatności po zmianie, a nowy okres – tylko przypisań po zmianie; nieznany partner → 404; błędne wartości → 400 jak w AC-PRT-002.
- **AC-PRT-004** – Given istniejący kod (np. `SMARTNET20`), When administrator podłącza go do partnera (wielkość liter bez znaczenia), tworzy partnerowi kolejny kod i odłącza kod, Then kod ma `partnerId` partnera (po odłączeniu – brak), lista partnerów pokazuje kody partnera, a lista kodów rabatowych pokazuje nazwę partnera; nieznany kod → 404, kod podłączony do innego partnera → 409, odłączenie kodu innego partnera → 404.
- **AC-PRT-005** – Given kod podłączony do aktywnego partnera, When klient płaci za pakiet z tym kodem (webhook, także zdublowany i równoległy), Then konto klienta ma partnera i datę przypisania równą czasowi płatności, transakcja ma partnera i stawkę prowizji, a księga ma jeden wpis zamówienia; Given później zakup z kodem innego partnera, Then przypisanie się nie zmienia (pierwsze wygrywa), a ta płatność daje prowizję pierwszemu partnerowi; Given kod bez partnera, brak kodu albo partner nieaktywny, Then konto nie jest przypisane i nie powstaje wpis.
- **AC-PRT-006** – Given klient, którego adres kanoniczny jest równy e-mailowi kontaktowemu partnera (np. z aliasem `+` albo inną wielkością liter), When płaci kodem tego partnera, Then konto nie jest przypisane, transakcja nie ma partnera i nie powstaje wpis prowizji, a kredyty są dodane normalnie.
- **AC-PRT-007** – Given płatność z kodem partnera, gdy Stripe nie pozwolił ustalić kodu przy pierwszym dostarczeniu (AC-PAY-029), When zdarzenie przychodzi ponownie, Then konto zostaje przypisane z datą płatności, a kredyty nie są dodane drugi raz.
- **AC-PRT-008** – Given klient przypisany do partnera, When płaci za kolejne pakiety bez kodu i za faktury abonamentu (`subscription_create`, `subscription_cycle`), Then każda płatność w okresie `[przypisanie, przypisanie + okres)` ma wpis prowizji; płatność dokładnie na końcu okresu, płatność sprzed przypisania, faktura proraty (bez kredytów) i płatność w czasie, gdy partner jest nieaktywny, nie dają prowizji; zamówienie z kodem 100% liczy się jako zamówienie z prowizją 0 zł.
- **AC-PRT-009** – Given płatności przypisanego klienta (pakiety z rabatem procentowym i kwotowym, bez rabatu, faktura abonamentu), When liczona jest prowizja, Then wynosi `round(stawka × zapłacono / 100)` w groszach z zaokrągleniem połówek w górę (np. 25,20 zł × 20% = 5,04 zł; 0,03 zł × 50% = 0,02 zł; 0,01 zł × 20% = 0 zł) od kwoty po rabacie, a suma zestawienia równa się sumie prowizji transakcji.
- **AC-PRT-010** – Given opłacone zamówienie z prowizją, When przychodzi częściowy zwrot, pełny zwrot, otwarty spór, spór przegrany albo wygrany (także zdublowane zdarzenia i zwrot przed realizacją), Then netto i prowizja zamówienia są przeliczane jak przychód (AC-ADM-015: zwroty i spór otwarty/przegrany pomniejszają, wygrany oddaje), zmiana jest księgowana jako korekta w miesiącu zdarzenia (zamknięty miesiąc się nie zmienia), suma wpisów transakcji zawsze równa się `round(stawka × netto)`, a saldo po wcześniejszej wypłacie może spaść poniżej zera.
- **AC-PRT-011** – Given płatności i zwroty z czasem zdarzenia przy granicach miesięcy, When administrator otwiera zestawienie, Then miesiące są liczone w strefie Europe/Warsaw: 31.10.2026 22:30 UTC (23:30 CET, po zmianie czasu) → październik, 31.10.2026 23:30 UTC → listopad, 31.03.2026 21:30 UTC (23:30 CEST) → marzec, 31.03.2026 22:30 UTC → kwiecień, 31.12.2026 23:30 UTC → styczeń 2027; zestawienie jest od najnowszego miesiąca.
- **AC-PRT-012** – Given partner z saldem, When administrator zapisuje wypłatę (kwota, data, numer faktury), Then wypłata jest w historii, „Wypłacono” rośnie, a saldo maleje o kwotę; wypłata poniżej 50 zł albo wyższa niż saldo jest zapisana z ostrzeżeniem w odpowiedzi; kwota ≤ 0, z więcej niż 2 miejscami po przecinku, powyżej 100 000 zł, data z przyszłości lub nieprawidłowa, pusty albo za długi numer → 400 z polskim komunikatem; nieznany partner → 404.
- **AC-PRT-013** – Given partnerzy z zamówieniami w bieżącym i wcześniejszych miesiącach, korektami i wypłatami, When administrator pobiera listę i szczegóły, Then lista ma dla każdego partnera kody, liczbę przypisanych klientów, bieżący miesiąc i łącznie (zamówienia, netto, prowizja), wypłacono i saldo oraz próg wypłaty 5000 groszy; szczegóły mają zestawienie miesięczne z wpisami (data, rodzaj, produkt, skrót klienta `K-` + 8 znaków, netto, prowizja) i wypłaty; odpowiedzi nie zawierają adresów e-mail klientów ani identyfikatorów Stripe; nieznany partner → 404; konto spoza `ADMIN_EMAILS` dostaje 403 na każdym endpoincie partnerów.
- **AC-PRT-014** – Given losowa, powtarzalna sekwencja (zakupy z kodami dwóch partnerów i bez kodu, kod 100%, faktury abonamentu, zwroty częściowe i pełne, spory wygrane i przegrane, zdublowane i stare zdarzenia, wypłaty), When po każdym kroku, Then dla każdej transakcji suma wpisów księgi równa się `round(stawka × netto)` (0 dla transakcji bez partnera), każde konto ma najwyżej jednego partnera ustalonego pierwszym kodem, saldo partnera = suma prowizji − wypłaty, a saldo kredytów zgadza się z księgą kredytów (AC-PAY-025).
- **AC-PRT-015** – Given panel administratora, When administrator otwiera „Partnerzy”, wypełnia formularz z błędami, potem poprawnie z kodem, otwiera szczegóły partnera, podłącza istniejący kod i zapisuje wypłatę poniżej 50 zł, Then widzi polskie komunikaty przed wysłaniem, nowego partnera z kodem na liście z metrykami, zestawienie miesięczne ze skrótami klientów (bez adresów e-mail), ostrzeżenie o progu 50 zł i nowe saldo; na telefonie i tablecie widok mieści się bez poziomego przewijania strony.
- **AC-PRT-016** – Given walidacja formularzy partnera i wypłaty w aplikacji, When dane są poprawne albo błędne (NIP z sumą kontrolną, stawki, okres, kwota z przecinkiem, data z przyszłości), Then reguły są takie jak w API, a etykiety miesięcy i kwot są po polsku („październik 2026”, „5,04 zł”).

## 7. API

Wszystkie endpointy: JWT + administrator (AC-ADM-002, AC-ADM-014), komunikaty po polsku.

- `GET /admin/partners` → `{month: 'RRRR-MM', minPayoutGrosze: 5000, partners: [...]}`.
- `POST /admin/partners {name, contactEmail, companyName?, nip?, customerDiscountPercent?, commissionPercent?,
  commissionMonths?, active?, note?, code?, codeMaxRedemptions?, codeExpiresAt?}` → 201 partner.
- `GET /admin/partners/:id` → partner + `months: [{month, orders, netPaidGrosze, commissionGrosze, entries: [...]}]`, `payouts`.
- `PATCH /admin/partners/:id {…pola jak przy tworzeniu bez kodu}` → partner.
- `POST /admin/partners/:id/codes {code, maxRedemptions?, expiresAt?}` → 201 partner (nowy kod z rabatem partnera).
- `POST /admin/partners/:id/codes/link {code}` → partner; `POST /admin/partners/:id/codes/:codeId/unlink` → partner.
- `POST /admin/partners/:id/payouts {amountPln, paidOn: 'RRRR-MM-DD', reference}` → 201 `{payout, balanceGrosze, warnings}`.
- `GET /admin/discount-codes` – wiersz kodu ma dodatkowo `partner: {id, name} | null`.

## 8. Dane i migracje

Migracja `20261019090000_partner_program` (tylko dodawanie – kolumny NULL i nowe tabele, bez zmiany istniejących wartości):

- tabela `partners (id, name, contactEmail, companyName NULL, nip NULL, customerDiscountPercent DEFAULT 10,
  commissionPercent DEFAULT 20, commissionMonths DEFAULT 12, active DEFAULT true, note NULL, createdBy, createdAt, updatedAt)`;
- `discount_codes.partnerId NULL` (FK, przy usunięciu partnera `SET NULL`);
- `users.partnerId NULL`, `users.partnerAttributedAt NULL`, `users.partnerCommissionUntil NULL`;
- `payment_transactions.partnerId NULL`, `payment_transactions.partnerCommissionPercent NULL`;
- tabela `partner_commissions (id, partnerId, transactionId NULL – FK SET NULL, customerRef, kind payment|adjustment,
  productKind, packageId NULL, netPaidGrosze, commissionGrosze, commissionPercent, occurredAt, createdAt)`;
- tabela `partner_payouts (id, partnerId, amountGrosze, paidOn DATE, reference, createdBy, createdAt)`.

Istniejące konta i transakcje nie mają partnera. Usunięcie konta klienta usuwa jego transakcje (spec 03), ale wpisy
księgi zostają (bez danych osobowych), więc zamknięte zestawienia i saldo partnera się nie zmieniają.

## 9. Wymagania niefunkcjonalne

- Księgowanie prowizji odbywa się w tej samej transakcji bazy co realizacja płatności albo zwrot (blokada wiersza
  transakcji), więc równoległe i powtórzone zdarzenia Stripe nie dublują wpisów (NFR-REL-002).
- Błąd w przypisaniu po realizacji kończy webhook kodem 5xx – Stripe ponowi zdarzenie, a ponowienie dokończy
  przypisanie bez drugiego dodania kredytów.
- Dane partnera (e-mail, NIP) tylko dla administratora; zestawienie bez danych osobowych klientów (RODO art. 5 ust. 1 lit. c).
- W testach i logach tylko adresy testowe (`@test.allgrafika.pl`), bez prawdziwych danych klientów.

## 10. Wpływ na dokumenty

- Landing: `/program-partnerski`, stopka, sitemapa (AC-SEO-027).
- Regulamin: bez zmian (§ 4 ust. 12 już opisuje kody partnerów).
- Polityka prywatności: proponowany dopisek w decyzji 14 – do decyzji właściciela.
- Umowa z partnerem (poza repozytorium): stawki, okres, faktura, zasady z decyzji 13.

## 11. Ryzyka i pytania otwarte (do potwierdzenia przez właściciela)

1. Księgowanie korekt w miesiącu zdarzenia (zamknięte miesiące bez zmian) i data płatności = czas zdarzenia Stripe.
2. Nieaktywny partner nie dostaje prowizji od płatności w czasie nieaktywności (decyzja 10).
3. Stawka prowizji zapisywana przy płatności, okres – przy przypisaniu (zmiany działają tylko na przyszłość).
4. Kod partnera przy pierwszej płatności abonamentu nie przypisuje klienta (decyzja 9).
5. Samopolecenie wykrywane tylko po adresie e-mail (decyzja 4).
6. Limit prowizji 1–50%, okres 1–60 miesięcy.
7. Wypłata wyższa niż saldo jest dozwolona z ostrzeżeniem (np. zaliczka uzgodniona z partnerem).
8. Podłączenie istniejącego kodu (np. `SMARTNET20`) nie przypisuje wstecz klientów, którzy już nim zapłacili.
9. Dopisek w polityce prywatności (decyzja 14).
10. Prowizja jest liczona od kwoty brutto zapłaconej przez klienta (z VAT, jeśli sprzedawca jest płatnikiem VAT) –
    zgodnie z „20% od tego, co klienci faktycznie zapłacili”.

## 12. Plan testów

- Backend (Jest + supertest na prawdziwej bazie, fałszywy Stripe, podpisane webhooki): AC-PRT-001..014 w
  `backend/test/partners.e2e-spec.ts`; testy jednostkowe matematyki prowizji, miesięcy i NIP-u w
  `backend/src/partners/*.spec.ts`; kontrakt OpenAPI (AC-API-001).
- Frontend: Vitest dla walidacji i formatowania (AC-PRT-016), Playwright „Partnerzy” na wszystkich profilach urządzeń (AC-PRT-015).
- Landing: Playwright dla `/program-partnerski` i struktury SEO (AC-SEO-027) oraz istniejące testy SEO/hydratacji z nową trasą.
