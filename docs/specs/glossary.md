# Słownik pojęć

| Pojęcie | Znaczenie |
|---|---|
| **Zdjęcie (Image)** | Oryginalna fotografia produktu przesłana przez Użytkownika. Jednostka, do której przypięte są Grafiki i Opis oferty. |
| **Grafika (Generation)** | Jedna wygenerowana przez AI miniaturka w określonym Stylu. Stany: `PENDING → PROCESSING → COMPLETED / FAILED`. |
| **Styl** | Predefiniowany szablon sceny (6 stylów; 3 oznaczone jako `starter` tworzą Zestaw startowy). |
| **Własny styl** | Grafika z opisu Użytkownika (prompt po polsku) z opcjonalnym zdjęciem referencyjnym. |
| **Przeróbka (rework)** | Własny styl, w którym bazą jest wcześniej wygenerowana Grafika, a oryginał służy za referencję tożsamości produktu. |
| **Kredyt** | Jednostka rozliczeniowa: 1 Grafika albo 1 pakiet Poprawek opisu. Nowe konto ma 10 darmowych (`FREE_CREDITS_LIMIT`). |
| **Pakiet** | Jednorazowy zakup Kredytów (5/15/40). |
| **Abonament** | Miesięczny plan Stripe Billing (Start 40, Pro 150 Kredytów co okres). |
| **Opis oferty (OfferDescription)** | Tytuł (≤75 znaków), treść HTML w podzbiorze Allegro i frazy kluczowe, przypięte do Zdjęcia. Pierwszy jest gratis. |
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
| **Paczka ZIP** | Archiwum grafik i opisów zaznaczonych zdjęć (15) |
