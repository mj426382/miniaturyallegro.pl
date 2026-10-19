# Słownik pojęć

| Pojęcie | Znaczenie |
|---|---|
| **Zdjęcie (Image)** | Oryginalna fotografia produktu przesłana przez Użytkownika. Jednostka, do której przypięte są Grafiki i Opis oferty. |
| **Grafika (Generation)** | Jedna wygenerowana przez AI miniaturka w określonym Stylu. Stany: `PENDING → PROCESSING → COMPLETED / FAILED`. |
| **Styl** | Predefiniowany szablon sceny: 19 stylów (6 uniwersalnych, 5 sezonowych, 8 branżowych); 3 oznaczone jako `starter` tworzą Zestaw startowy. |
| **Własny styl** | Grafika z opisu Użytkownika (prompt po polsku) z opcjonalnym zdjęciem referencyjnym. |
| **Przeróbka (rework)** | Własny styl, w którym bazą jest wcześniej wygenerowana Grafika, a oryginał służy za referencję tożsamości produktu. |
| **Kredyt** | Jednostka rozliczeniowa: 1 Grafika albo 1 pakiet Poprawek opisu. Nowe konto ma 5 darmowych (`FREE_CREDITS_LIMIT`, spec 19; starsze konta zachowują swoją pulę). |
| **Pakiet** | Jednorazowy zakup Kredytów (5/15/40/200) oraz Pakiet powitalny 5 za 5 zł przy pierwszym zakupie (19). |
| **Abonament** | Miesięczny plan Stripe Billing (Start 40, Pro 150 Kredytów co okres). |
| **Opis oferty (OfferDescription)** | Tytuł (limit platformy, domyślnie ≤75 znaków), treść w prostym HTML (`h2/p/ul/ol/li/b`) i frazy kluczowe pod wybraną platformę, przypięte do Zdjęcia. Pierwszy jest gratis. |
| **Platforma / preset platformy** | OLX, Vinted, eBay, Amazon albo „Sklep internetowy / ogólne”: proporcje, rozmiary, reguły tła i limit tytułu dla eksportu i opisu, z oznaczeniem wymóg platformy / zalecane (08). Bez integracji. |
| **Poprawka (prompt edit)** | Jedno wywołanie AI zmieniające Opis (polecenie albo „napisz od nowa”). 5 gratis na Zdjęcie, dalej pakiety po 15 za 1 Kredyt. |
| **Eksport** | Deterministyczne przetworzenie Grafiki do formatu (proporcje, kadr, obrót, korekta, plakietka) bez AI. |
| **Kadr (crop)** | Prostokąt Grafiki (ułamki 0–1 obróconego obrazu), który wypełnia płótno eksportu. |
| **Reconciler** | Zadanie cykliczne oznaczające zawieszone Grafiki jako nieudane i zwracające Kredyty. |
| **Demo** | Jednorazowa generacja bez konta na landingu (limit per e-mail i IP). |
| **Sesja** | JWT w cookie `ag_session` (httpOnly) + nagłówek `X-Requested-With` jako ochrona CSRF. |
| **Landing** | Statyczna strona allgrafika.pl (SSG, blog, cennik). **Aplikacja** = app.allgrafika.pl (panel). |
| **Adres kanoniczny** | Postać adresu e-mail do wykrywania duplikatów: małe litery, bez aliasu `+`, w Gmailu bez kropek (13) |
| **Konto potwierdzone** | Konto, którego właściciel kliknął link z maila albo zalogował się przez Google; tylko ono generuje i płaci (13) |
| **Infografika** | Zdjęcie dodatkowe oferty z cechami i ikonami albo wymiarami, renderowane z grafiki bez AI (14) |
| **Styl sezonowy** | Styl z oknem dat (np. Boże Narodzenie), w sezonie wyróżniony etykietą „Teraz” (05) |
| **Paczka ZIP** | Archiwum grafik i opisów zaznaczonych zdjęć (15). „Paczka” oznacza tylko ZIP – partię zdjęć nazywamy „masowym przesyłaniem” |
| **Oryginał** | Zdjęcie przesłane przez Użytkownika eksportowane bez AI (kadr, obrót, format), np. na Vinted (08) |
| **Pulpit** | Strona startowa aplikacji (`/`) z licznikami i ostatnimi zdjęciami |
| **Partner** | Firma lub twórca polecający AllGrafikę swoim czytelnikom kodem rabatowym; dostaje prowizję od płatności przypisanych klientów (24) |
| **Przypisanie (atrybucja)** | Powiązanie konta klienta z partnerem przy pierwszej płatności kodem partnera; pierwsze wygrywa, trwa przez okres prowizji (24) |
| **Księga prowizji** | Wpisy zamówień i korekt partnera z datą księgowania; zestawienie miesięczne w strefie Europe/Warsaw (24) |
